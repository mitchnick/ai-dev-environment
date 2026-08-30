import {
	CustomEditor,
	type EditorFactory,
	type ExtensionAPI,
	type KeybindingsManager,
} from '@earendil-works/pi-coding-agent'
import {
	CURSOR_MARKER,
	type EditorTheme,
} from '@earendil-works/pi-tui'
import {
	decorateEditorRender,
} from './active-pane-ui/render.ts'
import {
	queryHerdrPaneFocus,
	watchHerdrPaneFocus,
} from './active-pane-ui/herdr-focus.ts'

export default function activePaneCursor(pi: ExtensionAPI): void {
	let disposeSession: (() => void) | undefined
	let sessionGeneration = 0

	pi.on('session_start', (_event, ctx) => {
		if (ctx.mode !== 'tui') return

		disposeSession?.()
		const generation = ++sessionGeneration
		const sessionController = new AbortController()
		let disposed = false
		let installTimer: ReturnType<typeof setTimeout> | undefined
		let restoreEditor: (() => void) | undefined
		let stopFocusWatcher: (() => void) | undefined
		const dispose = () => {
			if (disposed) return
			disposed = true
			sessionController.abort()
			if (installTimer) clearTimeout(installTimer)
			installTimer = undefined
			stopFocusWatcher?.()
			stopFocusWatcher = undefined
			restoreEditor?.()
			restoreEditor = undefined
			if (disposeSession === dispose) disposeSession = undefined
		}
		disposeSession = dispose

		// Package extensions load after user extensions. Defer wrapping until their
		// session_start handlers have installed the final editor (notably pi-paster).
		installTimer = setTimeout(() => {
			installTimer = undefined
			void installEditorWrapper()
		}, 0)
		installTimer.unref?.()

		async function installEditorWrapper() {
			const paneId = process.env.HERDR_PANE_ID
			const socketPath = process.env.HERDR_SOCKET_PATH
			const herdr = process.env.HERDR_ENV === '1' && paneId && socketPath
				? { paneId, socketPath }
				: undefined
			const initialPaneFocus = herdr
				? await queryHerdrPaneFocus({
					...herdr,
					signal: sessionController.signal,
				}) ?? true
				: true
			if (disposed || generation !== sessionGeneration) return
			const previousFactory = ctx.ui.getEditorComponent()

			const wrapperFactory: EditorFactory = (tui, theme, keybindings) => {
				const editor = previousFactory?.(tui, theme, keybindings) ??
					new CustomEditor(
						tui,
						theme as EditorTheme,
						keybindings as KeybindingsManager,
					)
				let paneFocused = initialPaneFocus

				decorateEditorRender(editor, {
					cursorMarker: CURSOR_MARKER,
					isFocused: () => paneFocused,
					stylePrompt: (text) => ctx.ui.theme.fg('muted', text),
				})

				if (herdr) {
					stopFocusWatcher?.()
					stopFocusWatcher = watchHerdrPaneFocus({
						...herdr,
						onFocus: (focused) => {
							if (disposed || focused === paneFocused) return
							paneFocused = focused
							tui.requestRender(true)
						},
					})
				}

				return editor
			}

			ctx.ui.setEditorComponent(wrapperFactory)
			restoreEditor = () => {
				if (ctx.ui.getEditorComponent() === wrapperFactory) {
					ctx.ui.setEditorComponent(previousFactory)
				}
			}
		}
	})

	pi.on('session_shutdown', () => {
		sessionGeneration += 1
		disposeSession?.()
	})
}
