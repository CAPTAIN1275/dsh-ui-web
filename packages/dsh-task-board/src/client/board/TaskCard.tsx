/**
 * Task card: the board's column item. Clicking opens the task detail — it
 * never executes anything directly (detail holds the Run button).
 */
import type { TaskRecord } from '../../core/tasks.ts'
import { executionLabel } from '../../core/tasks.ts'
import { t } from '../locales.ts'
import css from '../board.module.css'

/** Compact relative/absolute time label. */
export function formatTime(ms: number): string {
  const date = new Date(ms)
  const now = Date.now()
  const minutes = Math.floor((now - ms) / 60000)
  if (minutes < 1) return t('time.justNow')
  if (minutes < 60) return `${minutes}m`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** One card in a column. */
export function TaskCard({ task, onClick }: { task: TaskRecord; onClick: () => void }) {
  const latest = task.executions[task.executions.length - 1]
  const runs = task.executions.length
  return (
    <button
      type="button"
      className={css.card}
      data-status={task.status}
      onClick={onClick}
      title={task.description !== '' ? task.description : task.title}
    >
      <span className={css.cardTitle}>{task.title}</span>
      {task.description !== '' && <span className={css.cardExcerpt}>{task.description}</span>}
      <span className={css.cardMeta}>
        <span className={css.cardTime}>{t('board.updated')} {formatTime(task.updatedAt)}</span>
        {task.schedule?.enabled === true && (
          <span
            className={css.cardSchedule}
            title={task.schedule.nextRunAt !== undefined
              ? `${t('card.scheduled')} · ${new Date(task.schedule.nextRunAt).toLocaleString()}`
              : t('card.scheduled')}
          >
            {t('card.scheduled')}
          </span>
        )}
        {latest !== undefined && (
          <span className={css.cardRun} data-result={latest.result}>
            {runs} {t('board.runs')}
          </span>
        )}
        {latest?.sessionId !== undefined && (
          <span className={css.cardSession} title={latest.sessionId}>⌁</span>
        )}
        {task.status === 'running' && <span className={css.cardSpinner} aria-hidden="true" />}
      </span>
      {latest !== undefined && executionLabel(latest) === 'running' && (
        <span className={css.cardRunningLabel}>{t('detail.result.running')}…</span>
      )}
    </button>
  )
}
