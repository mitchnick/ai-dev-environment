import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isCompatDeleteTrusted, isCompatTrusted, isCompatWriteTrusted, projectHasClaudeConfig, saveCompatTrust } from './trust.ts'
import { normalizeQuestionArguments, resolveMultiSelectAnswer, type ClaudeQuestion } from './questions.ts'
import { isSensitivePath, requiresDestructiveConfirmation } from './security.ts'
import { minimatch } from 'minimatch'
import { Type } from 'typebox'
import {
	type ExtensionAPI,
	type ExtensionContext,
	parseFrontmatter,
} from '@earendil-works/pi-coding-agent'

interface ClaudeSettings {
	permissions?: { deny?: string[] }
	hooks?: Record<string, ClaudeHookGroup[]>
}

interface ClaudeHookGroup {
	matcher?: string
	hooks?: ClaudeHook[]
}

interface ClaudeHook {
	type?: string
	command?: string
	timeout?: number
	async?: boolean
}

interface RuleFile {
	absolutePath: string
	relativePath: string
	patterns: string[]
	always: boolean
	body: string
}

interface HookResult {
	stdout: string
	stderr: string
	code: number
}

const suspiciousCommandPatterns: Array<{ pattern: RegExp; reason: string }> = [
	{ pattern: /\b(?:curl|wget)\b[^\n]*(?:\.env(?:rc)?|\.ssh|\.aws|auth\.json|credentials)/i, reason: 'Network command references credentials or secret-bearing files.' },
	{ pattern: /\b(?:scp|sftp|rsync|nc|ncat|netcat)\b/i, reason: 'Command can transfer data outside the project.' },
	{ pattern: /(?:base64\s+(?:--decode|-d)|openssl\s+enc)[^\n|;]*(?:\||;|&&)\s*(?:sh|bash|zsh|eval)/i, reason: 'Command executes an encoded payload.' },
	{ pattern: /\b(?:curl|wget)\b[^\n]*(?:--data(?:-[a-z]+)?|-d\b|--form|-F\b|--upload-file|-T\b)/i, reason: 'Command uploads data to an external URL.' },
	{ pattern: /\b(?:npm|pnpm|yarn)\s+(?:install|add)\s+(?:-g|--global)\b/i, reason: 'Command installs a global package.' },
	{ pattern: /\b(?:chmod|chown)\b[^\n]*(?:\/etc\/|\/usr\/|\/System\/|\/Library\/)/i, reason: 'Command changes permissions in a system directory.' },
]

function readJson<T>(file: string): T | undefined {
	try {
		return JSON.parse(fs.readFileSync(file, 'utf8')) as T
	} catch {
		return undefined
	}
}

function findFiles(dir: string, filename?: string): string[] {
	if (!fs.existsSync(dir)) return []
	const files: string[] = []
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name)
		let isDirectory = entry.isDirectory()
		if (entry.isSymbolicLink()) {
			try { isDirectory = fs.statSync(full).isDirectory() } catch {}
		}
		if (isDirectory) files.push(...findFiles(full, filename))
		else if ((entry.isFile() || entry.isSymbolicLink()) && (!filename || entry.name === filename)) files.push(full)
	}
	return files
}

function loadSettings(cwd: string, trusted: boolean): ClaudeSettings[] {
	const files = [path.join(os.homedir(), '.claude', 'settings.json')]
	if (trusted) files.push(...projectSettingsFiles(cwd))
	return files.map((file) => readJson<ClaudeSettings>(file)).filter((value): value is ClaudeSettings => Boolean(value))
}

function projectSettingsFiles(cwd: string): string[] {
	return [path.join(cwd, '.claude', 'settings.json'), path.join(cwd, '.claude', 'settings.local.json')]
}

function loadProjectSettings(cwd: string, trusted: boolean): ClaudeSettings[] {
	if (!trusted) return []
	return projectSettingsFiles(cwd).map((file) => readJson<ClaudeSettings>(file)).filter((value): value is ClaudeSettings => Boolean(value))
}

