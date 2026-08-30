import { describe, expect, test } from 'bun:test'
import {
	addEditorPrompt,
	decorateEditorRender,
	hideEditorCursor,
	parseHerdrFocused,
} from './render.ts'

const MARKER = '<cursor-marker>'
const CURSOR = '\x1b[7m \x1b[0m'

describe('active pane editor rendering', () => {
	test('reads the initial focus state reported by Herdr', () => {
		expect(parseHerdrFocused('{"result":{"pane":{"focused":true}}}')).toBe(true)
		expect(parseHerdrFocused('{"result":{"pane":{"focused":false}}}')).toBe(false)
		expect(parseHerdrFocused('not json')).toBeUndefined()
	})

	test('replaces the two-column inset with the Claude prompt', () => {
		expect(addEditorPrompt(['────', `  ${MARKER}${CURSOR}`, '────'], (text) => `<muted>${text}</muted>`)).toEqual([
			'────',
			`<muted>❯ </muted>${MARKER}${CURSOR}`,
			'────',
		])
	})

	test('does not consume content when the configured inset is absent', () => {
		expect(addEditorPrompt(['────', ` ${MARKER}${CURSOR}`, '────'], (text) => text)).toEqual([
			'────',
			` ${MARKER}${CURSOR}`,
			'────',
		])
	})

	test('removes both cursor forms from an inactive pane', () => {
		expect(hideEditorCursor(['────', `❯ ${MARKER}${CURSOR}`, '────'], MARKER)).toEqual([
			'────',
			'❯  ',
			'────',
		])
	})

	test('decorates the existing editor instead of replacing it', () => {
		let focused = true
		const editor = {
			attachmentFeature: true,
			render: (_width: number) => ['────', `  ${MARKER}${CURSOR}`, '────'],
		}
		const decorated = decorateEditorRender(editor, {
			cursorMarker: MARKER,
			isFocused: () => focused,
			stylePrompt: (text) => text,
		})

		expect(decorated).toBe(editor)
		expect(decorated.attachmentFeature).toBe(true)
		expect(decorated.render(80)[1]).toBe(`❯ ${MARKER}${CURSOR}`)

		focused = false
		expect(decorated.render(80)[1]).toBe('❯  ')
	})
})
