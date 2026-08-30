import { describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isSensitivePath, requiresDestructiveConfirmation } from './security.ts'
import { isWithinTrustedDeleteRoots, isWithinTrustedRoot, isWithinTrustedRoots } from './trust.ts'
import { isSafeCommand } from './plan-mode/utils.ts'
import { normalizeQuestionArguments, resolveMultiSelectAnswer } from './questions.ts'
import { nearestTrustedProjectAgentDirs } from './subagent/discovery.ts'
import { normalizeAgentArguments, validateAgentArguments } from './subagent/normalize.ts'

describe('sensitive paths', () => {
	test('allows the standard environment template', () => {
		expect(isSensitivePath('/work/app/.env.example')).toBe(false)
	})

	test('continues to protect real environment files', () => {
		for (const file of ['/work/app/.env', '/work/app/.env.local', '/work/app/.env.production', '/work/app/.env.example.local']) {
			expect(isSensitivePath(file)).toBe(true)
		}
	})
})

describe('trust boundary', () => {
	test('does not trust path-prefix siblings', () => {
		expect(isWithinTrustedRoot('/work/app-two', '/work/app')).toBe(false)
		expect(isWithinTrustedRoot('/work/app/subdir', '/work/app')).toBe(true)
	})

	test('matches trusted write roots without matching path-prefix siblings', () => {
		const roots = ['/Users/example/Projects']
		expect(isWithinTrustedRoots('/Users/example/Projects/dotfiles/file', roots)).toBe(true)
		expect(isWithinTrustedRoots('/Users/example/Projects-two/file', roots)).toBe(false)
	})

	test('resolves existing symlink ancestors for new write targets', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-write-root-'))
		const trusted = path.join(root, 'trusted')
		const outside = path.join(root, 'outside')
		fs.mkdirSync(trusted)
		fs.mkdirSync(outside)
		fs.symlinkSync(outside, path.join(trusted, 'link'))
		expect(isWithinTrustedRoots(path.join(trusted, 'link', 'new-file'), [trusted])).toBe(false)
		fs.rmSync(root, { recursive: true, force: true })
	})

	test('trusts delete targets below a root but not the root itself', () => {
		expect(isWithinTrustedDeleteRoots('/tmp/pi-scratch/file', ['/tmp'])).toBe(true)
		expect(isWithinTrustedDeleteRoots('/tmp', ['/tmp'])).toBe(false)
		expect(isWithinTrustedDeleteRoots('/tmp-two/file', ['/tmp'])).toBe(false)
	})
})

describe('destructive command confirmation', () => {
	const deleteTrusted = (file: string) => isWithinTrustedDeleteRoots(file, ['/tmp'])

	test('skips confirmation for recursive deletes confined below trusted temporary roots', () => {
		for (const command of ['rm -rf /tmp/pi-scratch', 'rm -fr "/tmp/pi scratch"', '/bin/rm --recursive --force -- /tmp/pi-scratch', 'rm -rf tmp/card-ranks-before']) {
			expect(requiresDestructiveConfirmation(command, '/work/app', deleteTrusted)).toBe(false)
		}
	})

	test('allows project-local tmp cleanup inside a composed workflow', () => {
		const command = 'rm -rf tmp/card-ranks-before && node tmp/measure-card-ranks.cjs tmp/card-ranks-before > tmp/card-ranks-before.json && for f in tmp/card-ranks-before/*.png; do printf "%s\\n" "$(basename "$f")"; magic "$f"; done'
		expect(requiresDestructiveConfirmation(command, '/work/app', deleteTrusted)).toBe(false)
	})

	test('does not read recursive flags from rm operands', () => {
		for (const command of ['rm -f "$SCRATCH_DIR"/frame_*.jpg', 'rm -f scratch/frame.jpg']) {
			expect(requiresDestructiveConfirmation(command, '/work/app', deleteTrusted)).toBe(false)
		}
	})

	test('keeps confirmation for broad, mixed, ambiguous, or non-rm destructive commands', () => {
		for (const command of ['rm -rf /tmp', 'rm -rf tmp', 'rm -rf other/tmp/pi-scratch', 'rm -rf /tmp/pi-scratch /etc', 'rm -rf tmp/pi-scratch && rm -rf /', 'rm -rf /tmp/*', 'sudo rm -rf /tmp/pi-scratch', 'git reset --hard']) {
			expect(requiresDestructiveConfirmation(command, '/work/app', deleteTrusted)).toBe(true)
		}
	})
})

