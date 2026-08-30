import os from 'node:os'
import path from 'node:path'
import { isCompatTrusted, readJson } from './trust.ts'
import { Type } from 'typebox'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js'
import { PersistentOAuthProvider, openBrowser, waitForOAuthCode } from './oauth.ts'

interface McpServerConfig {
	type?: string
	url?: string
	command?: string
	args?: string[]
	env?: Record<string, string>
	headers?: Record<string, string>
}

interface McpConfig {
	mcpServers?: Record<string, McpServerConfig>
}

interface RegisteredMcpTool {
	registeredName: string
	serverName: string
	remoteName: string
	description: string
	client: Client
}


function interpolate(value: string): string {
	return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-(.*?))?\}/g, (_match, name: string, fallback?: string) => {
		return process.env[name] ?? fallback ?? ''
	}).replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name: string) => process.env[name] ?? '')
}

function interpolateConfig(config: McpServerConfig): McpServerConfig {
	return {
		...config,
		url: config.url ? interpolate(config.url) : undefined,
		command: config.command ? interpolate(config.command) : undefined,
		args: config.args?.map(interpolate),
		env: config.env ? Object.fromEntries(Object.entries(config.env).map(([key, value]) => [key, interpolate(value)])) : undefined,
		headers: config.headers ? Object.fromEntries(Object.entries(config.headers).map(([key, value]) => [key, interpolate(value)])) : undefined,
	}
}

function loadServers(cwd: string): Record<string, McpServerConfig> {
	const globalSettings = readJson<{ mcpServers?: Record<string, McpServerConfig> }>(path.join(os.homedir(), '.claude', 'settings.json'))
	const projectConfig = isCompatTrusted(cwd) ? readJson<McpConfig>(path.join(cwd, '.mcp.json')) : undefined
	return Object.fromEntries(
		Object.entries({ ...globalSettings?.mcpServers, ...projectConfig?.mcpServers })
			.filter(([name]) => name !== 'composio') // Composio is available in Claude Code, but its proxy adds ~5s to Pi startup.
			.map(([name, config]) => [name, interpolateConfig(config)]),
	)
}

async function connectServer(name: string, config: McpServerConfig, cwd: string, signal?: AbortSignal): Promise<Client> {
	const client = new Client({ name: `pi-claude-compat-${name}`, version: '1.0.0' }, { capabilities: {} })
	const connectionSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000)
	if (config.command) {
		const transport = new StdioClientTransport({
			command: config.command,
			args: config.args ?? [],
			cwd,
			env: { ...process.env, ...(config.env ?? {}) } as Record<string, string>,
			stderr: 'pipe',
		})
		await client.connect(transport, { signal: connectionSignal })
		return client
	}
	if (!config.url) throw new Error(`MCP server ${name} has neither url nor command`)
	const url = new URL(config.url)
	const requestInit = { headers: config.headers ?? {} }
	if (config.type === 'sse' || url.pathname.endsWith('/sse')) {
		await client.connect(new SSEClientTransport(url, { requestInit }), { signal: connectionSignal })
	} else {
		const authProvider = Object.keys(config.headers ?? {}).length === 0 ? new PersistentOAuthProvider(name, url.toString()) : undefined
		const transport = new StreamableHTTPClientTransport(url, { requestInit, authProvider })
		try {
			await client.connect(transport, { signal: connectionSignal })
		} catch (error) {
			if (error instanceof UnauthorizedError && authProvider?.pendingAuthorizationUrl) {
				throw new Error(`OAuth authorization required. Run /mcp-auth ${name}`)
			}
			throw error
		}
	}
	return client
}

async function authorizeServer(name: string, config: McpServerConfig, cwd: string): Promise<'already-connected' | 'authorized'> {
	if (!config.url) throw new Error(`MCP server ${name} is not an HTTP server.`)
	const url = new URL(config.url)
	const provider = new PersistentOAuthProvider(name, url.toString())
	const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers: config.headers ?? {} }, authProvider: provider })
	const client = new Client({ name: `pi-claude-compat-auth-${name}`, version: '1.0.0' }, { capabilities: {} })
	try {
		await client.connect(transport, { signal: AbortSignal.timeout(15_000) })
		await client.close()
		return 'already-connected'
	} catch (error) {
		if (!(error instanceof UnauthorizedError) || !provider.pendingAuthorizationUrl) throw error
		const codePromise = waitForOAuthCode()
		openBrowser(provider.pendingAuthorizationUrl)
		const code = await codePromise
		await transport.finishAuth(code)
		try { await client.close() } catch {}
		const verified = await connectServer(name, config, cwd)
		await verified.listTools(undefined, { signal: AbortSignal.timeout(15_000) })
		await verified.close()
		return 'authorized'
	}
}

