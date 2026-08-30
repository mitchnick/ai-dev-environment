import fs from 'node:fs'
import path from 'node:path'

/** Finds project agents only at roots that independently pass the trust boundary. */
export function nearestTrustedProjectAgentDirs(cwd: string, trustedRoot: (candidate: string) => boolean): string[] {
	let current = path.resolve(cwd)
	while (true) {
		if (trustedRoot(current)) {
			const dirs = [path.join(current, '.pi', 'agents'), path.join(current, '.claude', 'agents')].filter((dir) => {
				try { return fs.statSync(dir).isDirectory() } catch { return false }
			})
			if (dirs.length > 0) return dirs
		}
		const parent = path.dirname(current)
		if (parent === current) return []
		current = parent
	}
}
