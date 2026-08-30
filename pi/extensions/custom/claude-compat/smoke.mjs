#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

const cwd = process.argv[2] ?? process.cwd()
const input = [
	{ type: 'get_commands' },
	{ type: 'prompt', message: '/claude-compat' },
	{ type: 'prompt', message: '/claude-agents' },
	{ type: 'prompt', message: '/mcp' },
	{ type: 'prompt', message: '/plan' },
].map((value) => JSON.stringify(value)).join('\n') + '\n'

const run = spawnSync('pi', ['--mode', 'rpc', '--no-session'], {
	cwd,
	input,
	encoding: 'utf8',
	maxBuffer: 20_000_000,
	timeout: 120_000,
})

if (run.status !== 0) {
	console.error(run.stderr || `Pi exited with ${run.status}`)
	process.exit(run.status ?? 1)
}

const events = run.stdout.trim().split('\n').map((line) => {
	try { return JSON.parse(line) } catch { return undefined }
}).filter(Boolean)
const commandResponse = events.find((event) => event.type === 'response' && event.command === 'get_commands')
const commands = new Set((commandResponse?.data?.commands ?? []).map((command) => command.name))
const required = ['claude-compat', 'claude-agents', 'mcp', 'mcp-auth', 'plan', 'plan-todos']
const missing = required.filter((name) => !commands.has(name))
const extensionErrors = events.filter((event) => event.type === 'extension_error')
const notices = events.filter((event) => event.type === 'extension_ui_request' && event.method === 'notify').map((event) => event.message).filter(Boolean)

console.log(`cwd: ${cwd}`)
console.log(`commands: ${commands.size}`)
console.log(`required commands: ${missing.length === 0 ? 'ok' : `missing ${missing.join(', ')}`}`)
console.log(`extension errors: ${extensionErrors.length}`)
for (const notice of notices) console.log(`- ${String(notice).split('\n')[0]}`)

if (!commandResponse?.success || missing.length > 0 || extensionErrors.length > 0) process.exit(1)