function contentToPi(content: unknown[]): Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> {
	const converted: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = []
	for (const item of content as Array<Record<string, unknown>>) {
		if (item.type === 'text' && typeof item.text === 'string') converted.push({ type: 'text', text: item.text })
		else if (item.type === 'image' && typeof item.data === 'string' && typeof item.mimeType === 'string') {
			converted.push({ type: 'image', data: item.data, mimeType: item.mimeType })
		} else converted.push({ type: 'text', text: JSON.stringify(item, null, 2) })
	}
	return converted.length > 0 ? converted : [{ type: 'text', text: '(MCP tool returned no content)' }]
}

function scoreTool(tool: RegisteredMcpTool, query: string): number {
	const haystack = `${tool.serverName} ${tool.remoteName} ${tool.description}`.toLowerCase()
	const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1)
	return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0)
}

export default function mcpCompat(pi: ExtensionAPI): void {
	let inPlanMode = false
	let clients: Client[] = []
	let tools: RegisteredMcpTool[] = []
	let failures: string[] = []
	let serverConfigs: Record<string, McpServerConfig> = {}
	let initialization: Promise<void> | undefined
	let initializationController: AbortController | undefined
	let initializationState: 'idle' | 'loading' | 'ready' = 'idle'

	async function initializeServers(cwd: string, signal: AbortSignal, notifyFailures?: (message: string) => void): Promise<void> {
		await Promise.all(Object.entries(serverConfigs).map(async ([serverName, config]) => {
			try {
				const client = await connectServer(serverName, config, cwd, signal)
				clients.push(client)
				const listSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)])
				const listed = await client.listTools(undefined, { signal: listSignal })
				for (const remote of listed.tools) {
					const registeredName = `mcp__${serverName}__${remote.name}`
					const record: RegisteredMcpTool = {
						registeredName,
						serverName,
						remoteName: remote.name,
						description: remote.description ?? `${remote.name} from ${serverName}`,
						client,
					}
					tools.push(record)
					pi.registerTool({
						name: registeredName,
						label: `${serverName}: ${remote.name}`,
						description: record.description,
						parameters: remote.inputSchema as any,
						async execute(_id, params, toolSignal) {
							const result = await client.callTool({ name: remote.name, arguments: params as Record<string, unknown> }, undefined, { signal: toolSignal })
							const content = contentToPi(result.content as unknown[])
							if (result.isError) throw new Error(content.map((item) => item.type === 'text' ? item.text : '[image]').join('\n'))
							return { content, details: { serverName, remoteName: remote.name, structuredContent: result.structuredContent } }
						},
					})
				}
			} catch (error) {
				if (!signal.aborted) failures.push(`${serverName}: ${error instanceof Error ? error.message : String(error)}`)
			}
		}))
		if (signal.aborted) return
		const activeWithoutMcpTools = pi.getActiveTools().filter((name) => !name.startsWith('mcp__'))
		pi.setActiveTools([...new Set([...activeWithoutMcpTools, 'mcp_search_tools'])])
		if (failures.length > 0) notifyFailures?.(`Some MCP servers failed:\n${failures.join('\n')}`)
	}

	pi.events.on('plan-mode:changed', (state: { enabled?: boolean }) => {
		inPlanMode = state.enabled === true
	})

	pi.registerTool({
		name: 'mcp_search_tools',
		label: 'MCP Search Tools',
		description: 'Search the configured Claude MCP servers for tools relevant to a task and enable matching tools. Use this before attempting an MCP operation whose exact tool schema is not active.',
		promptSnippet: 'Search and enable tools from the project’s configured Claude MCP servers',
		promptGuidelines: ['Use mcp_search_tools when CLAUDE.md, a skill, or the user requires an MCP capability that is not currently active.'],
		parameters: Type.Object({
			query: Type.String({ description: 'Capability, operation, or expected MCP tool name' }),
			limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 20 })),
		}),
		async execute(_id, params) {
			await initialization
			const matches = tools
				.map((tool) => ({ tool, score: scoreTool(tool, params.query) }))
				.filter((item) => item.score > 0)
				.sort((a, b) => b.score - a.score || a.tool.registeredName.localeCompare(b.tool.registeredName))
				.slice(0, params.limit ?? 8)
				.map((item) => item.tool)
			if (matches.length === 0) {
				return { content: [{ type: 'text', text: `No MCP tools matched “${params.query}”.${failures.length ? `\nUnavailable servers:\n${failures.join('\n')}` : ''}` }], details: { matches: [], failures } }
			}
			const active = pi.getActiveTools()
			const added = matches.map((tool) => tool.registeredName).filter((name) => !active.includes(name))
			pi.setActiveTools([...new Set([...active, ...added])])
			return {
				content: [{ type: 'text', text: `Enabled MCP tools:\n${matches.map((tool) => `- ${tool.registeredName}: ${tool.description}`).join('\n')}` }],
				details: { matches: matches.map((tool) => tool.registeredName), added, failures },
			}
		},
	})

	pi.registerCommand('mcp', {
		description: 'Show MCP server and tool status',
		handler: async (_args, ctx) => {
			const status = initializationState === 'loading' ? 'MCP servers are still loading in the background.\n\n' : ''
			ctx.ui.notify(`${status}${tools.length} MCP tools registered across ${clients.length} connected servers${failures.length ? `\n\nFailures:\n${failures.join('\n')}` : ''}`, failures.length ? 'warning' : 'info')
		},
	})

	pi.registerCommand('mcp-auth', {
		description: 'Authenticate an OAuth MCP server, for example /mcp-auth mobbin',
		handler: async (args, ctx) => {
			const name = args.trim()
			if (!name) {
				ctx.ui.notify(`Usage: /mcp-auth <server>\nConfigured servers: ${Object.keys(serverConfigs).sort().join(', ')}`, 'info')
				return
			}
			const config = serverConfigs[name]
			if (!config) {
				ctx.ui.notify(`Unknown MCP server: ${name}`, 'error')
				return
			}
			ctx.ui.notify(`Opening browser authorization for ${name}…`, 'info')
			try {
				const status = await authorizeServer(name, config, ctx.cwd)
				ctx.ui.notify(status === 'authorized' ? `${name} authenticated. Run /reload to activate its tools.` : `${name} is already authenticated.`, 'info')
			} catch (error) {
				ctx.ui.notify(`${name} authentication failed: ${error instanceof Error ? error.message : String(error)}`, 'error')
			}
		},
	})

	pi.on('session_start', (_event, ctx) => {
		clients = []
		tools = []
		failures = []
		serverConfigs = loadServers(ctx.cwd)
		pi.setActiveTools([...new Set([...pi.getActiveTools(), 'mcp_search_tools'])])

		const controller = new AbortController()
		initializationController = controller
		initializationState = 'loading'
		initialization = new Promise<void>((resolve) => setTimeout(resolve, 0))
			.then(() => {
				if (controller.signal.aborted) return
				return initializeServers(
					ctx.cwd,
					controller.signal,
					ctx.hasUI ? (message) => ctx.ui.notify(message, 'warning') : undefined,
				)
			})
			.catch((error) => {
				if (!controller.signal.aborted) failures.push(`Initialization: ${error instanceof Error ? error.message : String(error)}`)
			})
			.finally(() => {
				if (initializationController === controller) initializationState = controller.signal.aborted ? 'idle' : 'ready'
			})
	})

	pi.on('tool_call', async (event) => {
		if (!inPlanMode || !event.toolName.startsWith('mcp__')) return
		const record = tools.find((tool) => tool.registeredName === event.toolName)
		if (!record) return
		const readOnlyName = /^(get|list|search|read|fetch|find|lookup|query|upcoming|browser_(navigate|snapshot|console_messages|network_requests|wait_for|navigate_back|resize|evaluate))/i.test(record.remoteName)
		if (!readOnlyName) return { block: true, reason: `Plan mode blocks potentially mutating MCP tool: ${record.registeredName}` }
	})

	pi.on('before_agent_start', async (event) => {
		const explicit = tools.filter((tool) => event.prompt.includes(tool.registeredName) || event.prompt.includes(tool.remoteName))
		if (explicit.length > 0) {
			pi.setActiveTools([...new Set([...pi.getActiveTools(), ...explicit.map((tool) => tool.registeredName)])])
		}
	})

	pi.on('session_shutdown', async () => {
		initializationController?.abort()
		if (initialization) await Promise.allSettled([initialization])
		await Promise.allSettled(clients.map((client) => client.close()))
		initialization = undefined
		initializationController = undefined
		initializationState = 'idle'
		clients = []
	})
}