describe('plan shell restrictions', () => {
	test('rejects composition before allowlist matching', () => {
		for (const command of ['cat x; rm x', 'cat x | grep y', 'cat x > out', 'echo $(pwd)', 'echo `pwd`', 'cat x\nrm x']) expect(isSafeCommand(command)).toBe(false)
	})
	test('blocks ordinary Bash commands that were previously allowlisted', () => {
		for (const command of ['env sh -c "touch pwned"', "awk 'BEGIN { system(\"touch pwned\") }'", 'find . -fprint output', 'npm audit --fix', 'curl https://example.com/stateful', 'git log --output=output']) expect(isSafeCommand(command)).toBe(false)
	})
	test('allows only ready exact context-loader QMD command', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-qmd-'))
		fs.mkdirSync(path.join(root, '.claude/scripts'), { recursive: true })
		fs.writeFileSync(path.join(root, '.claude/scripts/qmd-search.sh'), '#!/bin/sh\n')
		const options = { childIdentity: 'context-loader', projectCwd: root, trusted: true, qmdInstructionsReady: true }
		expect(isSafeCommand(".claude/scripts/qmd-search.sh instructions 'find rules' 5", options)).toBe(true)
		expect(isSafeCommand(".claude/scripts/qmd-search.sh all 'find rules'", options)).toBe(false)
		expect(isSafeCommand(".claude/scripts/qmd-search.sh instructions 'find rules'; true", options)).toBe(false)
		expect(isSafeCommand(".claude/scripts/qmd-search.sh instructions 'find rules'", { ...options, qmdInstructionsReady: false })).toBe(false)
		fs.rmSync(root, { recursive: true, force: true })
	})
})

describe('argument normalization', () => {
	test('normalizes question shorthand without replacing canonical questions', () => {
		expect(normalizeQuestionArguments({ question: 'one' }).questions).toEqual([{ question: 'one', header: undefined, options: undefined, multiSelect: undefined }])
		expect(normalizeQuestionArguments({ question: 'ignored', questions: [{ question: 'canonical' }] }).questions).toEqual([{ question: 'canonical' }])
	})
	test('normalizes Agent aliases while canonical fields win', () => {
		const result = normalizeAgentArguments({ agent: 'pi', task: 'canonical', subagent_type: 'claude', prompt: 'alias', tasks: [{ subagent_type: 'child', prompt: 'work' }] })
		expect(result.agent).toBe('pi')
		expect(result.task).toBe('canonical')
		expect(result.tasks).toEqual([{ agent: 'child', task: 'work', cwd: undefined }])
	})
	test('does not treat description as a task and rejects malformed modes', () => {
		expect(normalizeAgentArguments({ agent: 'child', description: 'metadata' }).task).toBeUndefined()
		expect(validateAgentArguments(normalizeAgentArguments({ agent: 'child', description: 'metadata' }))).toEqual({ valid: false })
		expect(validateAgentArguments(normalizeAgentArguments({ tasks: [{ subagent_type: 'child' }] }))).toEqual({ valid: false, mode: 'parallel' })
		expect(validateAgentArguments(normalizeAgentArguments({ chain: ['malformed'] }))).toEqual({ valid: false, mode: 'chain' })
	})
})

describe('project agent discovery', () => {
	test('does not load an untrusted ancestor agent directory', () => {
		const ancestor = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-agents-'))
		const child = path.join(ancestor, 'trusted-child')
		fs.mkdirSync(path.join(ancestor, '.claude', 'agents'), { recursive: true })
		fs.mkdirSync(child)
		const trusted = (candidate: string) => candidate === child || candidate.startsWith(`${child}${path.sep}`)
		expect(nearestTrustedProjectAgentDirs(child, trusted)).toEqual([])
		fs.mkdirSync(path.join(child, '.claude', 'agents'), { recursive: true })
		expect(nearestTrustedProjectAgentDirs(child, trusted)).toEqual([path.join(child, '.claude', 'agents')])
		fs.rmSync(ancestor, { recursive: true, force: true })
	})
})

describe('multi-select selection state', () => {
	test('distinguishes cancel from Done with no selections', () => {
		expect(resolveMultiSelectAnswer(undefined, new Set(['one']))).toBeUndefined()
		expect(resolveMultiSelectAnswer('Done', new Set())).toEqual([])
	})
})
