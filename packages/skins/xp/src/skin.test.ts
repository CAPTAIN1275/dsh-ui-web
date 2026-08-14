/**
 * Minimal smoke test (CI requires at least one test file per package).
 * @module skin
 */
import { describe, expect, it } from 'vitest'
import skin from '../skin.json'

describe('skin manifest', () => {
  it('carries an id and a name', () => {
    expect(typeof skin.id).toBe('string')
    expect(typeof skin.name).toBe('string')
  })
})
