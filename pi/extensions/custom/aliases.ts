import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

export default function commandAliases(pi: ExtensionAPI) {
	pi.registerCommand('exit', {
		description: 'Exit Pi (alias for /quit)',
		handler: async (_args, ctx) => {
			ctx.shutdown()
		},
	})
}
