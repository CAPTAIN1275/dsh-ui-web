/**
 * Hosts tab: the host table with search (debounced through listHosts),
 * add/edit/delete/test actions, ~/.ssh/config import, and a connect action
 * that hands the alias to the terminal tab via onConnect.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SshApi } from '../api.ts'
import type { SshHostSummary, TestResult } from '../../protocol.ts'
import { errorMessage, tt } from './helpers.ts'
import { HostFormDialog } from './HostFormDialog.tsx'
import css from './panel.module.css'

/** Hosts tab props. */
export interface HostsTabProps {
  api: SshApi
  /** Connect the given alias in the terminal tab. */
  onConnect: (alias: string) => void
}

/** The host-form dialog invocation. */
type DialogState = { mode: 'create' } | { mode: 'edit'; host: SshHostSummary }

/** The hosts table plus its toolbar and dialogs. */
export function HostsTab({ api, onConnect }: HostsTabProps) {
  const [hosts, setHosts] = useState<SshHostSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [testingAlias, setTestingAlias] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [importing, setImporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const seqRef = useRef(0)

  const load = useCallback(async (query?: string): Promise<void> => {
    const seq = ++seqRef.current
    try {
      const list = await api.listHosts(query)
      if (seq !== seqRef.current) return
      setHosts(list)
      setError(null)
    } catch (cause) {
      if (seq !== seqRef.current) return
      setError(errorMessage(cause))
    }
  }, [api])

  useEffect(() => { void load() }, [load])

  // Debounced search: every keystroke re-filters through the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      const query = search.trim()
      void load(query === '' ? undefined : query)
    }, 300)
    return () => { clearTimeout(timer) }
  }, [search, load])

  const runTest = async (alias: string): Promise<void> => {
    setTestingAlias(alias)
    try {
      const result = await api.testHost(alias)
      setTestResults(prev => ({ ...prev, [alias]: result }))
    } catch (cause) {
      setTestResults(prev => ({ ...prev, [alias]: { ok: false, error: errorMessage(cause) } }))
    } finally {
      setTestingAlias(null)
    }
  }

  const deleteHost = async (alias: string): Promise<void> => {
    if (!window.confirm(tt('hosts.deleteConfirm', { alias }))) return
    try {
      await api.deleteHost(alias)
      void load()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }

  const importConfig = async (): Promise<void> => {
    setImporting(true)
    try {
      const result = await api.importSshConfig()
      setNotice(tt('hosts.imported', { parsed: result.parsed, added: result.added, skipped: result.skipped }))
      void load()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className={css.fillBody}>
      <div className={css.toolbar}>
        <input className={css.search} type="search" placeholder={tt('hosts.search')} value={search} onChange={event => { setSearch(event.target.value) }} />
        <div className={css.toolbarSpacer} />
        <button type="button" className={css.primaryButton} onClick={() => { setDialog({ mode: 'create' }) }}>{tt('hosts.add')}</button>
        <button type="button" className={css.ghostButton} disabled={importing} onClick={() => { void importConfig() }}>{importing ? tt('common.loading') : tt('hosts.import')}</button>
      </div>
      {notice !== null && <div className={css.banner} data-kind="ok">{notice}</div>}
      {error !== null && <div className={css.banner} data-kind="error">{tt('common.error', { error })}</div>}
      {hosts === null && error === null && <div className={css.loading}>{tt('common.loading')}</div>}
      {hosts !== null && hosts.length === 0 && <div className={css.empty}>{tt('hosts.empty')}</div>}
      {hosts !== null && hosts.length > 0 && (
        <div className={css.tableWrap}>
          <table className={css.table}>
            <thead>
              <tr>
                <th>{tt('hosts.col.alias')}</th>
                <th>{tt('hosts.col.host')}</th>
                <th>{tt('hosts.col.user')}</th>
                <th>{tt('hosts.col.auth')}</th>
                <th>{tt('hosts.col.environment')}</th>
                <th>{tt('hosts.col.tags')}</th>
                <th>{tt('hosts.col.description')}</th>
                <th>{tt('hosts.col.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {hosts.map(host => {
                const test = testResults[host.alias]
                return (
                  <tr key={host.alias}>
                    <td className={css.mono}>{host.alias}</td>
                    <td className={css.mono}>{host.host}:{host.port}</td>
                    <td>{host.user}</td>
                    <td><span className={css.badge} data-kind={host.auth}>{host.auth === 'key' ? tt('form.auth.key') : tt('form.auth.password')}</span></td>
                    <td className={css.cellMuted}>{host.environment ?? ''}</td>
                    <td className={css.cellMuted}>{host.tags.join(', ')}</td>
                    <td className={css.cellMuted}>{host.description ?? ''}</td>
                    <td>
                      <div className={css.actions}>
                        <button type="button" className={css.linkButton} disabled={testingAlias === host.alias} onClick={() => { void runTest(host.alias) }}>
                          {testingAlias === host.alias ? tt('hosts.testing') : tt('hosts.test')}
                        </button>
                        {testingAlias === host.alias && <span className={css.spinner} aria-hidden="true" />}
                        {test !== undefined && (
                          <span className={css.inlineTest} data-status={test.ok ? 'ok' : 'fail'}>
                            {test.ok ? tt('hosts.testOk', { latency: test.latencyMs ?? 0 }) : tt('hosts.testFail', { error: test.error ?? '' })}
                          </span>
                        )}
                        <button type="button" className={css.linkButton} onClick={() => { setDialog({ mode: 'edit', host }) }}>{tt('hosts.edit')}</button>
                        <button type="button" className={css.linkButton} data-danger onClick={() => { void deleteHost(host.alias) }}>{tt('hosts.delete')}</button>
                        <button type="button" className={css.ghostButton} onClick={() => { onConnect(host.alias) }}>{tt('hosts.connected')}</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {dialog !== null && (
        <HostFormDialog
          api={api}
          editing={dialog.mode === 'edit' ? dialog.host : null}
          onClose={() => { setDialog(null) }}
          onSaved={() => { setDialog(null); void load() }}
        />
      )}
    </div>
  )
}