function loadRules(cwd: string, trusted: boolean): RuleFile[] {
	if (!trusted) return []
	const roots = [path.join(cwd, '.claude', 'rules'), path.join(cwd, '.claude', 'instructions')]
	const rules: RuleFile[] = []
	for (const root of roots) {
		for (const file of findFiles(root).filter((candidate) => candidate.endsWith('.md'))) {
			try {
				const source = fs.readFileSync(file, 'utf8')
				const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(source)
				const rawPatterns = frontmatter.paths ?? frontmatter.globs
				const patterns = Array.isArray(rawPatterns)
					? rawPatterns.filter((item): item is string => typeof item === 'string')
					: typeof rawPatterns === 'string'
						? rawPatterns.split(',').map((item) => item.trim()).filter(Boolean)
						: []
				rules.push({
					absolutePath: file,
					relativePath: path.relative(cwd, file),
					patterns,
					always: frontmatter.alwaysApply === true || patterns.length === 0,
					body: body.trim(),
				})
			} catch {}
		}
	}
	return rules
}

function normalizeRelative(cwd: string, file: string): string {
	const withoutAt = file.replace(/^@/, '')
	const absolute = path.isAbsolute(withoutAt) ? withoutAt : path.resolve(cwd, withoutAt)
	const relative = path.relative(cwd, absolute)
	return relative.split(path.sep).join('/')
}

function matchingRules(rules: RuleFile[], cwd: string, file: string): RuleFile[] {
	const relative = normalizeRelative(cwd, file)
	if (relative.startsWith('../')) return []
	return rules.filter((rule) =>
		rule.always || rule.patterns.some((pattern) => minimatch(relative, pattern.replace(/^\.\//, ''), { dot: true })),
	)
}

function toolToClaudeName(toolName: string): string {
	return ({ read: 'Read', write: 'Write', edit: 'Edit', bash: 'Bash', grep: 'Grep', find: 'Glob' } as Record<string, string>)[toolName] ?? toolName
}

function hookMatches(matcher: string | undefined, toolName: string): boolean {
	if (!matcher || matcher === '*') return true
	try {
		return new RegExp(`^(?:${matcher})$`).test(toolName)
	} catch {
		return matcher === toolName
	}
}

function toClaudeInput(toolName: string, input: Record<string, unknown>): Record<string, unknown> {
	const translated: Record<string, unknown> = { ...input }
	if (typeof input.path === 'string') {
		translated.file_path = input.path
		translated.filePath = input.path
	}
	if (toolName === 'edit' && Array.isArray(input.edits)) {
		const edits = input.edits as Array<{ oldText?: string; newText?: string }>
		translated.edits = edits.map((edit) => ({ old_string: edit.oldText, new_string: edit.newText }))
		if (edits.length === 1) {
			translated.old_string = edits[0].oldText
			translated.new_string = edits[0].newText
		}
	}
	return translated
}

async function runCommandHook(
	hook: ClaudeHook,
	cwd: string,
	payload: Record<string, unknown>,
): Promise<HookResult> {
	return new Promise((resolve) => {
		const child = spawn('/bin/bash', ['-lc', hook.command ?? ''], {
			cwd,
			env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
			stdio: ['pipe', 'pipe', 'pipe'],
		})
		let stdout = ''
		let stderr = ''
		child.stdout.on('data', (data) => (stdout += data.toString()))
		child.stderr.on('data', (data) => (stderr += data.toString()))
		child.on('error', (error) => resolve({ stdout, stderr: `${stderr}${error.message}`, code: 1 }))
		child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 0 }))
		child.stdin.end(JSON.stringify(payload))
		const timeout = setTimeout(() => child.kill('SIGTERM'), (hook.timeout ?? 30) * 1000)
		child.on('close', () => clearTimeout(timeout))
	})
}

function parseHookDecision(output: string): { decision?: string; reason?: string } {
	const candidates = [output.trim(), ...output.trim().split('\n').reverse()]
	for (const candidate of candidates) {
		try {
			const parsed = JSON.parse(candidate)
			const specific = parsed.hookSpecificOutput ?? parsed
			const decision = specific.permissionDecision ?? specific.decision ?? parsed.decision
			const reason = specific.permissionDecisionReason ?? specific.reason ?? parsed.reason
			if (decision || reason) return { decision, reason }
		} catch {}
	}
	return {}
}

