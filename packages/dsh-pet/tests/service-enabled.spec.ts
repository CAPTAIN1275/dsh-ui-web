import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import { PetService } from '../src/service.ts'

function activity(phase: string, seq: number): SessionEvent {
  return {
    type: 'activity/status',
    seq,
    time: seq,
    data: { phase },
  } as SessionEvent
}

const session = null as unknown as Session

describe('PetService enabled switch', () => {
  it('stops consuming session activity while disabled and resumes on re-enable', async () => {
    const ctx = new Context()
    const service = new PetService(ctx, { enabled: false })

    ctx.emit('session/event', session, activity('done', 1))
    expect((await service.state()).animation).toBe('idle')

    service.setEnabled(true)
    ctx.emit('session/event', session, activity('done', 2))
    expect((await service.state()).animation).toBe('jumping')

    service.setEnabled(false)
    ctx.emit('session/event', session, activity('done', 3))
    expect((await service.state()).animation).toBe('jumping')
  })

  it('trims settings names so whitespace-only values cannot persist', async () => {
    const ctx = new Context()
    const service = new PetService(ctx)
    service.applySettingsSection({
      visible: true,
      size: 160,
      right: 24,
      bottom: 20,
      name: '  鲸鱼娘  ',
    })
    expect(service.petName()).toBe('鲸鱼娘')
  })
})
