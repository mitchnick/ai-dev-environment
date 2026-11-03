import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

// Names the Herdr app pane and tab after a chat's first message. The work is
// in herdr-app-autoname (herdr-app/bin), shared with the Claude Code and Codex
// hooks; this only hands it the same hook events they send.
const script = join(homedir(), '.local', 'bin', 'herdr-app-autoname')

function send(payload: Record<string, unknown>): void {
	if (!process.env.HC_TERMINAL_ID || process.env.PI_SUBAGENT === '1') return
	try {
		const child = spawn(script, ['hook', 'pi'], { stdio: ['pipe', 'ignore', 'ignore'] })
		child.on('error', () => {})
		child.stdin.on('error', () => {})
		child.stdin.end(JSON.stringify(payload))
	} catch {
		// Names are cosmetic: never disturb the agent.
	}
}

export default function (pi: ExtensionAPI): void {
	pi.on('session_start', (event, ctx) => {
		if (ctx.mode !== 'tui' || event.reason === 'reload') return
		const sm = ctx.sessionManager
		// `pi -c` starts up into an old chat: that is a resume, not a new chat.
		const used = sm.getEntries().some((e) => e.type === 'message' && e.message?.role === 'user')
		send({
			hook_event_name: 'SessionStart',
			session_id: sm.getSessionId(),
			source: used || event.reason === 'resume' || event.reason === 'fork' ? 'resume' : 'startup',
			cwd: sm.getCwd(),
		})
	})

	pi.on('before_agent_start', (event, ctx) => {
		if (ctx.mode !== 'tui' || event.messageType !== 'user') return
		const sm = ctx.sessionManager
		send({
			hook_event_name: 'UserPromptSubmit',
			session_id: sm.getSessionId(),
			prompt: event.prompt,
			cwd: sm.getCwd(),
		})
	})
}
