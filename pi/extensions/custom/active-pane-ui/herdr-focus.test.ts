import { afterEach, describe, expect, test } from 'bun:test'
import net, { type Server } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
	queryHerdrPaneFocus,
	watchHerdrPaneFocus,
} from './herdr-focus.ts'

let server: Server | undefined
let tempDirectory: string | undefined
let stopWatcher: (() => void) | undefined

afterEach(async () => {
	stopWatcher?.()
	stopWatcher = undefined
	await new Promise<void>((resolve) => server?.close(() => resolve()) ?? resolve())
	server = undefined
	if (tempDirectory) await rm(tempDirectory, { force: true, recursive: true })
	tempDirectory = undefined
})

async function createFocusServer(states: boolean[]): Promise<{
	requests: unknown[]
	socketPath: string
}> {
	tempDirectory = await mkdtemp(join(tmpdir(), 'pi-herdr-focus-'))
	const socketPath = join(tempDirectory, 'herdr.sock')
	const requests: unknown[] = []
	let connection = 0

	server = net.createServer((socket) => {
		let requestBuffer = ''
		socket.setEncoding('utf8')
		socket.on('data', (chunk: string) => {
			requestBuffer += chunk
			if (!requestBuffer.includes('\n')) return

			const [line] = requestBuffer.split('\n')
			requests.push(JSON.parse(line!))
			const focused = states[Math.min(connection, states.length - 1)]
			connection += 1
			socket.end(`${JSON.stringify({
				id: 'test',
				result: { pane: { focused }, type: 'pane_info' },
			})}\n`)
		})
	})
	await new Promise<void>((resolve) => server!.listen(socketPath, resolve))

	return { requests, socketPath }
}

describe('Herdr pane focus queries', () => {
	test('reads authoritative pane focus through pane.get', async () => {
		const { requests, socketPath } = await createFocusServer([true])

		const focused = await queryHerdrPaneFocus({ paneId: 'w1:p2', socketPath })

		expect(focused).toBe(true)
		expect(requests).toEqual([{
			id: 'pi-pane-focus:w1:p2',
			method: 'pane.get',
			params: { pane_id: 'w1:p2' },
		}])
	})

	test('polls focus changes and stops cleanly', async () => {
		const { socketPath } = await createFocusServer([true, false])
		const updates: boolean[] = []

		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error('focus updates timed out')), 1000)
			stopWatcher = watchHerdrPaneFocus({
				intervalMs: 1,
				onFocus: (focused) => {
					updates.push(focused)
					if (updates.length !== 2) return
					clearTimeout(timeout)
					stopWatcher?.()
					resolve()
				},
				paneId: 'w1:p2',
				socketPath,
			})
		})

		expect(updates).toEqual([true, false])
	})

	test('aborts an in-flight query when the watcher stops', async () => {
		tempDirectory = await mkdtemp(join(tmpdir(), 'pi-herdr-focus-'))
		const socketPath = join(tempDirectory, 'herdr.sock')
		let connections = 0
		let resolveConnected: (() => void) | undefined
		let resolveClosed: (() => void) | undefined
		const connected = new Promise<void>((resolve) => { resolveConnected = resolve })
		const closed = new Promise<void>((resolve) => { resolveClosed = resolve })

		server = net.createServer((socket) => {
			connections += 1
			resolveConnected?.()
			socket.on('close', () => resolveClosed?.())
		})
		await new Promise<void>((resolve) => server!.listen(socketPath, resolve))

		stopWatcher = watchHerdrPaneFocus({
			intervalMs: 1,
			onFocus: () => {},
			paneId: 'w1:p2',
			socketPath,
		})
		await connected
		stopWatcher()
		await closed
		await Bun.sleep(10)

		expect(connections).toBe(1)
	})
})
