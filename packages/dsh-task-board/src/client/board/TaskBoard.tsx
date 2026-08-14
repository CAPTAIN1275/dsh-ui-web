/**
 * Board view: the multi-column kanban that replaces the middle column while
 * active. Cards open the task detail (never execute directly); the header
 * offers filter, new-task, and a back-to-chat escape. A「当前会话」block at the
 * top mirrors the session currently open in the GUI (title / running state /
 * jump-back), so the board and the live conversation stay visibly linked.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { SessionId, SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { selectedTaskOf, type BoardController } from '../../core/controller.ts'
import { COLUMNS, type TaskRecord, type TaskStatus } from '../../core/tasks.ts'
import { t, type TaskBoardKey } from '../locales.ts'
import css from '../board.module.css'
import { NewTaskModal } from './NewTaskModal.tsx'
import { TaskCard } from './TaskCard.tsx'
import { TaskDetail } from './TaskDetail.tsx'

/** 当前会话句柄：只读会话列表快照 + 跳转。 */
export interface CurrentSessionHandle {
  list: {
    getSnapshot(): SessionListState
    subscribe(listener: () => void): () => void
  }
  open(sessionId: SessionId): void
}

/** Column status → locale key. */
const STATUS_KEY: Record<TaskStatus, TaskBoardKey> = {
  backlog: 'board.status.backlog',
  todo: 'board.status.todo',
  running: 'board.status.running',
  done: 'board.status.done',
  failed: 'board.status.failed',
}

/** Case-insensitive title/description match. */
function matchesFilter(task: TaskRecord, filter: string): boolean {
  if (filter.trim() === '') return true
  const needle = filter.trim().toLowerCase()
  return task.title.toLowerCase().includes(needle) || task.description.toLowerCase().includes(needle)
}

/** 从工作区路径取工作区名（末段），无则 undefined。 */
function workspaceName(cwd: string | undefined): string | undefined {
  if (cwd === undefined || cwd === '') return undefined
  const parts = cwd.split(/[\\/]/).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : undefined
}

/** 当前会话区块：显示当前对话标题、工作区与状态，可一键跳回。 */
function CurrentSessionBlock({ sessions, summary }: { sessions: CurrentSessionHandle; summary: SessionSummary | undefined }) {
  if (summary === undefined) {
    return (
      <div className={css.currentSession}>
        <span className={css.currentSessionTitle}>当前会话</span>
        <span className={css.currentSessionName}>（无）</span>
      </div>
    )
  }
  const status = summary.running ? '运行中' : summary.blank ? '空白' : '空闲'
  const workspace = workspaceName(summary.cwd)
  return (
    <div className={css.currentSession}>
      <span className={css.currentSessionTitle}>当前会话</span>
      <span className={css.currentSessionName} title={summary.cwd ?? summary.id}>
        {workspace !== undefined ? `${workspace} · ${summary.displayTitle}` : summary.displayTitle}
      </span>
      <span className={css.currentSessionStatus} data-running={summary.running}>{status}</span>
      <button
        type="button"
        className={css.ghostButton}
        onClick={() => { sessions.open(summary.id) }}
      >
        前往
      </button>
    </div>
  )
}

/** Board component; subscribes to the controller snapshot and the live session list. */
export function TaskBoard({ controller, sessions }: { controller: BoardController; sessions: CurrentSessionHandle }) {
  const [snapshot, setSnapshot] = useState(controller.getSnapshot())
  useEffect(
    () => controller.subscribe(() => setSnapshot(controller.getSnapshot())),
    [controller],
  )
  const sessionList = useSyncExternalStore(sessions.list.subscribe, () => sessions.list.getSnapshot())
  const current = sessionList.current
  const currentSummary = current !== undefined ? sessionList.byId[current] : undefined
  const currentRunning = currentSummary?.running === true
  const [filter, setFilter] = useState('')
  const [showNew, setShowNew] = useState(false)
  const selected = selectedTaskOf(snapshot)
  const visible = snapshot.tasks.filter(task => matchesFilter(task, filter))

  return (
    <div className={css.board} data-dsh-taskboard-board="">
      <header className={css.boardHeader}>
        <h2 className={css.boardTitle}>{t('board.title')}</h2>
        <input
          className={css.search}
          type="search"
          placeholder={t('board.search')}
          value={filter}
          onChange={event => { setFilter(event.target.value) }}
          aria-label={t('board.search')}
        />
        <button
          type="button"
          className={css.primaryButton}
          onClick={() => { setShowNew(true) }}
        >
          + {t('board.new')}
        </button>
        <button
          type="button"
          className={css.ghostButton}
          onClick={() => { controller.closeBoard() }}
        >
          {t('board.close')}
        </button>
      </header>

      <CurrentSessionBlock sessions={sessions} summary={currentSummary} />

      <div className={css.columns}>
        {COLUMNS.map(column => {
          const tasks = visible.filter(task => task.status === column.status)
          // 当前会话生命周期活动卡：运行中 -> 进行中；结束（空闲且非空白）-> 已完成。
          const showLiveRunning = column.status === 'running' && currentRunning && currentSummary !== undefined
          const showLiveDone =
            column.status === 'done' && currentSummary !== undefined && !currentSummary.blank && !currentRunning
          const showLiveCard = showLiveRunning || showLiveDone
          return (
            <section key={column.status} className={css.column} data-status={column.status}>
              <header className={css.columnHeader}>
                <span className={css.statusDot} data-status={column.status} aria-hidden="true" />
                <h3 className={css.columnTitle}>{t(STATUS_KEY[column.status])}</h3>
                <span className={css.columnCount}>{tasks.length + (showLiveCard ? 1 : 0)}</span>
              </header>
              <div className={css.cards}>
                {showLiveCard && (
                  <div className={css.card} data-status={column.status}>
                    <span className={css.cardTitle}>当前会话 · {currentSummary.displayTitle}</span>
                    {workspaceName(currentSummary.cwd) !== undefined && (
                      <span className={css.cardExcerpt}>工作区：{workspaceName(currentSummary.cwd)}</span>
                    )}
                    <span className={css.cardMeta}>
                      {showLiveRunning ? (
                        <>
                          <span className={css.cardRunningLabel}>正在执行</span>
                          <span className={css.cardSpinner} aria-hidden="true" />
                        </>
                      ) : (
                        <span className={css.cardRun} data-result="succeeded">已完成</span>
                      )}
                    </span>
                  </div>
                )}
                {tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => { controller.openTask(task.id) }}
                  />
                ))}
                {tasks.length === 0 && !showLiveCard && <div className={css.columnEmpty}>{t('board.empty')}</div>}
              </div>
            </section>
          )
        })}
      </div>

      {selected !== undefined && (
        <TaskDetail controller={controller} task={selected} />
      )}
      {showNew && (
        <NewTaskModal
          controller={controller}
          onClose={() => { setShowNew(false) }}
        />
      )}
    </div>
  )
}
