/**
 * Persistence helpers for panel preferences: range-validated reads (invalid
 * stored values fall back to defaults — a broken or hand-edited value must
 * never produce a 0px or NaN panel), debounced writes, and the LRU registry
 * for preview scopes (at most 12 scopes; the oldest savedAt evicts).
 *
 * Keys follow the AionUi contract verbatim:
 *   chat-workspace-width-px, chat-preview-width-px, preview-panel-split-ratio,
 *   project-panel-collapse:<root>, explorer-ui:<root>, scm-ui:<root>,
 *   preview-ui:<root>.
 * @module dsh-aionui-panel/client/persist
 */

/** Read a stored number, validating it against [min, max]; fallback otherwise. */
export function readStoredNumber(key: string, min: number, max: number, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const value = Number(raw)
    if (!Number.isFinite(value)) return fallback
    if (value < min || value > max) return fallback
    return value
  } catch {
    return fallback
  }
}

/** Read a stored string; fallback when absent. */
export function readStoredString(key: string, fallback = ''): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

/** Write a number if it differs from the stored value (avoids churn). */
export function writeStoredNumber(key: string, value: number): void {
  try {
    const raw = String(Math.round(value))
    if (localStorage.getItem(key) === raw) return
    localStorage.setItem(key, raw)
  } catch {
    // persistence is best-effort; the panel still works
  }
}

/** Write a string if it differs from the stored value. */
export function writeStoredString(key: string, value: string): void {
  try {
    if (localStorage.getItem(key) === value) return
    localStorage.setItem(key, value)
  } catch {
    // best-effort
  }
}

/** Debounced writer: coalesces rapid updates (drag frames) into one write. */
export function debouncedWriter(write: (value: unknown) => void, delayMs = 150): {
  schedule: (value: unknown) => void
  flush: () => void
  dispose: () => void
} {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: unknown = undefined
  let hasPending = false
  const flush = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    if (hasPending) {
      hasPending = false
      write(pending)
    }
  }
  return {
    schedule(value: unknown) {
      pending = value
      hasPending = true
      if (timer !== undefined) return
      timer = setTimeout(flush, delayMs)
    },
    flush,
    dispose() {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      hasPending = false
    },
  }
}

/** The preview-ui scope registry: keys, savedAt values, eviction. */
export const PREVIEW_SCOPE_PREFIX = 'preview-ui:'
/** LRU cap on distinct preview scopes. */
export const PREVIEW_SCOPE_CAP = 12

/** All stored preview scopes with their savedAt timestamps, oldest first. */
export function listPreviewScopes(): Array<{ root: string; savedAt: number }> {
  const out: Array<{ root: string; savedAt: number }> = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key === null || !key.startsWith(PREVIEW_SCOPE_PREFIX)) continue
      const root = key.slice(PREVIEW_SCOPE_PREFIX.length)
      let savedAt = 0
      try {
        const raw = localStorage.getItem(key)
        if (raw !== null) {
          const parsed = JSON.parse(raw) as { savedAt?: unknown }
          if (typeof parsed.savedAt === 'number') savedAt = parsed.savedAt
        }
      } catch {
        savedAt = 0
      }
      out.push({ root, savedAt })
    }
  } catch {
    return []
  }
  out.sort((a, b) => a.savedAt - b.savedAt)
  return out
}

/** Evict the oldest scopes beyond the cap. */
export function evictPreviewScopes(keep: string): void {
  const scopes = listPreviewScopes().filter((scope) => scope.root !== keep)
  let excess = scopes.length - (PREVIEW_SCOPE_CAP - 1)
  for (const scope of scopes) {
    if (excess <= 0) break
    try {
      localStorage.removeItem(`${PREVIEW_SCOPE_PREFIX}${scope.root}`)
    } catch {
      // best-effort
    }
    excess -= 1
  }
}

/** Serialize a JSON value with a size guard (quota failures degrade silently). */
export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    try {
      localStorage.removeItem(key)
    } catch {
      // storage unavailable entirely
    }
    return false
  }
}

/** Parse a stored JSON value; fallback on any failure. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw) as unknown
    // JSON.parse('null') yields null without throwing; descending callers
    // expect an object and would throw on null/primitive, killing their effect.
    if (parsed === null || typeof parsed !== 'object') return fallback
    return parsed as T
  } catch {
    return fallback
  }
}
