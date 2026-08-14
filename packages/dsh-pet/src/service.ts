/**
 * Pet host service — the `pet.*` RPC domain. Owns the state machine wiring
 * (maps core rc.6 session events — turn/step/tool boundaries — and the
 * session lifecycle onto the pet phases), the affinity ledger, and the
 * persisted display config. The API gateway maps this service's methods onto
 * `pet.state` / `pet.interact` / `pet.setVisible` / `pet.setConfig`
 * for browser consumers.
 * @module @captain1275/dsh-pet/service
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import {
  applyInteraction,
  applyTurnReward,
  defaultAffinityConfig,
  rankOf,
  settleTimeAffinity,
  type AffinityConfig,
  type AffinityState,
  type PetInteraction,
} from './affinity.ts'
import {
  loadPetPersist,
  petHomeDir,
  savePetPersist,
  DISPLAY_SIZE_MAX,
  DISPLAY_SIZE_MIN,
  DISPLAY_INSET_MAX,
  PET_NAME_MAX_LENGTH,
  type PetDisplayConfig,
  type PetPersist,
} from './persist.ts'
import {
  defaultTreatConfig,
  settleTreatGrants,
  consumeTreat,
  type TreatConfig,
} from './treats.ts'
import {
  defaultPetStateConfig,
  PetStateMachine,
  type PetStateConfig,
  type PetStateSnapshot,
} from './state.ts'

/** Plugin configuration. */
export interface PetConfig {
  /** Affinity tuning. */
  affinity?: Partial<AffinityConfig>
  /** State machine tuning. */
  state?: Partial<PetStateConfig>
  /** Treat economy tuning. */
  treats?: Partial<TreatConfig>
  /** Persistence directory override (defaults to $DSH_HOME). */
  persistDir?: string
  /** Master switch for the plugin (browser half + host routes). */
  enabled?: boolean
}

/**
 * The pet's settings-namespace section: the display fields and name the web
 * settings surface edits. `right`/`bottom` are also updated by drag
 * interactions, which keep the settings document in sync through the service.
 */
export interface PetSettingsSection {
  /** Master switch. */
  visible: boolean
  /** Scale of the rendered pet in px (sprite cell height). */
  size: number
  /** Horizontal inset from the viewport right edge, px. */
  right: number
  /** Vertical inset from the viewport bottom edge, px. */
  bottom: number
  /** User-customizable pet display name. */
  name: string
  /** Master switch for the plugin (browser half + host routes). */
  enabled?: boolean
}

/** Settings namespace of the pet capability. Spelled here rather than imported: the browser half spells the same value. */
export const PET_SETTINGS_NAMESPACE = 'pet'

/** Snapshot returned by `pet.state`. */
export interface PetStateView {
  animation: PetStateSnapshot['animation']
  bubble?: string
  phase: PetStateSnapshot['phase']
  sessionActive: boolean
  /** Affinity ledger snapshot. */
  affinity: {
    points: number
    rank: string
    rankEmoji: string
    pets: number
    feeds: number
    turns: number
    /** True while the pet interaction is inside its cooldown. */
    petCooldown: boolean
    /** True while the feed is inside its cooldown. */
    feedCooldown: boolean
  }
  /** Display configuration. */
  display: PetDisplayConfig
  /** User-customizable pet display name. */
  name: string
  /** Treat (小鱼干) stock snapshot. */
  treats: {
    /** Stocked treats now. */
    stocked: number
    /** Stock cap. */
    max: number
  }
}

/** Result of `pet.interact`. */
export interface PetInteractResult {
  /** Reaction copy bubble. */
  reaction: string
  /** Points gained (0 when inside the cooldown). */
  delta: number
  /** Full affinity snapshot (same shape as state view). */
  affinity: PetStateView['affinity']
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    pet: PetService
  }
}

/**
 * Cordis service exposing the pet RPC domain. Lazy: nothing is scanned or
 * written until a query or interaction arrives; event listeners update only
 * in-memory state, and persistence happens on interaction/config changes
 * plus every completed turn.
 */
export class PetService extends Service {
  static inject: string[] = []

  private readonly machine: PetStateMachine
  private readonly affinityConfig: AffinityConfig
  private readonly treatConfig: TreatConfig
  private readonly persistDir: string
  private persist: PetPersist
  /** Completed turns already rewarded, per session (turn numbers are per-session). */
  private rewardedTurns = new Map<string, number>()
  private enabled: boolean
  private disposeActivity: (() => void) | undefined

