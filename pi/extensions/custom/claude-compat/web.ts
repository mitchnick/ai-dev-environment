import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Type } from '@sinclair/typebox'

const WebFetchParams = Type.Object({
	url: Type.String({ description: 'Public HTTP or HTTPS URL to fetch.' }),
	prompt: Type.Optional(Type.String({ description: 'What to extract from the page.' })),
})

const WebSearchParams = Type.Object({
	query: Type.String({ description: 'Search query.' }),
	allowed_domains: Type.Optional(Type.Array(Type.String())),
	blocked_domains: Type.Optional(Type.Array(Type.String())),
})

type SearchResult = { title?: string; url?: string; link?: string; text?: string; snippet?: string; publishedDate?: string }

function result(text: string, details: Record<string, unknown> = {}) {
	return { content: [{ type: 'text' as const, text }], details }
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

function rethrowCancellation(error: unknown, signal: AbortSignal): void {
	if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error
}

function publicUrl(raw: string): URL {
	const url = new URL(raw)
	if (!['http:', 'https:'].includes(url.protocol)) throw new Error('WebFetch only supports HTTP and HTTPS URLs.')
	const host = url.hostname.toLowerCase()
	const privateHost = host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0' || host === '::1' ||
		/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(host)
	if (privateHost) throw new Error('WebFetch will not send private or localhost URLs through the public reader. Use project browser tooling instead.')
	if (url.username || url.password || [...url.searchParams.keys()].some((key) => /(token|key|auth|signature|credential)/i.test(key))) {
		throw new Error('WebFetch will not send credential-bearing URLs through the public reader.')
	}
	return url
}

function searchQuery(query: string, allowed?: string[], blocked?: string[]): string {
	const allow = (allowed ?? []).map((domain) => `site:${domain}`).join(' OR ')
	const deny = (blocked ?? []).map((domain) => `-site:${domain}`).join(' ')
	return [query, allow ? `(${allow})` : '', deny].filter(Boolean).join(' ')
}

function formatSearchResults(items: SearchResult[]): string {
	if (items.length === 0) return 'No search results found.'
	return items.slice(0, 10).map((item, index) => {
		const url = item.url ?? item.link ?? ''
		const snippet = item.text ?? item.snippet ?? ''
		return `${index + 1}. ${item.title ?? url}\n${url}\n${snippet}`.trim()
	}).join('\n\n')
}

async function serperSearch(query: string, signal: AbortSignal): Promise<SearchResult[]> {
	const key = process.env.SERPER_API_KEY
	if (!key) return []
	const response = await fetch('https://google.serper.dev/search', {
		method: 'POST',
		headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
		body: JSON.stringify({ q: query, num: 10 }),
		signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
	})
	if (!response.ok) throw new Error(`Serper search failed (${response.status}): ${(await response.text()).slice(0, 500)}`)
	const data = await response.json() as { organic?: SearchResult[] }
	return data.organic ?? []
}

async function exaSearch(query: string, signal: AbortSignal): Promise<SearchResult[]> {
	const key = process.env.EXA_API_KEY
	if (!key) return []
	const response = await fetch('https://api.exa.ai/search', {
		method: 'POST',
		headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
		body: JSON.stringify({ query, numResults: 10, type: 'auto', contents: { text: { maxCharacters: 800 } } }),
		signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
	})
	if (!response.ok) throw new Error(`Exa search failed (${response.status}): ${(await response.text()).slice(0, 500)}`)
	const data = await response.json() as { results?: SearchResult[] }
	return data.results ?? []
}

export default function webCompat(pi: ExtensionAPI): void {
	pi.registerTool({
		name: 'WebFetch',
		label: 'Web Fetch',
		description: 'Fetch a public web page as readable markdown. Claude Code compatibility tool; authenticated and local pages must use project browser tooling.',
		parameters: WebFetchParams,
		async execute(_id, params, signal) {
			try {
				const url = publicUrl(params.url)
				const readerUrl = `https://r.jina.ai/${url.toString()}`
				const response = await fetch(readerUrl, {
					headers: { Accept: 'text/markdown', 'X-Return-Format': 'markdown' },
					signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
				})
				if (!response.ok) throw new Error(`Jina Reader failed (${response.status}): ${(await response.text()).slice(0, 500)}`)
				const body = await response.text()
				const limit = 60_000
				const truncated = body.length > limit
				const text = `${params.prompt ? `Requested extraction: ${params.prompt}\n\n` : ''}${body.slice(0, limit)}${truncated ? '\n\n[Content truncated at 60,000 characters.]' : ''}`
				return result(text, { url: url.toString(), source: 'jina-reader', truncated })
			} catch (error) {
				return result(`WebFetch failed: ${error instanceof Error ? error.message : String(error)}`, { error: true })
			}
		},
	})

	pi.registerTool({
		name: 'WebSearch',
		label: 'Web Search',
		description: 'Search the public web and return concise titles, URLs, and snippets. Claude Code compatibility tool.',
		parameters: WebSearchParams,
		async execute(_id, params, signal) {
			const query = searchQuery(params.query, params.allowed_domains, params.blocked_domains)
			const failures: string[] = []
			try {
				let items: SearchResult[] = []
				let provider = 'serper'
				try {
					items = await serperSearch(query, signal)
				} catch (error) {
					rethrowCancellation(error, signal)
					failures.push(`Serper: ${errorMessage(error)}`)
				}
				if (items.length === 0) {
					provider = 'exa'
					try {
						items = await exaSearch(query, signal)
					} catch (error) {
						rethrowCancellation(error, signal)
						failures.push(`Exa: ${errorMessage(error)}`)
					}
				}
				if (items.length === 0) {
					const reason = failures.length > 0
						? failures.join(' | ')
						: 'Neither SERPER_API_KEY nor EXA_API_KEY is available in this Pi process.'
					throw new Error(reason)
				}
				return result(formatSearchResults(items), { query, provider, count: items.length, fallbackFailures: failures })
			} catch (error) {
				rethrowCancellation(error, signal)
				return result(`WebSearch failed: ${errorMessage(error)}`, { error: true, query, failures })
			}
		},
	})
}
