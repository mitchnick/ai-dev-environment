import { createHash } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'

interface StoredOAuth {
	clientInformation?: OAuthClientInformationMixed
	tokens?: OAuthTokens
	codeVerifier?: string
}

const AUTH_DIR = path.join(os.homedir(), '.pi', 'agent', 'mcp-auth')
const CALLBACK_PORT = 8484
const CALLBACK_URL = `http://127.0.0.1:${CALLBACK_PORT}/callback`

function authFile(serverName: string, serverUrl: string): string {
	const digest = createHash('sha256').update(serverUrl).digest('hex').slice(0, 12)
	return path.join(AUTH_DIR, `${serverName}-${digest}.json`)
}

function readStored(file: string): StoredOAuth {
	try { return JSON.parse(fs.readFileSync(file, 'utf8')) as StoredOAuth } catch { return {} }
}

function writeStored(file: string, data: StoredOAuth): void {
	fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
	fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 })
	fs.chmodSync(file, 0o600)
}

export class PersistentOAuthProvider {
	private readonly file: string
	private stored: StoredOAuth
	readonly redirectUrl = CALLBACK_URL
	readonly clientMetadata: OAuthClientMetadata = {
		client_name: 'Pi Claude compatibility MCP client',
		redirect_uris: [CALLBACK_URL],
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		token_endpoint_auth_method: 'client_secret_post',
	}
	pendingAuthorizationUrl?: URL

	constructor(serverName: string, serverUrl: string, private readonly onRedirect?: (url: URL) => void) {
		this.file = authFile(serverName, serverUrl)
		this.stored = readStored(this.file)
	}

	clientInformation(): OAuthClientInformationMixed | undefined { return this.stored.clientInformation }
	saveClientInformation(value: OAuthClientInformationMixed): void {
		this.stored.clientInformation = value
		writeStored(this.file, this.stored)
	}
	tokens(): OAuthTokens | undefined { return this.stored.tokens }
	saveTokens(value: OAuthTokens): void {
		this.stored.tokens = value
		writeStored(this.file, this.stored)
	}
	redirectToAuthorization(url: URL): void {
		this.pendingAuthorizationUrl = url
		this.onRedirect?.(url)
	}
	saveCodeVerifier(value: string): void {
		this.stored.codeVerifier = value
		writeStored(this.file, this.stored)
	}
	codeVerifier(): string {
		if (!this.stored.codeVerifier) throw new Error('No OAuth PKCE code verifier is available.')
		return this.stored.codeVerifier
	}
}

export function openBrowser(url: URL): void {
	const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open'
	const args = process.platform === 'win32' ? ['/c', 'start', '', url.toString()] : [url.toString()]
	const child = spawn(command, args, { detached: true, stdio: 'ignore' })
	child.unref()
}

export async function waitForOAuthCode(signal?: AbortSignal): Promise<string> {
	return new Promise((resolve, reject) => {
		let settled = false
		const finish = (error?: Error, code?: string) => {
			if (settled) return
			settled = true
			clearTimeout(timer)
			server.close()
			if (error) reject(error)
			else resolve(code ?? '')
		}
		const server = http.createServer((request, response) => {
			const url = new URL(request.url ?? '/', CALLBACK_URL)
			if (url.pathname !== '/callback') {
				response.writeHead(404).end('Not found')
				return
			}
			const error = url.searchParams.get('error')
			const code = url.searchParams.get('code')
			if (error || !code) {
				response.writeHead(400, { 'Content-Type': 'text/plain' }).end(`Authorization failed: ${error ?? 'missing code'}`)
				finish(new Error(`OAuth authorization failed: ${error ?? 'missing code'}`))
				return
			}
			response.writeHead(200, { 'Content-Type': 'text/html' }).end('<h1>Authorization complete</h1><p>You can close this tab and return to Pi.</p>')
			finish(undefined, code)
		})
		server.on('error', (error) => finish(error))
		server.listen(CALLBACK_PORT, '127.0.0.1')
		const timer = setTimeout(() => finish(new Error('OAuth authorization timed out after two minutes.')), 120_000)
		signal?.addEventListener('abort', () => finish(new Error('OAuth authorization cancelled.')), { once: true })
	})
}