  constructor(ctx: Context, config: PetConfig = {}) {
    super(ctx, 'pet')
    this.persistDir = config.persistDir ?? petHomeDir()
    this.affinityConfig = { ...defaultAffinityConfig, ...(config.affinity ?? {}) }
    this.treatConfig = { ...defaultTreatConfig, ...(config.treats ?? {}) }
    this.machine = new PetStateMachine({
      ...defaultPetStateConfig,
      ...(config.state ?? {}),
    })
    this.persist = loadPetPersist(this.persistDir)
    this.enabled = config.enabled ?? true

    this.syncActivity()
  }

  /** Whether the pet service consumes session activity while enabled. */
  isEnabled(): boolean {
    return this.enabled
  }

  /** RPC: current pet state snapshot. */
  async state(): Promise<PetStateView> {
    return this.view()
  }

  /** Current persisted display config (read-only view). */
  display(): PetDisplayConfig {
    return { ...this.persist.display }
  }

  /** Current persisted pet name (read-only view). */
  petName(): string {
    return this.persist.name
  }

  /** Start or stop the session-activity listeners that drive the pet. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.syncActivity()
  }

  private syncActivity(): void {
    if (this.disposeActivity !== undefined) {
      this.disposeActivity()
      this.disposeActivity = undefined
    }
    if (!this.enabled) return
    this.disposeActivity = (() => {
      const disposers = [
        this.ctx.on('session/event', (session: Session, event: SessionEvent) => {
          // rc.6 publishes no 'activity/status' event (the working-activity
          // tracker is gone), so the pet derives its phases from the core
          // session vocabulary instead.
          switch (event.type) {
            case 'turn/start':
              this.machine.onSessionActive()
              break
            case 'step/start':
              this.machine.onSessionActive()
              this.machine.onActivityStatus({ phase: 'thinking' })
              break
            case 'tool/call':
              this.machine.onSessionActive()
              this.machine.onActivityStatus({ phase: 'tool', line: 'tool: ' + event.data.name })
              break
            case 'turn/end':
              this.machine.onSessionActive()
              if (event.data.reason.kind === 'completed') {
                this.machine.onActivityStatus({ phase: 'done' })
                this.rewardTurn(String(session.id), event.data.turn)
              } else {
                // Aborted / failed turns clear the working pose instead of
                // freezing the pet on its last phase.
                this.machine.onActivityStatus({ phase: 'idle' })
              }
              break
            default:
              break
          }
        }),
        this.ctx.on('session/disposed', () => {
          this.machine.onSessionDisposed()
        }),
      ]
      return () => { for (const dispose of disposers) dispose() }
    })()
  }

  /** RPC: pet or feed the pet. */
  async interact(kind: PetInteraction): Promise<PetInteractResult> {
    const nowMs = Date.now()
    // Feeding consumes a treat: settle the economy first (work + time
    // output since the last settlement), then gate on the feed cooldown
    // BEFORE spending stock — a feed inside the cooldown must not burn a
    // treat for nothing.
    if (kind === 'feed') this.settleTreats(nowMs)
    const outcome = applyInteraction(this.persist.affinity, kind, nowMs, this.affinityConfig)
    if (kind === 'feed' && !outcome.accepted) {
      return { reaction: outcome.reaction, delta: 0, affinity: this.affinityView(this.persist.affinity) }
    }
    if (kind === 'feed') {
      const consume = consumeTreat(this.persist.treats)
      if (!consume.ok) {
        const affinity = this.affinityView(this.persist.affinity)
        return {
          reaction: '没有小鱼干了，多陪鲸鱼娘工作一会儿吧～',
          delta: 0,
          affinity,
        }
      }
      this.persist = { ...this.persist, treats: consume.ledger }
    }
    if (outcome.accepted) {
      this.persist = { ...this.persist, affinity: outcome.affinity }
      this.flush()
    }
    const affinity = this.affinityView(outcome.affinity)
    return { reaction: outcome.reaction, delta: outcome.delta, affinity }
  }

  /** RPC: show or hide the pet. */
  async setVisible(visible: boolean): Promise<{ ok: true; display: PetDisplayConfig }> {
    this.persist = { ...this.persist, display: { ...this.persist.display, visible } }
    this.flush()
    this.syncSettingsFromPet()
    return { ok: true, display: this.persist.display }
  }

  /** RPC: update display config (size / position). Values are clamped to whole pixels. */
  async setConfig(patch: Partial<PetDisplayConfig>): Promise<{ ok: true; display: PetDisplayConfig }> {
    const next = { ...this.persist.display, ...patch }
    next.size = Math.round(Math.min(DISPLAY_SIZE_MAX, Math.max(DISPLAY_SIZE_MIN, next.size)))
    next.right = Math.round(Math.min(DISPLAY_INSET_MAX, Math.max(0, next.right)))
    next.bottom = Math.round(Math.min(DISPLAY_INSET_MAX, Math.max(0, next.bottom)))
    this.persist = { ...this.persist, display: next }
    this.flush()
    this.syncSettingsFromPet()
    return { ok: true, display: this.persist.display }
  }

