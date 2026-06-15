import { useEffect, useState } from 'react'
import { useSessionStore } from '../store/sessionStore'
import type { GitBranchInfo, GitCommit, GitStatus } from '../../shared/ipc'
import DiffView from './DiffView'
import ConfirmDialog from './ConfirmDialog'

/* --- icons --- */
const BranchIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M6 3v6a3 3 0 0 0 6 0V8.5A2.5 2.5 0 0 0 9.5 6H6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M6 3h6v4a3 3 0 0 1-3 3H6V3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    <circle cx="18" cy="5" r="2" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M18 7v4a3 3 0 0 1-3 3h-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
)
const PullIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 3v14M5 13l7 7 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const PushIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 21V7M5 11l7-7 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const FetchIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M4 12a8 8 0 0 1 14-5M20 4v4h-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 12a8 8 0 0 1-14 5M4 20v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const CommitIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const StashIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16v2H4zM4 11h16v2H4zM4 15h16v2H4z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
)
const LogIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M8 6h10M8 12h10M8 18h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    <circle cx="5" cy="6" r="1.2" fill="currentColor"/>
    <circle cx="5" cy="12" r="1.2" fill="currentColor"/>
    <circle cx="5" cy="18" r="1.2" fill="currentColor"/>
  </svg>
)
const RevertIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M3 7l4 4H6a8 8 0 1 0-2.5-5.3L3 7z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const PlusIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const MinusIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)
const TrashIcon = (): JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const CloseIcon = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

function formatTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  const d = Math.floor(h / 24)
  return `${d}天前`
}

type Drawer = 'branches' | 'commit' | 'log' | 'stash' | 'output' | null
type FileKind = 'staged' | 'unstaged' | 'untracked' | 'conflict'

const KIND_STYLE: Record<FileKind, { dot: string; text: string; label: string }> = {
  staged: { dot: 'bg-yellow-500', text: 'text-amber-200', label: '已暂存' },
  unstaged: { dot: 'bg-blue-500', text: 'text-sky-200', label: '已改动' },
  untracked: { dot: 'bg-green-500', text: 'text-emerald-200', label: '未跟踪' },
  conflict: { dot: 'bg-red-500', text: 'text-red-200', label: '冲突' }
}

/** A single file row inside the commit drawer: status dot + name (click → diff)
 *  + a stage/unstage action. */
function FileRow({
  path,
  kind,
  selected,
  loading,
  onSelect,
  actionIcon,
  actionTitle,
  onAction
}: {
  path: string
  kind: FileKind
  selected: boolean
  loading: boolean
  onSelect: () => void
  actionIcon?: JSX.Element
  actionTitle?: string
  onAction?: () => void
}): JSX.Element {
  const st = KIND_STYLE[kind]
  return (
    <div
      className={`group flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] transition ${
        selected ? 'bg-accent/10' : 'hover:bg-white/[0.05]'
      }`}
    >
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
        <span className={`truncate font-mono ${st.text}`}>{path}</span>
      </button>
      {onAction && (
        <button
          onClick={onAction}
          disabled={loading}
          title={actionTitle}
          className="shrink-0 rounded p-0.5 text-zinc-600 opacity-60 transition hover:opacity-100 hover:text-zinc-200 disabled:opacity-30"
        >
          {actionIcon}
        </button>
      )}
    </div>
  )
}

