export type AgentInvocation = { agent?: string; task?: string; cwd?: string }
export type AgentMode = 'single' | 'parallel' | 'chain'

type AliasInvocation = AgentInvocation & { subagent_type?: unknown; prompt?: unknown; description?: unknown }
type AgentArguments = AgentInvocation & { tasks?: unknown; chain?: unknown }

function normalizeItem(value: unknown): AgentInvocation {
	const item = (value && typeof value === 'object' ? value : {}) as AliasInvocation
	return {
		agent: typeof item.agent === 'string' ? item.agent : typeof item.subagent_type === 'string' ? item.subagent_type : undefined,
		task: typeof item.task === 'string' ? item.task : typeof item.prompt === 'string' ? item.prompt : undefined,
		cwd: typeof item.cwd === 'string' ? item.cwd : undefined,
	}
}

export function isValidAgentInvocation(value: unknown): value is Required<Pick<AgentInvocation, 'agent' | 'task'>> & AgentInvocation {
	return Boolean(value && typeof value === 'object' && typeof (value as AgentInvocation).agent === 'string' && (value as AgentInvocation).agent && typeof (value as AgentInvocation).task === 'string' && (value as AgentInvocation).task)
}

/** Validates normalized modes before callers dereference invocation fields. */
export function validateAgentArguments(value: unknown): { valid: boolean; mode?: AgentMode } {
	const args = (value && typeof value === 'object' ? value : {}) as AgentArguments
	const hasChain = Array.isArray(args.chain) && args.chain.length > 0
	const hasTasks = Array.isArray(args.tasks) && args.tasks.length > 0
	const hasSingle = isValidAgentInvocation(args)
	if (Number(hasChain) + Number(hasTasks) + Number(hasSingle) !== 1) return { valid: false }
	if (hasChain) return { valid: (args.chain as unknown[]).every(isValidAgentInvocation), mode: 'chain' }
	if (hasTasks) return { valid: (args.tasks as unknown[]).every(isValidAgentInvocation), mode: 'parallel' }
	return { valid: true, mode: 'single' }
}

/** Normalizes Claude's subagent_type/prompt syntax without overriding Pi's canonical fields. Description remains metadata. */
export function normalizeAgentArguments(value: unknown): Record<string, unknown> {
	const raw = (value && typeof value === 'object' ? value : {}) as AliasInvocation & { tasks?: unknown; chain?: unknown }
	const single = normalizeItem(raw)
	return {
		...raw,
		...single,
		tasks: Array.isArray(raw.tasks) ? raw.tasks.map(normalizeItem) : raw.tasks,
		chain: Array.isArray(raw.chain) ? raw.chain.map(normalizeItem) : raw.chain,
	}
}
