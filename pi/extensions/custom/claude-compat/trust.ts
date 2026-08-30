import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const TRUST_FILE = path.join(os.homedir(), '.pi', 'agent', 'claude-compat-trust.json')

interface CompatTrustConfig {
	trusted?: string[]
	trustedWriteRoots?: string[]
	trustedDeleteRoots?: string[]
}

export function readJson<T>(file: string): T | undefined {
	try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T } catch { return undefined }
}

export function realProjectPath(candidate: string): string {
	const absolute = path.resolve(candidate)
	try { return fs.realpathSync(absolute) } catch {}

	const suffix: string[] = []
	let existing = absolute
	while (!fs.existsSync(existing)) {
		const parent = path.dirname(existing)
		if (parent === existing) return absolute
		suffix.unshift(path.basename(existing))
		existing = parent
	}
	try { return path.join(fs.realpathSync(existing), ...suffix) } catch { return absolute }
}

/** True only when cwd is the trusted root itself or a real descendant (never a path-prefix sibling). */
export function isWithinTrustedRoot(project: string, trustedRoot: string): boolean {
	return project === trustedRoot || project.startsWith(`${trustedRoot}${path.sep}`)
}

export function isWithinTrustedRoots(candidate: string, trustedRoots: string[]): boolean {
	const target = realProjectPath(candidate)
	return trustedRoots.some((root) => isWithinTrustedRoot(target, realProjectPath(root)))
}

export function isCompatTrusted(cwd: string): boolean {
	const roots = readJson<CompatTrustConfig>(TRUST_FILE)?.trusted ?? []
	return isWithinTrustedRoots(cwd, roots)
}

export function isCompatWriteTrusted(file: string): boolean {
	const roots = readJson<CompatTrustConfig>(TRUST_FILE)?.trustedWriteRoots ?? []
	return isWithinTrustedRoots(file, roots)
}

export function isWithinTrustedDeleteRoots(candidate: string, trustedRoots: string[]): boolean {
	const target = realProjectPath(candidate)
	return trustedRoots.some((root) => {
		const trustedRoot = realProjectPath(root)
		return target !== trustedRoot && isWithinTrustedRoot(target, trustedRoot)
	})
}

export function isCompatDeleteTrusted(file: string): boolean {
	const roots = readJson<CompatTrustConfig>(TRUST_FILE)?.trustedDeleteRoots ?? []
	return isWithinTrustedDeleteRoots(file, roots)
}

export function saveCompatTrust(cwd: string): void {
	const project = realProjectPath(cwd)
	const current = readJson<CompatTrustConfig>(TRUST_FILE) ?? {}
	const trusted = [...new Set([...(current.trusted ?? []), project])]
	fs.mkdirSync(path.dirname(TRUST_FILE), { recursive: true })
	fs.writeFileSync(TRUST_FILE, `${JSON.stringify({ ...current, trusted }, null, 2)}\n`, { mode: 0o600 })
}

/** Checking for config is safe; reading or executing it is not. */
export function projectHasClaudeConfig(cwd: string): boolean {
	return fs.existsSync(path.join(cwd, '.claude')) || fs.existsSync(path.join(cwd, '.pi', 'agents')) || fs.existsSync(path.join(cwd, '.mcp.json'))
}