  /** RPC: rename the pet (trimmed, 1–20 chars). */
  async setName(name: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
    const trimmed = name.trim()
    if (trimmed === '') return { ok: false, error: 'name-empty' }
    if (trimmed.length > PET_NAME_MAX_LENGTH) return { ok: false, error: 'name-too-long' }
    this.persist = { ...this.persist, name: trimmed }
    this.flush()
    this.syncSettingsFromPet()
    return { ok: true, name: trimmed }
  }

  /**
   * Apply a committed settings section to the persisted display config. Called
   * by the settings surface on every change; values are clamped exactly like
   * the setConfig RPC so both write paths converge.
   * @param section - the resolved settings section.
   */
  applySettingsSection(section: PetSettingsSection): void {
    const next = { ...this.persist.display }
    next.visible = section.visible && (section.enabled ?? true)
    next.size = Math.round(Math.min(DISPLAY_SIZE_MAX, Math.max(DISPLAY_SIZE_MIN, section.size)))
    next.right = Math.round(Math.min(DISPLAY_INSET_MAX, Math.max(0, section.right)))
    next.bottom = Math.round(Math.min(DISPLAY_INSET_MAX, Math.max(0, section.bottom)))
    this.persist = { ...this.persist, display: next, name: section.name.trim() }
    this.flush()
  }

  /** Mirror the persisted display config into the settings document (best-effort). */
  private syncSettingsFromPet(): void {
    const settings = this.ctx.get('settings', false) as { update(ns: string, patch: object): Promise<void> } | undefined
    if (settings === undefined) return
    void settings.update(PET_SETTINGS_NAMESPACE, {
      visible: this.persist.display.visible,
      size: this.persist.display.size,
      right: this.persist.display.right,
      bottom: this.persist.display.bottom,
      name: this.persist.name,
    }).catch(() => {
      // A settings write failure must not break the pet's own persistence.
    })
  }

  /** Award the turn reward once per completed turn (idempotent per session + turn). */
  private rewardTurn(sessionId: string, turn: number): void {
    const last = this.rewardedTurns.get(sessionId) ?? 0
    if (turn <= last) return
    this.rewardedTurns.set(sessionId, turn)
    this.persist = { ...this.persist, affinity: applyTurnReward(this.persist.affinity, this.affinityConfig) }
    this.flush()
  }

  /**
   * Settle the treat economy (work + time output since the last settlement)
   * and persist whenever the ledger changed. A zero-gain first settlement
   * still starts the time clock (anchor write), which is what lets the
   * 30-minute time output ever accrue.
   */
  private settleTreats(nowMs: number): void {
    const settlement = settleTreatGrants(
      this.persist.treats,
      this.persist.affinity.turns,
      nowMs,
      this.treatConfig,
    )
    if (settlement.ledger !== this.persist.treats) {
      this.persist = { ...this.persist, treats: settlement.ledger }
      this.flush()
    }
  }

  private view(): PetStateView {
    const snapshot = this.machine.render()
    const nowMs = Date.now()
    // Time-output treats and companionship growth accrue while the host is
    // idle too; settle on read.
    this.settleTreats(nowMs)
    const nextAffinity = settleTimeAffinity(this.persist.affinity, nowMs, this.affinityConfig)
    if (nextAffinity !== this.persist.affinity) {
      this.persist = { ...this.persist, affinity: nextAffinity }
      this.flush()
    }
    return {
      animation: snapshot.animation,
      ...(snapshot.bubble === undefined ? {} : { bubble: snapshot.bubble }),
      phase: snapshot.phase,
      sessionActive: snapshot.sessionActive,
      affinity: this.affinityView(this.persist.affinity),
      display: { ...this.persist.display },
      name: this.persist.name,
      treats: {
        stocked: this.persist.treats.treats,
        max: this.treatConfig.maxTreats,
      },
    }
  }

  private affinityView(affinity: AffinityState): PetStateView['affinity'] {
    const nowMs = Date.now()
    const rank = rankOf(affinity.points)
    return {
      points: affinity.points,
      rank: rank.name,
      rankEmoji: rank.emoji,
      pets: affinity.pets,
      feeds: affinity.feeds,
      turns: affinity.turns,
      petCooldown: nowMs - affinity.lastPetAt < this.affinityConfig.petCooldownMs,
      feedCooldown: nowMs - affinity.lastFeedAt < this.affinityConfig.feedCooldownMs,
    }
  }

  private flush(): void {
    try {
      savePetPersist(this.persist, this.persistDir)
    } catch {
      // Persistence is best-effort; the in-memory ledger keeps working.
    }
  }
}
