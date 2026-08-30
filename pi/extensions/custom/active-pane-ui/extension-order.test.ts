import { afterEach, describe, expect, mock, test } from 'bun:test'

type EditorFactory = (tui: any, theme: any, keybindings: any) => any

mock.module('@earendil-works/pi-coding-agent', () => ({
	CustomEditor: class {},
}))
mock.module('@earendil-works/pi-tui', () => ({
	CURSOR_MARKER: '<cursor-marker>',
}))

const originalHerdrEnv = process.env.HERDR_ENV
const originalPaneId = process.env.HERDR_PANE_ID
const originalSocketPath = process.env.HERDR_SOCKET_PATH

afterEach(() => {
	if (originalHerdrEnv === undefined) delete process.env.HERDR_ENV
	else process.env.HERDR_ENV = originalHerdrEnv
	if (originalPaneId === undefined) delete process.env.HERDR_PANE_ID
	else process.env.HERDR_PANE_ID = originalPaneId
	if (originalSocketPath === undefined) delete process.env.HERDR_SOCKET_PATH
	else process.env.HERDR_SOCKET_PATH = originalSocketPath
})

describe('active pane editor extension ordering', () => {
	test('wraps a package editor installed later, then restores it on shutdown', async () => {
		process.env.HERDR_ENV = '0'
		delete process.env.HERDR_PANE_ID
		delete process.env.HERDR_SOCKET_PATH

		const { default: activePaneCursor } = await import('../zz-active-pane-cursor.ts')
		const handlers = new Map<string, Array<(event: unknown, ctx: any) => void>>()
		const pi = {
			on(name: string, handler: (event: unknown, ctx: any) => void) {
				const registered = handlers.get(name) ?? []
				registered.push(handler)
				handlers.set(name, registered)
			},
		}
		activePaneCursor(pi as any)

		let editorFactory: EditorFactory | undefined
		const ctx = {
			mode: 'tui',
			ui: {
				getEditorComponent: () => editorFactory,
				setEditorComponent: (factory: EditorFactory | undefined) => {
					editorFactory = factory
				},
				theme: { fg: (_color: string, text: string) => text },
			},
		}
		const packageFactory: EditorFactory = () => ({
			attachmentFeature: true,
			invalidate() {},
			render: () => ['────', '  <cursor-marker>\x1b[7m \x1b[0m', '────'],
		})

		handlers.get('session_start')![0]!({}, ctx)
		ctx.ui.setEditorComponent(packageFactory)
		await Bun.sleep(10)

		expect(editorFactory).not.toBe(packageFactory)
		const editor = editorFactory!({}, {}, {})
		expect(editor.attachmentFeature).toBe(true)
		expect(editor.render(80)[1]).toStartWith('❯ ')

		handlers.get('session_shutdown')![0]!({}, ctx)
		expect(editorFactory).toBe(packageFactory)
	})
})
