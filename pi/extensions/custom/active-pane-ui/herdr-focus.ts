import net from 'node:net'

export async function queryHerdrPaneFocus(options: {
	paneId: string
	signal?: AbortSignal
	socketPath: string
	timeoutMs?: number
}): Promise<boolean | undefined> {
	return new Promise((resolve) => {
		let buffer = ''
		let settled = false
		let timeout: ReturnType<typeof setTimeout> | undefined
		const socket = net.createConnection(options.socketPath)
		socket.setEncoding('utf8')

		function onAbort() {
			finish(undefined)
		}

		function finish(focused: boolean | undefined) {
			if (settled) return
			settled = true
			if (timeout) clearTimeout(timeout)
			options.signal?.removeEventListener('abort', onAbort)
			socket.destroy()
			resolve(focused)
		}

		timeout = setTimeout(() => finish(undefined), options.timeoutMs ?? 500)
		timeout.unref?.()
		if (options.signal?.aborted) {
			finish(undefined)
			return
		}
		options.signal?.addEventListener('abort', onAbort, { once: true })

		socket.on('connect', () => {
			const request = {
				id: `pi-pane-focus:${options.paneId}`,
				method: 'pane.get',
				params: { pane_id: options.paneId },
			}
			socket.write(`${JSON.stringify(request)}\n`)
		})

		socket.on('data', (chunk: string) => {
			buffer += chunk
			if (!buffer.includes('\n')) return

			const [line] = buffer.split('\n')
			try {
				const focused = JSON.parse(line!)?.result?.pane?.focused
				finish(typeof focused === 'boolean' ? focused : undefined)
			} catch {
				finish(undefined)
			}
		})

		socket.on('error', () => finish(undefined))
		socket.on('end', () => finish(undefined))
	})
}

// Herdr 0.8 can emit pane_focused events for panes that are not active.
// Poll pane.get instead; its focused field is the authoritative state.
export function watchHerdrPaneFocus(options: {
	intervalMs?: number
	onFocus: (focused: boolean) => void
	paneId: string
	socketPath: string
}): () => void {
	const controller = new AbortController()
	let stopped = false
	let timer: ReturnType<typeof setTimeout> | undefined

	const poll = async () => {
		if (stopped) return
		const focused = await queryHerdrPaneFocus({
			...options,
			signal: controller.signal,
		})
		if (stopped) return
		if (focused !== undefined) options.onFocus(focused)
		if (stopped) return

		timer = setTimeout(poll, options.intervalMs ?? 200)
		timer.unref?.()
	}

	void poll()

	return () => {
		stopped = true
		controller.abort()
		if (timer) clearTimeout(timer)
		timer = undefined
	}
}