function permissionPathBlocked(settings: ClaudeSettings[], kind: 'Read' | 'Edit', cwd: string, file: string): string | undefined {
	const relative = normalizeRelative(cwd, file)
	const candidates = [relative, `./${relative}`, path.resolve(cwd, file)]
	for (const rule of settings.flatMap((setting) => setting.permissions?.deny ?? [])) {
		const match = rule.match(/^(Read|Edit)\((.*)\)$/)
		if (!match || match[1] !== kind) continue
		if (candidates.some((candidate) => minimatch(candidate, match[2], { dot: true, matchBase: true }))) return rule
	}
	return undefined
}

function permissionCommandBlocked(settings: ClaudeSettings[], command: string): string | undefined {
	if (/(^|[^\w])\.envrc([^\w]|$)/.test(command)) return 'Access to .envrc is blocked by Claude project policy.'
	for (const rule of settings.flatMap((setting) => setting.permissions?.deny ?? [])) {
		const match = rule.match(/^Bash\((.*)\)$/)
		if (match && minimatch(command, match[1], { dot: true })) return rule
	}
	return undefined
}

async function whileHerdrBlocked<T>(pi: ExtensionAPI, label: string, run: () => Promise<T>): Promise<T> {
	pi.events.emit('herdr:blocked', { active: true, label })
	try {
		return await run()
	} finally {
		pi.events.emit('herdr:blocked', { active: false })
	}
}

async function confirmIfNeeded(pi: ExtensionAPI, ctx: ExtensionContext, title: string, reason: string): Promise<boolean> {
	if (!ctx.hasUI) return false
	return whileHerdrBlocked(pi, title, () => ctx.ui.confirm(title, reason))
}

function securityReviewReason(
	toolName: string,
	input: Record<string, unknown>,
	cwd: string,
	writeTrusted: (file: string) => boolean = isCompatWriteTrusted,
): string | undefined {
	const file = typeof input.path === 'string' ? path.resolve(cwd, input.path) : undefined
	if (file && isSensitivePath(file)) return `Sensitive path access: ${file}`
	if (file && (toolName === 'write' || toolName === 'edit')) {
		const relative = path.relative(cwd, file)
		if ((relative.startsWith('..') || path.isAbsolute(relative)) && !writeTrusted(file)) return `Write outside the project root: ${file}`
	}
	if (toolName === 'bash') {
		const command = String(input.command ?? '')
		return suspiciousCommandPatterns.find(({ pattern }) => pattern.test(command))?.reason
	}
	return undefined
}

const QuestionOption = Type.Object({
	label: Type.String(),
	description: Type.Optional(Type.String()),
})

const QuestionParams = Type.Object({
	question: Type.String(),
	options: Type.Optional(Type.Array(QuestionOption)),
})

const ClaudeQuestionParams = Type.Object({
	questions: Type.Optional(Type.Array(Type.Object({
		question: Type.String(),
		header: Type.Optional(Type.String()),
		options: Type.Optional(Type.Array(QuestionOption)),
		multiSelect: Type.Optional(Type.Boolean()),
	}))),
	question: Type.Optional(Type.String()),
	header: Type.Optional(Type.String()),
	options: Type.Optional(Type.Array(QuestionOption)),
	multiSelect: Type.Optional(Type.Boolean()),
})

async function askOne(pi: ExtensionAPI, ctx: ExtensionContext, question: string, options?: Array<{ label: string; description?: string }>): Promise<string | undefined> {
	if (!ctx.hasUI) return undefined
	return whileHerdrBlocked(pi, 'Waiting for user input', async () => {
		if (options && options.length > 0) {
			const values = options.map((option) => option.description ? `${option.label} — ${option.description}` : option.label)
			const answer = await ctx.ui.select(question, [...values, 'Other…'])
			if (answer === 'Other…') return ctx.ui.input(question)
			return answer?.split(' — ')[0]
		}
		return ctx.ui.input(question)
	})
}

