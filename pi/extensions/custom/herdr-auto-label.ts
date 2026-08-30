import { spawn, spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

const script = join(homedir(), '.claude', 'bin', 'herdr-auto-label.py')

function enabled(): boolean {
	return (
		process.env.HERDR_ENV === '1' &&
		!!process.env.HERDR_PANE_ID &&
		process.env.PI_SUBAGENT !== '1'
	)
}

function invoke(action: 'launch' | 'reset', sessionId: string, prompt = ''): void {
	if (!enabled() || !sessionId) return

	try {
		const child = spawn('python3', [script, action, 'pi', sessionId], {
			stdio: ['pipe', 'ignore', 'ignore'],
		})
		child.on('error', () => {})
		child.stdin.on('error', () => {})
		child.stdin.end(prompt)
	} catch {
		// Pane labels are best-effort and must never disrupt the agent turn.
	}
}

function resetBeforeExit(sessionId: string): void {
	if (!enabled() || !sessionId) return

	try {
		spawnSync('python3', [script, 'reset', 'pi', sessionId], {
			stdio: 'ignore',
			timeout: 5000,
		})
	} catch {
		// Pane labels are best-effort and must never block shutdown.
	}
}

export default function (pi: ExtensionAPI): void {
	pi.on('session_start', (event, ctx) => {
		if (ctx.mode !== 'tui' || event.reason === 'reload') return
		invoke('reset', ctx.sessionManager.getSessionId())
	})

	pi.on('before_agent_start', (event, ctx) => {
		if (ctx.mode !== 'tui') return
		invoke('launch', ctx.sessionManager.getSessionId(), event.prompt)
	})

	pi.on('session_shutdown', (event, ctx) => {
		if (ctx.mode !== 'tui' || event.reason !== 'quit') return
		resetBeforeExit(ctx.sessionManager.getSessionId())
	})
}
