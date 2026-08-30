import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

export default function clearCommand(pi: ExtensionAPI) {
	pi.registerCommand('clear', {
		description: 'Clear the conversation and start a new session',
		handler: async (_args, ctx) => {
			await ctx.newSession()
		},
	})
}
