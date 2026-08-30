const FAKE_CURSOR = /\x1b\[7m([^\x1b]*)\x1b\[0m/

type RenderableEditor = {
	render(width: number): string[]
}

export function parseHerdrFocused(output: string): boolean | undefined {
	try {
		const value = JSON.parse(output)?.result?.pane?.focused
		return typeof value === 'boolean' ? value : undefined
	} catch {
		return undefined
	}
}

export function addEditorPrompt(
	lines: string[],
	stylePrompt: (text: string) => string,
	padding = 2,
): string[] {
	const result = [...lines]
	const contentLine = result[1]
	const inset = ' '.repeat(padding)

	if (contentLine?.startsWith(inset)) {
		result[1] = stylePrompt('❯ ') + contentLine.slice(padding)
	}
	return result
}

export function hideEditorCursor(lines: string[], cursorMarker: string): string[] {
	let cursorRemoved = false

	return lines.map((line) => {
		let result = line.replaceAll(cursorMarker, '')
		if (cursorRemoved) return result

		result = result.replace(FAKE_CURSOR, (_match, character: string) => {
			cursorRemoved = true
			return character
		})
		return result
	})
}

export function decorateEditorRender<T extends RenderableEditor>(
	editor: T,
	options: {
		cursorMarker: string
		isFocused: () => boolean
		stylePrompt: (text: string) => string
	},
): T {
	const render = editor.render.bind(editor)

	editor.render = (width: number): string[] => {
		const lines = addEditorPrompt(render(width), options.stylePrompt)
		return options.isFocused() ? lines : hideEditorCursor(lines, options.cursorMarker)
	}
	return editor
}
