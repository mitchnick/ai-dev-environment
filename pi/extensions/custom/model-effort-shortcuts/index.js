import { getSupportedThinkingLevels } from '@earendil-works/pi-ai'
import { Container, Input, SelectList, Text } from '@earendil-works/pi-tui'

// Pi ignores legacy Alt letters in Kitty mode, and never recognizes ESC E.
// Normalize complete key events only, never bracketed paste payloads.
export function normalizeEffortKey(data) {
	if (data === '\x1be') return { data: '\x1b[101;3u' }
	if (data === '\x1bE') return { data: '\x1b[101;4u' }
}

function modelKey(model) {
	return model ? `${model.provider}/${model.id}` : undefined
}

export function pickerModels(ctx) {
	const models = ctx.scopedModels.length
		? ctx.scopedModels.map(({ model }) => model)
		: ctx.modelRegistry.getAvailable()
	const unique = new Map(models.map((model) => [modelKey(model), model]))
	if (ctx.model) unique.set(modelKey(ctx.model), ctx.model)
	return [...unique.values()].sort((a, b) => {
		if (modelKey(a) === modelKey(ctx.model)) return -1
		if (modelKey(b) === modelKey(ctx.model)) return 1
		return modelKey(a).localeCompare(modelKey(b))
	})
}

export function selectItem(ctx, title, items, current) {
	return ctx.ui.custom((tui, theme, kb, done) => {
		const container = new Container()
		const input = new Input()
		container.addChild(new Text(theme.fg('accent', title), 1, 0))
		container.addChild(input)
		const list = new SelectList(items, Math.min(items.length, 8), {
			selectedPrefix: (s) => theme.fg('accent', s),
			selectedText: (s) => theme.fg('accent', s),
			description: (s) => theme.fg('muted', s),
			scrollInfo: (s) => theme.fg('dim', s),
			noMatch: (s) => theme.fg('warning', s),
		})
		list.setSelectedIndex(Math.max(0, items.findIndex((item) => item.value === current)))
		list.onSelect = (item) => done(item.value)
		list.onCancel = () => done(undefined)
		container.addChild(list)
		container.addChild(new Text(theme.fg('dim', 'Type to filter · ↑↓ select · Enter confirm · Esc cancel'), 1, 0))
		let query = ''
		return {
			get focused() { return input.focused },
			set focused(value) { input.focused = value },
			render: (width) => container.render(width),
			invalidate: () => container.invalidate(),
			handleInput(data) {
				if (['tui.select.up', 'tui.select.down', 'tui.select.pageUp', 'tui.select.pageDown', 'tui.select.confirm', 'tui.select.cancel'].some((key) => kb.matches(data, key))) {
					list.handleInput(data)
				} else {
					input.handleInput(data)
					const next = input.getValue()
					if (next !== query) {
						query = next
						list.setFilter(query)
					}
				}
				tui.requestRender()
			},
		}
	})
}

export default function modelEffortShortcuts(pi) {
	let pickerOpen = false
	let unsubscribe

	async function choose(ctx) {
		if (ctx.mode !== 'tui' || pickerOpen) return
		pickerOpen = true
		try {
			const models = pickerModels(ctx)
			if (!models.length) {
				ctx.ui.notify('No models available. Configure a provider with /login.', 'warning')
				return
			}
			const selected = await selectItem(ctx, 'Model and effort · 1/2: Model', models.map((model) => ({
				value: modelKey(model),
				label: modelKey(model),
				description: model.name,
			})), modelKey(ctx.model))
			const model = models.find((candidate) => modelKey(candidate) === selected)
			if (!model) return
			const levels = getSupportedThinkingLevels(model)
			const level = await selectItem(ctx, `Model and effort · 2/2: Effort for ${model.id}`, levels.map((value) => ({ value, label: value })), pi.getThinkingLevel())
			if (level === undefined) return
			// Neither dialog changes the editor or session. Cancel at either step
			// leaves the model, effort, draft, cursor, and attachments untouched.
			if (modelKey(model) !== modelKey(ctx.model) && !(await pi.setModel(model))) {
				ctx.ui.notify(`No credentials for ${model.provider}. Model unchanged.`, 'error')
				return
			}
			pi.setThinkingLevel(level)
			ctx.ui.notify(`Model: ${modelKey(model)} · Effort: ${pi.getThinkingLevel()}`, 'info')
		} catch (error) {
			ctx.ui.notify(`Model/effort selection failed: ${error.message ?? error}`, 'error')
		} finally {
			pickerOpen = false
		}
	}

	for (const key of ['alt+e', 'super+e']) {
		pi.registerShortcut(key, { description: 'Select model and effort', handler: choose })
	}
	pi.registerCommand('model-effort', {
		description: 'Select model and supported effort without changing the draft',
		handler: (_args, ctx) => choose(ctx),
	})
	pi.on('session_start', (_event, ctx) => {
		unsubscribe?.()
		if (ctx.mode === 'tui') unsubscribe = ctx.ui.onTerminalInput(normalizeEffortKey)
	})
	pi.on('session_shutdown', () => {
		unsubscribe?.()
		unsubscribe = undefined
	})
}