async function askMany(pi: ExtensionAPI, ctx: ExtensionContext, prompt: string, item: ClaudeQuestion): Promise<string[] | undefined> {
	if (!ctx.hasUI) return undefined
	return whileHerdrBlocked(pi, 'Waiting for user input', async () => {
		if (!item.options?.length) {
			const answer = await ctx.ui.input(prompt)
			return answer ? [answer] : undefined
		}
		const selected = new Set<string>()
		while (true) {
			const choices = item.options.map((option) => `${selected.has(option.label) ? '✓' : '○'} ${option.label}${option.description ? ` — ${option.description}` : ''}`)
			const choice = await ctx.ui.select(prompt, [...choices, 'Done', 'Other…'])
			const resolved = resolveMultiSelectAnswer(choice, selected)
			if (resolved !== null) return resolved
			if (choice === 'Other…') {
				const custom = await ctx.ui.input(prompt)
				if (custom) selected.add(custom)
				continue
			}
			const label = choice.replace(/^[✓○] /, '').split(' — ')[0]
			if (selected.has(label)) selected.delete(label); else selected.add(label)
		}
	})
}

export default function claudeCompat(pi: ExtensionAPI): void {
	let cwd = process.cwd()
	let trusted = false
	let settings: ClaudeSettings[] = []
	let hookSettings: ClaudeSettings[] = []
	let rules: RuleFile[] = []
	const loadedRules = new Set<string>()

	pi.registerCommand('claude-compat', {
		description: 'Show Claude Code compatibility status for this project',
		handler: async (_args, ctx) => {
			const skillCount = findFiles(path.join(cwd, '.claude', 'skills'), 'SKILL.md').length
			const hookCount = hookSettings.flatMap((setting) => Object.values(setting.hooks ?? {})).flatMap((groups) => groups).flatMap((group) => group.hooks ?? []).filter((hook) => hook.type === 'command').length
			ctx.ui.notify([
				`Claude project trusted: ${trusted ? 'yes' : 'no'}`,
				`Skills: ${skillCount}`,
				`Rules: ${rules.length} (${rules.filter((rule) => rule.always).length} always-on)` ,
				`Command hooks: ${hookCount}`,
			].join('\n'), trusted ? 'info' : 'warning')
		},
	})

	pi.registerTool({
		name: 'question',
		label: 'Question',
		description: 'Ask the user one clarifying question, with optional choices.',
		parameters: QuestionParams,
		executionMode: 'sequential',
		async execute(_id, params, _signal, _update, ctx) {
			const answer = await askOne(pi, ctx, params.question, params.options)
			return { content: [{ type: 'text', text: answer ? `User answered: ${answer}` : 'User cancelled the question.' }], details: { answer } }
		},
	})

	pi.registerTool({
		name: 'AskUserQuestion',
		label: 'Ask User Question',
		description: 'Claude Code compatible structured question tool.',
		parameters: ClaudeQuestionParams,
		prepareArguments: normalizeQuestionArguments as any,
		executionMode: 'sequential',
		async execute(_id, rawParams, _signal, _update, ctx) {
			const params = normalizeQuestionArguments(rawParams)
			const answers: Record<string, string | string[]> = {}
			for (const item of params.questions) {
				const prompt = item.header ? `${item.header}: ${item.question}` : item.question
				const answer = item.multiSelect ? await askMany(pi, ctx, prompt, item) : await askOne(pi, ctx, prompt, item.options)
				if (answer !== undefined) answers[item.question] = answer
			}
			return { content: [{ type: 'text', text: JSON.stringify({ answers }, null, 2) }], details: { answers } }
		},
	})

	pi.on('session_start', async (_event, ctx) => {
		cwd = ctx.cwd
		trusted = !projectHasClaudeConfig(cwd) || isCompatTrusted(cwd)
		if (!trusted && ctx.hasUI) {
			trusted = await confirmIfNeeded(pi, ctx, 'Load Claude Code project setup?', `Allow Pi to load skills, rules, hooks, agents, and MCP config from:\n${cwd}`)
			if (trusted) saveCompatTrust(cwd)
		}
		settings = loadSettings(cwd, trusted)
		hookSettings = loadProjectSettings(cwd, trusted)
		rules = loadRules(cwd, trusted)
		loadedRules.clear()
		for (const rule of rules.filter((candidate) => candidate.always)) loadedRules.add(rule.absolutePath)
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type !== 'message' || entry.message.role !== 'toolResult') continue
			const details = entry.message.details as { claudeRulesLoaded?: string[] } | undefined
			for (const rulePath of details?.claudeRulesLoaded ?? []) loadedRules.add(rulePath)
		}
		for (const group of hookSettings.flatMap((setting) => setting.hooks?.SessionStart ?? [])) {
			for (const hook of group.hooks ?? []) {
				if (hook.type === 'command' && hook.command) void runCommandHook(hook, cwd, { hook_event_name: 'SessionStart' })
			}
		}
	})

	pi.on('resources_discover', async () => {
		if (!trusted) return
		const skills = path.join(cwd, '.claude', 'skills')
		return fs.existsSync(skills) ? { skillPaths: [skills] } : undefined
	})

	pi.on('before_agent_start', async (event) => {
		if (!trusted || rules.length === 0) return
		const always = rules.filter((rule) => rule.always)
		const conditional = rules.filter((rule) => !rule.always)
		const alwaysText = always.map((rule) => `\n### ${rule.relativePath}\n${rule.body}`).join('\n')
		const catalog = conditional.map((rule) => `- ${rule.relativePath}: ${rule.patterns.join(', ')}`).join('\n')
		return {
			systemPrompt: `${event.systemPrompt}\n\n## Claude Code project rules compatibility\nThe always-on project rules follow.${alwaysText}\n\nPath-specific rules are available below. Pi automatically attaches them when reading a matching file and blocks edits until matching rules are loaded.\n${catalog}`,
		}
	})

	pi.on('input', async (event) => {
		if (!event.text.startsWith('/') || event.text.startsWith('/skill:')) return { action: 'continue' as const }
		const match = event.text.match(/^\/([^\s]+)(.*)$/s)
		if (!match) return { action: 'continue' as const }
		const alias = `skill:${match[1]}`
		if (pi.getCommands().some((command) => command.name === alias)) {
			return { action: 'transform' as const, text: `/${alias}${match[2]}` }
		}
		return { action: 'continue' as const }
	})

	pi.on('tool_call', async (event, ctx) => {
		const input = event.input as Record<string, unknown>
		const claudeToolName = toolToClaudeName(event.toolName)
		const file = typeof input.path === 'string' ? input.path : undefined

		if (file && event.toolName === 'read') {
			const blocked = permissionPathBlocked(settings, 'Read', cwd, file)
			if (blocked) return { block: true, reason: `Blocked by Claude permission rule: ${blocked}` }
		}
		if (file && (event.toolName === 'write' || event.toolName === 'edit')) {
			const blocked = permissionPathBlocked(settings, 'Edit', cwd, file)
			if (blocked) return { block: true, reason: `Blocked by Claude permission rule: ${blocked}` }
			const missing = matchingRules(rules, cwd, file).filter((rule) => !loadedRules.has(rule.absolutePath))
			if (missing.length > 0) {
				return { block: true, reason: `Read the matching project rules before editing ${file}:\n${missing.map((rule) => `- ${rule.relativePath}`).join('\n')}` }
			}
		}
		let confirmation: { title: string; reason: string } | undefined
		if (event.toolName === 'bash') {
			const command = String(input.command ?? '')
			const blocked = permissionCommandBlocked(settings, command)
			if (blocked) return { block: true, reason: blocked }
			if (requiresDestructiveConfirmation(command, cwd, isCompatDeleteTrusted)) confirmation = { title: 'Confirm destructive command', reason: command }
		}
		const securityReason = securityReviewReason(event.toolName, input, cwd)
		if (!confirmation && securityReason) confirmation = { title: 'Security review', reason: securityReason }
		if (confirmation) {
			const approved = await confirmIfNeeded(pi, ctx, confirmation.title, confirmation.reason)
			if (!approved) return { block: true, reason: `${confirmation.title} was not approved: ${confirmation.reason}` }
		}

		const payload = {
			hook_event_name: 'PreToolUse',
			tool_name: claudeToolName,
			tool_input: toClaudeInput(event.toolName, input),
			cwd,
		}
		for (const group of hookSettings.flatMap((setting) => setting.hooks?.PreToolUse ?? [])) {
			if (!hookMatches(group.matcher, claudeToolName)) continue
			for (const hook of group.hooks ?? []) {
				if (hook.type !== 'command' || !hook.command) continue
				const result = await runCommandHook(hook, cwd, payload)
				const decision = parseHookDecision(result.stdout)
				if (decision.decision === 'deny') return { block: true, reason: decision.reason ?? 'Blocked by Claude PreToolUse hook.' }
				if (decision.decision === 'ask') {
					const ok = await confirmIfNeeded(pi, ctx, 'Claude hook requires confirmation', decision.reason ?? hook.command)
					if (!ok) return { block: true, reason: decision.reason ?? 'Claude hook was not approved.' }
				}
				if (result.code !== 0) return { block: true, reason: result.stderr || `Claude hook failed: ${hook.command}` }
			}
		}
	})

	pi.on('tool_result', async (event) => {
		const input = event.input as Record<string, unknown>
		const extraContent: Array<{ type: 'text'; text: string }> = []
		const rulePaths: string[] = []
		if (event.toolName === 'read' && typeof input.path === 'string') {
			const matched = matchingRules(rules, cwd, input.path).filter((rule) => !loadedRules.has(rule.absolutePath))
			for (const rule of matched) {
				loadedRules.add(rule.absolutePath)
				rulePaths.push(rule.absolutePath)
				extraContent.push({ type: 'text', text: `[Auto-loaded project rule: ${rule.relativePath}]\n\n${rule.body}` })
			}
			const directRule = rules.find((rule) => path.resolve(cwd, String(input.path)) === rule.absolutePath)
			if (directRule) {
				loadedRules.add(directRule.absolutePath)
				rulePaths.push(directRule.absolutePath)
			}
		}

		const claudeToolName = toolToClaudeName(event.toolName)
		const payload = {
			hook_event_name: 'PostToolUse',
			tool_name: claudeToolName,
			tool_input: toClaudeInput(event.toolName, input),
			tool_response: event.content,
			cwd,
		}
		for (const group of hookSettings.flatMap((setting) => setting.hooks?.PostToolUse ?? [])) {
			if (!hookMatches(group.matcher, claudeToolName)) continue
			for (const hook of group.hooks ?? []) {
				if (hook.type !== 'command' || !hook.command) continue
				if (hook.async) {
					void runCommandHook(hook, cwd, payload).then((result) => {
						const decision = parseHookDecision(result.stdout)
						const text = decision.reason ?? (result.stdout.trim().startsWith('{') ? '' : result.stdout.trim())
						if (text) pi.sendMessage({ customType: 'claude-hook', content: text, display: true }, { triggerTurn: true, deliverAs: 'steer' })
					})
				} else {
					const result = await runCommandHook(hook, cwd, payload)
					const decision = parseHookDecision(result.stdout)
					const text = decision.reason ?? (result.stdout.trim().startsWith('{') ? '' : result.stdout.trim())
					if (text) extraContent.push({ type: 'text', text: `[Claude PostToolUse hook]\n${text}` })
				}
			}
		}

		if (extraContent.length === 0 && rulePaths.length === 0) return
		return {
			content: [...event.content, ...extraContent],
			details: { ...(event.details as Record<string, unknown> ?? {}), claudeRulesLoaded: rulePaths },
		}
	})

	pi.on('session_shutdown', async () => {
		for (const group of hookSettings.flatMap((setting) => setting.hooks?.SessionEnd ?? [])) {
			for (const hook of group.hooks ?? []) {
				if (hook.type === 'command' && hook.command) await runCommandHook(hook, cwd, { hook_event_name: 'SessionEnd', cwd })
			}
		}
	})
}
