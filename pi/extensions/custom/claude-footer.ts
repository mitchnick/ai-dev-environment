import { basename } from 'node:path'
import type {
	ExtensionAPI,
	ExtensionContext,
} from '@earendil-works/pi-coding-agent'
import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui'

type GitState = {
	root?: string
	dirty: boolean
}

const ICON_PI = 'π'
const ICON_FOLDER = ''
const ICON_GIT = ''
const ICON_MODEL = '󰙴'
const ICON_CONTEXT = '○'
const ICON_EFFORT = '󰓅'
const ICON_SESSION = '󰆍'

function modelFamily(id = '', name = ''): string {
	const value = `${id} ${name}`.toLowerCase()
	for (const family of ['sol', 'terra', 'luna', 'fable', 'opus', 'sonnet', 'haiku']) {
		if (value.includes(family)) return family[0].toUpperCase() + family.slice(1)
	}
	return name.split(/\s+/)[0] || id || 'No model'
}

function projectName(cwd: string, root?: string): string {
	const marker = '/.claude/worktrees/'
	if (cwd.includes(marker)) {
		const [repo, worktree] = cwd.split(marker)
		return `${basename(repo)}/${worktree.split('/')[0]}`
	}
	return basename(root || cwd) || '~'
}

function joinSegments(segments: string[], separator: string): string {
	return segments.filter(Boolean).join(separator)
}

export default function claudeFooter(pi: ExtensionAPI): void {
	let activeContext: ExtensionContext | undefined
	let git: GitState = { dirty: false }
	let requestRender: (() => void) | undefined
	let refreshSequence = 0

	async function refreshGit(ctx: ExtensionContext): Promise<void> {
		const sequence = ++refreshSequence
		const rootResult = await pi.exec('git', ['-C', ctx.cwd, 'rev-parse', '--show-toplevel'], {
			timeout: 3000,
		})
		if (sequence !== refreshSequence) return
		if (rootResult.code !== 0) {
			git = { dirty: false }
			requestRender?.()
			return
		}

		const root = rootResult.stdout.trim()
		const statusResult = await pi.exec(
			'git',
			['-C', ctx.cwd, 'status', '--porcelain', '--untracked-files=normal'],
			{ timeout: 5000 },
		)
		if (sequence !== refreshSequence) return
		git = { root, dirty: statusResult.code === 0 && statusResult.stdout.trim().length > 0 }
		requestRender?.()
	}

	function remember(ctx: ExtensionContext): void {
		activeContext = ctx
		requestRender?.()
	}

	pi.on('session_start', async (_event, ctx) => {
		if (ctx.mode !== 'tui') return
		activeContext = ctx
		await refreshGit(ctx)

		let getGitBranch: () => string | null = () => null

		// Pi always renders below-editor widgets before its footer. Keep an empty
		// footer for branch tracking, then render the Knox line as the first
		// below-editor widget so later agent widgets appear underneath it.
		ctx.ui.setFooter((tui, _theme, footerData) => {
			getGitBranch = () => footerData.getGitBranch()
			const unsubscribe = footerData.onBranchChange(() => {
				void refreshGit(activeContext ?? ctx)
				tui.requestRender()
			})

			return {
				dispose() {
					unsubscribe()
					getGitBranch = () => null
				},
				invalidate() {},
				render(): string[] {
					return []
				},
			}
		})

		ctx.ui.setWidget(
			'claude-footer',
			(tui, theme) => {
				requestRender = () => tui.requestRender()

				return {
					dispose() {
						requestRender = undefined
					},
					invalidate() {},
					render(width: number): string[] {
						const current = activeContext ?? ctx
						const separator = theme.fg('border', ' · ')
						const segments: string[] = []

						segments.push(theme.fg('bashMode', ICON_PI))
						segments.push(
							theme.fg(
								'accent',
								`${ICON_FOLDER} ${theme.bold(projectName(current.cwd, git.root))}`,
							),
						)

						const branch = getGitBranch()
						if (branch) {
							const color = git.dirty ? 'warning' : 'bashMode'
							segments.push(theme.fg(color, `${ICON_GIT} ${branch}${git.dirty ? ' *' : ''}`))
						}

						const usage = current.getContextUsage()
						if (usage) {
							const percent = usage.percent === null ? '?' : `${Math.round(usage.percent)}%`
							const numeric = usage.percent ?? 0
							const color = numeric >= 80 ? 'error' : numeric >= 50 ? 'warning' : 'success'
							segments.push(
								theme.fg(color, `${ICON_CONTEXT} ${percent}`) + theme.fg('dim', ' ctx'),
							)
						}

						if (current.model) {
							segments.push(
								theme.fg(
									'customMessageLabel',
									`${ICON_MODEL} ${modelFamily(current.model.id, current.model.name)}`,
								),
							)
						}

						if (current.thinkingLevel) {
							const color = {
								off: 'dim',
								minimal: 'success',
								low: 'success',
								medium: 'accent',
								high: 'warning',
								xhigh: 'bashMode',
								max: 'error',
							}[current.thinkingLevel] ?? 'muted'
							segments.push(theme.fg(color, `${ICON_EFFORT} ${current.thinkingLevel}`))
						}

						const status = `  ${joinSegments(segments, separator)}`
						const lines = [truncateToWidth(status, width, theme.fg('dim', '…'))]
						const sessionName = current.sessionManager.getSessionName()
						if (sessionName && width >= 24) {
							const session = `  ${theme.fg('bashMode', `${ICON_SESSION} ${sessionName}`)}`
							if (visibleWidth(session) <= width) lines.push(session)
						}
						return lines
					},
				}
			},
			{ placement: 'belowEditor' },
		)
	})

	pi.on('model_select', async (_event, ctx) => remember(ctx))
	pi.on('thinking_level_select', async (_event, ctx) => remember(ctx))
	pi.on('message_end', async (_event, ctx) => remember(ctx))
	pi.on('agent_end', async (_event, ctx) => {
		remember(ctx)
		await refreshGit(ctx)
	})
	pi.on('tool_execution_end', async (event, ctx) => {
		remember(ctx)
		if (['edit', 'write', 'bash'].includes(event.toolName)) await refreshGit(ctx)
	})
}
