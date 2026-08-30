export interface ClaudeQuestion { question: string; header?: string; options?: Array<{ label: string; description?: string }>; multiSelect?: boolean }

/** Returns undefined only for cancel; Done deliberately preserves an empty selection. */
export function resolveMultiSelectAnswer(choice: string | undefined, selected: Iterable<string>): string[] | undefined | null {
	if (choice === undefined) return undefined
	if (choice === 'Done') return [...selected]
	return null
}

/** Accept canonical questions[] and the historical top-level one-question shorthand. */
export function normalizeQuestionArguments(value: unknown): { questions: ClaudeQuestion[] } {
	const raw = (value && typeof value === 'object' ? value : {}) as Partial<ClaudeQuestion> & { questions?: unknown }
	if (Array.isArray(raw.questions)) return { questions: raw.questions.filter((item): item is ClaudeQuestion => Boolean(item && typeof item === 'object' && typeof (item as ClaudeQuestion).question === 'string')) }
	return typeof raw.question === 'string' ? { questions: [{ question: raw.question, header: raw.header, options: raw.options, multiSelect: raw.multiSelect }] } : { questions: [] }
}
