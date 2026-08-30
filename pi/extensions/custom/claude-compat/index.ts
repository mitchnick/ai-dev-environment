import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import claudeCompat from './claude.ts'
import mcpCompat from './mcp.ts'
import agentCompat from './subagent/index.ts'
import planMode from './plan-mode/index.ts'
import webCompat from './web.ts'

export default function claudeCodeCompatibility(pi: ExtensionAPI): void {
	claudeCompat(pi)
	mcpCompat(pi)
	agentCompat(pi)
	webCompat(pi)
	planMode(pi)
}