export default function GitToolbar(): JSX.Element {
  // '' when there's no active project; every git call is guarded by
  // `if (!cwd)` / `if (!branch)` so the empty string never reaches git.
  const cwd = useSessionStore((s) => s.meta?.cwd ?? '')
  const [branch, setBranch] = useState<string | null>(null)
  const [status, setStatus] = useState<GitStatus>({
    staged: [], unstaged: [], untracked: [], conflicts: [], clean: true, ahead: null, behind: null
  })
  const [branches, setBranches] = useState<GitBranchInfo[]>([])
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [stashList, setStashList] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [drawer, setDrawer] = useState<Drawer>(null)
  const [commitMsg, setCommitMsg] = useState('')
  const [newBranchName, setNewBranchName] = useState('')
  const [pushUpstream, setPushUpstream] = useState(false)

  // Operation output (push/pull/fetch stdout+stderr) shown in the output drawer.
  const [output, setOutput] = useState<{ cmd: string; text: string } | null>(null)

  // Diff viewer state (lives inside the commit drawer).
  const [diffView, setDiffView] = useState<{
    paths: string[]
    staged: boolean
    text: string
    note?: string
    loading: boolean
  } | null>(null)

  // Pending confirmation dialog.
  const [confirm, setConfirm] = useState<{
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
    onConfirm: () => void
  } | null>(null)

  // Refresh branch + status + branches whenever cwd changes. Also closes any
  // open drawer so stale drawer contents from the previous project don't leak.
  useEffect(() => {
    setDrawer(null)
    setDiffView(null)
    if (!cwd) return
    void refresh()
  }, [cwd])

  const refresh = async (): Promise<void> => {
    if (!cwd) return
    try {
      const [b, s, bl] = await Promise.all([
        window.api.gitGetCurrentBranch(cwd),
        window.api.gitStatus(cwd),
        window.api.gitListBranches(cwd)
      ])
      setBranch(b)
      setStatus(s)
      setBranches(bl)
    } catch {
      setBranch(null)
    }
  }

  /** Run a git action, then refresh. If it returns {stdout,stderr}, surface the
   *  text in the output drawer so the user sees push/pull/fetch results. */
  const runGitAction = async (fn: () => Promise<unknown>, label: string): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fn()
      if (res && typeof res === 'object' && ('stdout' in res || 'stderr' in res)) {
        const { stdout, stderr } = res as { stdout: string; stderr: string }
        const text = [stdout, stderr].filter(Boolean).join('\n').trim()
        if (text) {
          setOutput({ cmd: label, text })
          setDrawer('output')
        }
      }
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const toggleDrawer = async (next: Exclude<Drawer, null>): Promise<void> => {
    if (drawer === next) {
      setDrawer(null)
      return
    }
    // Lazy-load drawer data on open.
    if (next === 'log' && cwd) {
      try { setCommits(await window.api.gitLog(cwd, 30)) } catch { setCommits([]) }
    } else if (next === 'stash' && cwd) {
      try {
        const res = await window.api.gitStash(cwd, 'list')
        setStashList(res.split('\n').filter(Boolean))
      } catch { setStashList([]) }
    }
    setDrawer(next)
  }

  const loadDiff = async (paths: string[], staged: boolean, note?: string): Promise<void> => {
    if (!cwd) return
    setDiffView({ paths, staged, text: '', note, loading: true })
    if (note) {
      setDiffView({ paths, staged, text: '', note, loading: false })
      return
    }
    try {
      const text = await window.api.gitDiff(cwd, { paths, staged })
      setDiffView({ paths, staged, text, loading: false })
    } catch (e: unknown) {
      setDiffView({ paths, staged, text: '', note: e instanceof Error ? e.message : String(e), loading: false })
    }
  }

  const stageFile = (path: string): Promise<void> => runGitAction(() => window.api.gitAdd(cwd, [path]), '暂存')
  const unstageFile = (path: string): Promise<void> => runGitAction(() => window.api.gitReset(cwd, [path]), '取消暂存')

  const doCommit = async (): Promise<void> => {
    const msg = commitMsg.trim()
    if (!msg) { setError('请输入提交信息'); return }
    await runGitAction(async () => {
      await window.api.gitCommit(cwd, msg)
      setCommitMsg('')
      setDiffView(null)
    }, '提交')
  }

  // If not a git repo, render nothing.
  if (!branch) return <></>

  const btnCls =
    'flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200 disabled:opacity-40'
  const dotCls = 'h-1.5 w-1.5 shrink-0 rounded-full'
  const dirty = !status.clean
  const totalChanges = status.staged.length + status.unstaged.length + status.untracked.length + status.conflicts.length
  const activeBtn = (d: Drawer): string => (drawer === d ? 'bg-white/[0.08] text-zinc-100' : '')

  return (
    <div className="border-b border-white/[0.06]">
      {/* --- toolbar row --- */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 text-zinc-400">
        {/* Branch + ahead/behind */}
        <button
          onClick={() => toggleDrawer('branches')}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-white/[0.06] ${activeBtn('branches')}`}
        >
          <BranchIcon />
          <span className="max-w-[160px] truncate font-mono">{branch}</span>
          {status.ahead ? <span className="text-[10px] font-semibold text-emerald-400">↑{status.ahead}</span> : null}
          {status.behind ? <span className="text-[10px] font-semibold text-amber-400">↓{status.behind}</span> : null}
        </button>

        {/* Status dots */}
        {dirty && (
          <div className="flex items-center gap-1 pl-0.5">
            {status.staged.length > 0 && <span className={`${dotCls} bg-yellow-500`} title={`${status.staged.length} 已暂存`} />}
            {status.unstaged.length > 0 && <span className={`${dotCls} bg-blue-500`} title={`${status.unstaged.length} 已改动`} />}
            {status.untracked.length > 0 && <span className={`${dotCls} bg-green-500`} title={`${status.untracked.length} 未跟踪`} />}
            {status.conflicts.length > 0 && <span className={`${dotCls} bg-red-500`} title={`${status.conflicts.length} 冲突`} />}
          </div>
        )}

        <span className="h-4 w-px shrink-0 bg-white/[0.08]" />

        {/* Sync: fetch / pull / push */}
        <button onClick={() => runGitAction(() => window.api.gitFetch(cwd), '拉取(fetch)')} disabled={loading} className={btnCls} title="拉取远端信息(不合并)">
          <FetchIcon />
        </button>
        <button onClick={() => runGitAction(() => window.api.gitPull(cwd), '拉取')} disabled={loading} className={btnCls} title="拉取并合并">
          <PullIcon /> 拉取
        </button>
        <button onClick={() => runGitAction(() => window.api.gitPush(cwd), '推送')} disabled={loading} className={btnCls} title="推送">
          <PushIcon /> 推送
        </button>

        <span className="h-4 w-px shrink-0 bg-white/[0.08]" />

        {/* Commit → opens commit drawer */}
        <button
          onClick={() => toggleDrawer('commit')}
          disabled={loading}
          className={`${btnCls} ${activeBtn('commit')}`}
          title="暂存与提交"
        >
          <CommitIcon /> 提交
          {status.staged.length > 0 && <span className="rounded bg-accent/20 px-1 text-[9px] text-accent">{status.staged.length}</span>}
        </button>

        {/* Stash → opens stash drawer */}
        <button
          onClick={() => toggleDrawer('stash')}
          disabled={loading || status.clean}
          className={`${btnCls} ${activeBtn('stash')}`}
          title="储藏"
        >
          <StashIcon /> 储藏
        </button>

        <span className="h-4 w-px shrink-0 bg-white/[0.08]" />

        {/* Log */}
        <button onClick={() => toggleDrawer('log')} disabled={loading} className={`${btnCls} ${activeBtn('log')}`} title="提交历史">
          <LogIcon /> 日志
        </button>

        {/* Output indicator (shows after push/pull/fetch produce text) */}
        {output && (
          <button onClick={() => toggleDrawer('output')} className={`${btnCls} ${activeBtn('output')}`} title="上次操作输出">
            输出
          </button>
        )}

        {/* Conflict warning */}
        {status.conflicts.length > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-red-400">
            <span className={`${dotCls} bg-red-500`} />
            {status.conflicts.length} 个冲突
          </span>
        )}

        {loading && <span className="ml-auto text-[10px] text-zinc-500 animate-pulse">处理中…</span>}
        {error && (
          <span className={`flex items-center gap-1 text-[10px] text-red-400 ${loading ? '' : 'ml-auto'}`}>
            <span className="max-w-[280px] truncate">{error}</span>
            <button onClick={() => setError(null)} className="hover:text-red-300"><CloseIcon /></button>
          </span>
        )}
      </div>

      {/* --- drawer area (one at a time) --- */}
      {drawer && (
        <div className="max-h-[46vh] overflow-y-auto border-t border-white/[0.06] px-3 py-2.5 text-zinc-300">
          {/* Branches drawer */}
          {drawer === 'branches' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500/80">切换分支</span>
                <button onClick={() => setDrawer(null)} className="text-zinc-600 hover:text-zinc-300"><CloseIcon /></button>
              </div>
              <div className="max-h-44 overflow-y-auto">
                {branches.map((b) => (
                  <div
                    key={b.name}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] transition hover:bg-white/[0.05] ${
                      b.current ? 'bg-accent/10 font-medium text-zinc-200' : 'text-zinc-400'
                    }`}
                  >
                    <button
                      onClick={() => runGitAction(() => window.api.gitCheckoutBranch(cwd, b.name), '切换分支').then(() => setDrawer(null))}
                      disabled={loading || !!b.current}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left disabled:opacity-40"
                    >
                      {b.current && <span className={`${dotCls} bg-emerald-500`} />}
                      <span className="truncate font-mono">{b.name}</span>
                    </button>
                    {!b.current && (
                      <button
                        onClick={() => setConfirm({
                          title: '删除分支',
                          message: `确定删除本地分支 ${b.name}?`,
                          confirmLabel: '删除',
                          danger: true,
                          onConfirm: () => { const name = b.name; setConfirm(null); void runGitAction(() => window.api.gitDeleteBranch(cwd, name, true), '删除分支') }
                        })}
                        disabled={loading}
                        className="rounded p-0.5 text-zinc-600 hover:text-red-400"
                        title={`删除 ${b.name}`}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {/* Create branch */}
              <div className="mt-1 flex items-center gap-2 border-t border-white/[0.06] pt-2">
                <input
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newBranchName.trim()) void createBranch() }}
                  placeholder="新分支名"
                  className="flex-1 rounded-lg border border-white/[0.1] bg-bg-elev/60 px-2 py-1 text-[11px] text-zinc-200 outline-none focus:border-accent/50"
                />
                <label className="flex items-center gap-1 text-[10px] text-zinc-500" title="创建后推送到远端并设置上游">
                  <input type="checkbox" checked={pushUpstream} onChange={(e) => setPushUpstream(e.target.checked)} className="accent-accent" />
                  推送
                </label>
                <button onClick={createBranch} disabled={loading || !newBranchName.trim()} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-white/[0.06] disabled:opacity-40">
                  <PlusIcon /> 创建
                </button>
              </div>
            </div>
          )}

          {/* Commit drawer: staging management + per-file diff + commit input */}
          {drawer === 'commit' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500/80">
                  提交 · {totalChanges} 个变更
                </span>
                <div className="flex items-center gap-1">
                  {!status.clean && (
                    <button onClick={() => runGitAction(() => window.api.gitAdd(cwd), '全部暂存')} disabled={loading} className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200">
                      全部暂存
                    </button>
                  )}
                  <button onClick={() => loadDiff([], false)} className="rounded px-1.5 py-0.5 text-[10px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200">
                    全部改动
                  </button>
                  <button onClick={() => setDrawer(null)} className="ml-1 text-zinc-600 hover:text-zinc-300"><CloseIcon /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {/* file lists */}
                <div className="min-w-0 space-y-2">
                  {status.conflicts.length > 0 && (
                    <FileSection title="冲突" files={status.conflicts} kind="conflict" loading={loading} diffView={diffView} onPick={(p) => loadDiff([p], false)} />
                  )}
                  {status.staged.length > 0 && (
                    <FileSection
                      title="已暂存"
                      files={status.staged}
                      kind="staged"
                      loading={loading}
                      diffView={diffView}
                      onPick={(p) => loadDiff([p], true)}
                      actionIcon={<MinusIcon />}
                      actionTitle="取消暂存"
                      onAction={unstageFile}
                    />
                  )}
                  {status.unstaged.length > 0 && (
                    <FileSection
                      title="已改动"
                      files={status.unstaged}
                      kind="unstaged"
                      loading={loading}
                      diffView={diffView}
                      onPick={(p) => loadDiff([p], false)}
                      actionIcon={<PlusIcon />}
                      actionTitle="暂存"
                      onAction={stageFile}
                    />
                  )}
                  {status.untracked.length > 0 && (
                    <FileSection
                      title="未跟踪"
                      files={status.untracked}
                      kind="untracked"
                      loading={loading}
                      diffView={diffView}
                      onPick={(p) => loadDiff([p], false, '未跟踪文件,暂无 diff')}
                      actionIcon={<PlusIcon />}
                      actionTitle="暂存"
                      onAction={stageFile}
                    />
                  )}
                  {status.clean && <div className="py-4 text-center text-[11px] text-zinc-600">工作区干净</div>}
                </div>

                {/* diff viewer */}
                <div className="min-w-0">
                  {diffView ? (
                    <div>
                      <div className="mb-1 truncate text-[10px] text-zinc-500">
                        {diffView.loading ? '加载 diff…' : (diffView.paths.length ? diffView.paths.join(', ') : '全部改动')}
                        {diffView.staged && <span className="ml-1 text-amber-400/80">(已暂存)</span>}
                      </div>
                      {diffView.note ? (
                        <div className="rounded bg-[#0b0c10] p-2.5 text-[11px] text-zinc-500">{diffView.note}</div>
                      ) : diffView.loading ? (
                        <div className="rounded bg-[#0b0c10] p-2.5 text-[11px] text-zinc-600">…</div>
                      ) : diffView.text ? (
                        <div className="max-h-64 overflow-hidden"><DiffView text={diffView.text} /></div>
                      ) : (
                        <div className="rounded bg-[#0b0c10] p-2.5 text-[11px] text-zinc-600">无差异</div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded bg-[#0b0c10]/50 p-4 text-center text-[11px] text-zinc-600">
                      点击左侧文件查看改动
                    </div>
                  )}
                </div>
              </div>

              {/* commit input */}
              <div className="flex items-center gap-2 border-t border-white/[0.06] pt-2">
                <input
                  value={commitMsg}
                  onChange={(e) => setCommitMsg(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void doCommit() }}
                  placeholder="提交信息(Ctrl+Enter 提交)"
                  className="flex-1 rounded-lg border border-white/[0.1] bg-bg-elev/60 px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-accent/50"
                />
                <button
                  onClick={doCommit}
                  disabled={loading || status.staged.length === 0}
                  className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-medium text-white transition hover:brightness-110 disabled:opacity-40"
                  title={status.staged.length === 0 ? '没有已暂存的改动' : '提交已暂存的改动'}
                >
                  <CommitIcon /> 提交{status.staged.length > 0 ? ` (${status.staged.length})` : ''}
                </button>
              </div>
            </div>
          )}

          {/* Log drawer */}
          {drawer === 'log' && (
            <div className="flex flex-col gap-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500/80">提交历史</span>
                <button onClick={() => setDrawer(null)} className="text-zinc-600 hover:text-zinc-300"><CloseIcon /></button>
              </div>
              {commits.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-zinc-600">暂无提交</div>
              ) : (
                commits.map((c) => (
                  <div key={c.hash} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.05]">
                    <span className="shrink-0 font-mono text-[10px] text-zinc-500">{c.shortHash}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] text-zinc-300">{c.message}</div>
                      <div className="text-[10px] text-zinc-600">{c.author} · {formatTime(c.date)}</div>
                    </div>
                    <button
                      onClick={() => setConfirm({
                        title: '撤销提交',
                        message: `用 git revert 撤销提交 ${c.shortHash}?\n「${c.message}」\n这会创建一个反向的新提交。`,
                        confirmLabel: '撤销',
                        danger: true,
                        onConfirm: () => { const hash = c.hash; setConfirm(null); void runGitAction(() => window.api.gitRevert(cwd, hash), '撤销提交').then(() => setDrawer(null)) }
                      })}
                      disabled={loading}
                      className="shrink-0 rounded p-0.5 text-zinc-600 opacity-0 transition hover:text-amber-400 group-hover:opacity-100 disabled:opacity-30"
                      title="撤销此提交"
                    >
                      <RevertIcon />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Stash drawer */}
          {drawer === 'stash' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500/80">储藏</span>
                <button onClick={() => setDrawer(null)} className="text-zinc-600 hover:text-zinc-300"><CloseIcon /></button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => runGitAction(() => window.api.gitStash(cwd, 'push'), '储藏').then(refreshStash)} disabled={loading} className="flex items-center gap-1 rounded-lg border border-white/[0.1] px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40">
                  <PlusIcon /> 储藏当前改动
                </button>
                <button
                  onClick={() => setConfirm({
                    title: '恢复储藏',
                    message: '恢复最近的储藏(stash pop)?\n若与当前改动冲突,会产生合并冲突。',
                    confirmLabel: '恢复',
                    onConfirm: () => { setConfirm(null); void runGitAction(() => window.api.gitStash(cwd, 'pop'), '恢复储藏').then(refreshStash) }
                  })}
                  disabled={loading || stashList.length === 0}
                  className="flex items-center gap-1 rounded-lg border border-white/[0.1] px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/[0.06] disabled:opacity-40"
                >
                  ↩ 恢复最近
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {stashList.length === 0 ? (
                  <div className="py-3 text-center text-[11px] text-zinc-600">暂无储藏</div>
                ) : (
                  stashList.map((s, i) => (
                    <div key={i} className="truncate rounded-lg px-2 py-1 font-mono text-[10px] text-zinc-500 hover:bg-white/[0.05]" title={s}>
                      {s}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Output drawer */}
          {drawer === 'output' && (
            <div className="flex flex-col gap-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500/80">{output?.cmd} 输出</span>
                <button onClick={() => setDrawer(null)} className="text-zinc-600 hover:text-zinc-300"><CloseIcon /></button>
              </div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-[#0b0c10] p-2.5 text-[11px] leading-relaxed text-zinc-300">
                {output?.text || '(无输出)'}
              </pre>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )

  async function createBranch(): Promise<void> {
    const name = newBranchName.trim()
    if (!name) return
    await runGitAction(async () => {
      await window.api.gitCreateBranch(cwd, name)
      await window.api.gitCheckoutBranch(cwd, name)
      if (pushUpstream) await window.api.gitPushUpstream(cwd)
      setNewBranchName('')
    }, '创建分支')
    setDrawer(null)
  }

  async function refreshStash(): Promise<void> {
    if (!cwd) return
    try {
      const res = await window.api.gitStash(cwd, 'list')
      setStashList(res.split('\n').filter(Boolean))
    } catch { setStashList([]) }
  }
}

/** A labeled group of file rows, used inside the commit drawer. */
function FileSection({
  title,
  files,
  kind,
  loading,
  diffView,
  onPick,
  actionIcon,
  actionTitle,
  onAction
}: {
  title: string
  files: string[]
  kind: FileKind
  loading: boolean
  diffView: { paths: string[]; staged: boolean } | null
  onPick: (path: string) => void
  actionIcon?: JSX.Element
  actionTitle?: string
  onAction?: (path: string) => Promise<void>
}): JSX.Element {
  return (
    <div>
      <div className="mb-0.5 text-[10px] font-medium text-zinc-500">{title} · {files.length}</div>
      <div className="space-y-0.5">
        {files.map((path) => {
          const selected = !!diffView && diffView.paths.length === 1 && diffView.paths[0] === path
          return (
            <FileRow
              key={path}
              path={path}
              kind={kind}
              selected={selected}
              loading={loading}
              onSelect={() => onPick(path)}
              actionIcon={actionIcon}
              actionTitle={actionTitle}
              onAction={onAction ? () => onAction(path) : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
