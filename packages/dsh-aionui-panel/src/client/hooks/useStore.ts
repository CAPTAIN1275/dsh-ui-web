/**
 * React bindings for the framework-free stores: useSyncExternalStore with a
 * stable snapshot (the stores return immutable snapshots, so selector-free
 * subscription is safe), plus a stable-callback helper for event handlers.
 * @module dsh-aionui-panel/client/hooks/useStore
 */

import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { StateHandle } from '../store.ts'

/** Subscribe a component to one store (full snapshot). */
export function useStore<S>(store: StateHandle<S>): S {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

/** A callback whose identity never changes but always reads fresh values. */
export function useLatest<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn)
  ref.current = fn
  return useCallback((...args: Parameters<T>) => ref.current(...args), []) as T
}
