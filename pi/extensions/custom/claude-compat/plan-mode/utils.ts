/**
 * Pure utility functions for plan mode.
 * Extracted for testability.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface ContextLoaderCommandOptions {
	childIdentity?: string;
	projectCwd?: string;
	trusted?: boolean;
	qmdInstructionsReady?: boolean;
}

const SHELL_COMPOSITION = /[\n\r;|&<>`]|\$\(|\$\{/;

/** Exact qmd-search invocation; quoted query intentionally excludes shell escapes/substitutions. */
export function isContextLoaderCommand(command: string, options: ContextLoaderCommandOptions): boolean {
	if (options.childIdentity !== 'context-loader' || !options.trusted || !options.qmdInstructionsReady || !options.projectCwd) return false;
	if (SHELL_COMPOSITION.test(command)) return false;
	const match = command.match(/^\s*(\.claude\/scripts\/qmd-search\.sh)\s+(instructions|references|handoffs)\s+(['"])([^'"\\]+)\3(?:\s+([1-9]\d?))?\s*$/);
	if (!match) return false;
	try {
		const resolved = path.resolve(options.projectCwd, match[1]);
		const expected = path.resolve(options.projectCwd, '.claude/scripts/qmd-search.sh');
		const realProject = fs.realpathSync(options.projectCwd);
		const realScript = fs.realpathSync(resolved);
		return realScript === fs.realpathSync(expected) && realScript.startsWith(`${realProject}${path.sep}`);
	} catch { return false; }
}

export function isSafeCommand(command: string, options: ContextLoaderCommandOptions = {}): boolean {
	// Plan-mode Bash fails closed. Pi's read/grep/find/ls tools cover ordinary inspection.
	if (SHELL_COMPOSITION.test(command)) return false;
	return isContextLoaderCommand(command, options);
}

export interface TodoItem {
	step: number;
	text: string;
	completed: boolean;
}

export function cleanStepText(text: string): string {
	let cleaned = text
		.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1") // Remove bold/italic
		.replace(/`([^`]+)`/g, "$1") // Remove code
		.replace(
			/^(Use|Run|Execute|Create|Write|Read|Check|Verify|Update|Modify|Add|Remove|Delete|Install)\s+(the\s+)?/i,
			"",
		)
		.replace(/\s+/g, " ")
		.trim();

	if (cleaned.length > 0) {
		cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
	}
	if (cleaned.length > 50) {
		cleaned = `${cleaned.slice(0, 47)}...`;
	}
	return cleaned;
}

export function extractTodoItems(message: string): TodoItem[] {
	const items: TodoItem[] = [];
	const headerMatch = message.match(/\*{0,2}Plan:\*{0,2}\s*\n/i);
	if (!headerMatch) return items;

	const planSection = message.slice(message.indexOf(headerMatch[0]) + headerMatch[0].length);
	const numberedPattern = /^\s*(\d+)[.)]\s+\*{0,2}([^*\n]+)/gm;

	for (const match of planSection.matchAll(numberedPattern)) {
		const text = match[2]
			.trim()
			.replace(/\*{1,2}$/, "")
			.trim();
		if (text.length > 5 && !text.startsWith("`") && !text.startsWith("/") && !text.startsWith("-")) {
			const cleaned = cleanStepText(text);
			if (cleaned.length > 3) {
				items.push({ step: items.length + 1, text: cleaned, completed: false });
			}
		}
	}
	return items;
}

export function extractDoneSteps(message: string): number[] {
	const steps: number[] = [];
	for (const match of message.matchAll(/\[DONE:(\d+)\]/gi)) {
		const step = Number(match[1]);
		if (Number.isFinite(step)) steps.push(step);
	}
	return steps;
}

export function markCompletedSteps(text: string, items: TodoItem[]): number {
	const doneSteps = extractDoneSteps(text);
	for (const step of doneSteps) {
		const item = items.find((t) => t.step === step);
		if (item) item.completed = true;
	}
	return doneSteps.length;
}
