/**
 * Global floating pet entry. The pet is host-global (its state, display and
 * interactions live on `/api/pet/*` endpoints with no session dimension), so
 * it must not ride a session-scoped slot — on the new-conversation screen no
 * session exists to scope a slot by, and the pet would vanish (issue #48).
 * The client half therefore mounts this entry straight onto `document.body`
 * (see index.ts): while visible it renders the floating WhalePet (a portal),
 * while hidden it renders a fixed-position summon button.
 * @module @captain1275/dsh-pet/client/PetDockEntry
 */

import { useEffect, useSyncExternalStore, type ReactElement } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { PetDisplayConfig } from '../persist.ts'
import type { PetStoreInstance } from './pet-store.ts'
import { WhalePet } from './WhalePet.tsx'
import { NS } from './locales.ts'
import styles from './pet.module.css'

/** Injected actions handed to the dock entry component. */
export interface PetInjected {
  /** The app-wide pet store instance (snapshot + feedback). */
  store: PetStoreInstance
  /** Ensure the first snapshot is fetched (called on mount). */
  ensure: () => void
  /** Pet the whale girl (click). */
  pet: () => void
  /** Feed the whale girl. */
  feed: () => void
  /** Hide the whale girl. */
  hide: () => void
  /** Summon the hidden whale girl back. */
  summon: () => void
  /** Persist a drag position. */
  dragEnd: (right: number, bottom: number) => void
  /** Rename the pet (persisted by the host). */
  rename: (name: string) => void
  /** Clear the reaction bubble. */
  feedbackDone: () => void
  /** Show an idle chatter bubble (random ambient lines). */
  say: (text: string) => void
}

/** Composed props of the global pet entry (locale + injected; no slot runtime share). */
export type PetDockEntryProps =
  PetInjected
  & PropsLocale<typeof NS>

const DEFAULT_DISPLAY: PetDisplayConfig = { visible: true, size: 160, right: 24, bottom: 20 }

/**
 * Dock entry: while the pet is visible, mount the floating WhalePet (it
 * portals itself onto document.body); while hidden, render the summon
 * button so the pet can always come back. The store is the plugin-owned
 * single instance — the slot system provides none because the pet is
 * host-global, not session-scoped.
 */
export function PetDockEntry(props: PetDockEntryProps): ReactElement {
  const { store, ensure } = props
  const ui = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const snapshot = ui.snapshot
  const feedback = ui.feedback
  const visible = snapshot?.display.visible ?? true

  useEffect(() => {
    ensure()
  }, [ensure])

  if (visible) {
    return (
      <span data-pet-dock data-testid="pet-dock">
        <WhalePet
          snapshot={snapshot}
          display={snapshot?.display ?? DEFAULT_DISPLAY}
          feedback={feedback}
          onPet={props.pet}
          onFeed={props.feed}
          onHide={props.hide}
          onDragEnd={props.dragEnd}
          onRename={props.rename}
          onFeedbackDone={props.feedbackDone}
          say={props.say}
          t={props.t}
        />
      </span>
    )
  }
  const display = snapshot?.display ?? DEFAULT_DISPLAY
  return (
    <button
      type="button"
      className={styles.summon}
      style={{ bottom: display.bottom }}
      onClick={props.summon}
      title={props.t('pet.summon', { name: snapshot?.name ?? '看板娘' })}
      data-testid="pet-summon"
      aria-label={props.t('pet.summon', { name: snapshot?.name ?? '看板娘' })}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512">
        <path d="M96 64a64 64 0 1 1 128 0A64 64 0 1 1 96 64zm48 320l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-192.2L59.1 321c-9.4 15-29.2 19.4-44.1 10S-4.5 301.9 4.9 287l39.9-63.3C69.7 184 113.2 160 160 160s90.3 24 115.2 63.6L315.1 287c9.4 15 4.9 34.7-10 44.1s-34.7 4.9-44.1-10L240 287.8 240 480c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96-32 0z" />
      </svg>
    </button>
  )
}
