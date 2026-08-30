import path from 'node:path'
import { isWithinTrustedDeleteRoots } from './trust.ts'

const safeEnvTemplatePatterns = [
	/(?:^|\/)\.env\.example$/i,
]

const sensitivePathPatterns = [
	/(?:^|\/)\.env(?:\.[^/]*)?$/i,
	/(?:^|\/)\.ssh(?:\/|$)/i,
	/(?:^|\/)\.aws(?:\/|$)/i,
	/(?:^|\/)\.config\/(?:gcloud|gh|op|1password)(?:\/|$)/i,
	/(?:^|\/)\.pi\/agent\/auth\.json$/i,
]

const recursiveDeletePattern = /\brm\s+(?:(?=-[^\s\n]*r)(?=-[^\s\n]*f)-[^\s\n]+|--recursive)(?=\s|$)/i

const otherDestructivePatterns = [
	/\bsudo\b/i,
	/\bgit\s+(reset\s+--hard|push\s+[^\n]*(--force|-f\b)|clean\s+-[^\n]*f)/i,
	/\b(db:(drop|reset|purge|truncate_all|migrate:reset)|DROP\s+(DATABASE|TABLE))\b/i,
]

export function isSensitivePath(file: string): boolean {
	if (safeEnvTemplatePatterns.some((pattern) => pattern.test(file))) return false
	return sensitivePathPatterns.some((pattern) => pattern.test(file))
}

function simpleShellClauses(command: string): string[] | undefined {
	const clauses: string[] = []
	let clause = ''
	let quote: "'" | '"' | undefined
	let escaped = false

	const finishClause = () => {
		const trimmed = clause.trim()
		if (trimmed) clauses.push(trimmed)
		clause = ''
	}

	for (let index = 0; index < command.length; index += 1) {
		const character = command[index]
		if (escaped) {
			clause += character
			escaped = false
			continue
		}
		if (character === '\\' && quote !== "'") {
			clause += character
			escaped = true
			continue
		}
		if (quote) {
			clause += character
			if (character === quote) quote = undefined
			continue
		}
		if (character === "'" || character === '"') {
			quote = character
			clause += character
			continue
		}
		if (character === ';' || character === '\n' || character === '&' || character === '|') {
			finishClause()
			if ((character === '&' || character === '|') && command[index + 1] === character) index += 1
			continue
		}
		clause += character
	}

	if (escaped || quote) return undefined
	finishClause()
	return clauses
}

function simpleShellWords(command: string): string[] | undefined {
	const words: string[] = []
	let word = ''
	let quote: "'" | '"' | undefined
	let escaped = false
	let started = false

	for (const character of command.trim()) {
		if (escaped) {
			word += character
			escaped = false
			started = true
			continue
		}
		if (character === '\\' && quote !== "'") {
			escaped = true
			started = true
			continue
		}
		if (quote) {
			if (character === quote) quote = undefined
			else {
				if (quote === '"' && (character === '$' || character === '`')) return undefined
				word += character
			}
			started = true
			continue
		}
		if (character === "'" || character === '"') {
			quote = character
			started = true
			continue
		}
		if (/\s/.test(character)) {
			if (started) words.push(word)
			word = ''
			started = false
			continue
		}
		if (';&|`$()<>*?[]{}'.includes(character)) return undefined
		word += character
		started = true
	}

	if (escaped || quote) return undefined
	if (started) words.push(word)
	return words
}

function isTrustedDeleteClause(
	command: string,
	cwd: string,
	deleteTrusted: (file: string) => boolean,
): boolean {
	const words = simpleShellWords(command)
	if (!words || !['rm', '/bin/rm', '/usr/bin/rm'].includes(words[0])) return false

	const operands: string[] = []
	let parsingOptions = true
	for (const word of words.slice(1)) {
		if (parsingOptions && word === '--') {
			parsingOptions = false
			continue
		}
		if (parsingOptions && word.startsWith('-') && word !== '-') continue
		parsingOptions = false
		operands.push(word)
	}

	const localTmpRoot = path.join(cwd, 'tmp')
	return operands.length > 0 && operands.every((operand) => {
		const target = path.resolve(cwd, operand)
		return deleteTrusted(target) || isWithinTrustedDeleteRoots(target, [localTmpRoot])
	})
}

export function isTrustedDeleteCommand(
	command: string,
	cwd: string,
	deleteTrusted: (file: string) => boolean,
): boolean {
	const clauses = simpleShellClauses(command)
	if (!clauses) return false
	const deleteClauses = clauses.filter((clause) => recursiveDeletePattern.test(clause))
	return deleteClauses.length > 0
		&& deleteClauses.every((clause) => isTrustedDeleteClause(clause, cwd, deleteTrusted))
}

export function requiresDestructiveConfirmation(
	command: string,
	cwd: string,
	deleteTrusted: (file: string) => boolean,
): boolean {
	if (otherDestructivePatterns.some((pattern) => pattern.test(command))) return true
	return recursiveDeletePattern.test(command)
		&& !isTrustedDeleteCommand(command, cwd, deleteTrusted)
}
