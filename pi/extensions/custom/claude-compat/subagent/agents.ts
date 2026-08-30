import fs from 'node:fs'
import path from 'node:path'
import { getAgentDir, parseFrontmatter } from '@earendil-works/pi-coding-agent'
import { isCompatTrusted } from '../trust.ts'
import { nearestTrustedProjectAgentDirs } from './discovery.ts'

export type AgentScope = 'user' | 'project' | 'both'

export interface AgentConfig {
	name: string
	description: string
	tools?: string[]
	model?: string
	systemPrompt: string
	source: 'user' | 'project'
	filePath: string
}

export interface AgentDiscoveryResult {
	agents: AgentConfig[]
	projectAgentsDir: string | null
}

type AgentFrontmatter = {
	name?: unknown
	description?: unknown
	tools?: unknown
	model?: unknown
}

const toolAliases: Record<string, string> = {
	Read: 'read',
	Bash: 'bash',
	Edit: 'edit',
	Write: 'write',
	Grep: 'grep',
	Glob: 'find',
	LS: 'ls',
}

function parseToolList(value: unknown): string[] | undefined {
	const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
	const tools = raw
		.filter((tool): tool is string => typeof tool === 'string')
		.map((tool) => tool.trim())
		.filter(Boolean)
		.map((tool) => toolAliases[tool] ?? tool)
	return tools.length > 0 ? [...new Set(tools)] : undefined
}

const claudeModelAliases: Record<string, string | undefined> = {
	haiku: 'openai-codex/gpt-5.6-luna',
	sonnet: 'openai-codex/gpt-5.6-terra',
	opus: 'openai-codex/gpt-5.6-sol',
	inherit: undefined,
}

function normalizeModel(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined
	const alias = value.toLowerCase()
	if (alias in claudeModelAliases) return claudeModelAliases[alias]
	return value
}

function markdownFiles(dir: string): string[] {
	if (!fs.existsSync(dir)) return []
	const files: string[] = []
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name)
		if (entry.isDirectory()) files.push(...markdownFiles(full))
		else if ((entry.isFile() || entry.isSymbolicLink()) && entry.name.endsWith('.md')) files.push(full)
	}
	return files
}

function loadAgentsFromDir(dir: string, source: 'user' | 'project'): AgentConfig[] {
	const agents: AgentConfig[] = []
	for (const filePath of markdownFiles(dir)) {
		try {
			const content = fs.readFileSync(filePath, 'utf8')
			const { frontmatter, body } = parseFrontmatter<AgentFrontmatter>(content)
			if (typeof frontmatter.name !== 'string' || typeof frontmatter.description !== 'string') continue
			agents.push({
				name: frontmatter.name,
				description: frontmatter.description,
				tools: parseToolList(frontmatter.tools),
				model: normalizeModel(frontmatter.model),
				systemPrompt: body,
				source,
				filePath,
			})
		} catch {}
	}
	return agents
}

export function discoverAgents(cwd: string, scope: AgentScope, trusted = isCompatTrusted(cwd)): AgentDiscoveryResult {
	const userDirs = [path.join(getAgentDir(), 'agents'), path.join(process.env.HOME ?? '', '.claude', 'agents')]
	// Never inspect repo-controlled agent directories until the shared trust boundary passes.
	const projectDirs = trusted && scope !== 'user' ? nearestTrustedProjectAgentDirs(cwd, isCompatTrusted) : []
	const userAgents = scope === 'project' ? [] : userDirs.flatMap((dir) => loadAgentsFromDir(dir, 'user'))
	const projectAgents = scope === 'user' || !trusted ? [] : projectDirs.flatMap((dir) => loadAgentsFromDir(dir, 'project'))
	const agentMap = new Map<string, AgentConfig>()
	for (const agent of userAgents) agentMap.set(agent.name, agent)
	for (const agent of projectAgents) agentMap.set(agent.name, agent)
	return {
		agents: [...agentMap.values()],
		projectAgentsDir: projectDirs[0] ?? null,
	}
}

export function formatAgentList(agents: AgentConfig[], maxItems: number): { text: string; remaining: number } {
	if (agents.length === 0) return { text: 'none', remaining: 0 }
	const listed = agents.slice(0, maxItems)
	return {
		text: listed.map((agent) => `${agent.name} (${agent.source}): ${agent.description}`).join('; '),
		remaining: agents.length - listed.length,
	}
}
