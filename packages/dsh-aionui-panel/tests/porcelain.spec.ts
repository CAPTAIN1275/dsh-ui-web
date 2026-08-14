/**
 * git porcelain parsing tests: staged/unstaged/untracked rows, rename pairs
 * (the -z format carries two NUL-terminated paths), conflicted rows, and
 * unknown letters degrade to the quiet '?' state.
 */
import { describe, expect, it } from 'vitest'
import { parsePorcelain, porcelainState } from '../src/host/git-service.ts'

describe('porcelainState', () => {
  it('maps letters to states', () => {
    expect(porcelainState('A')).toBe('created')
    expect(porcelainState('M')).toBe('modified')
    expect(porcelainState('D')).toBe('deleted')
    expect(porcelainState('R')).toBe('renamed')
    expect(porcelainState('U')).toBe('conflicted')
    expect(porcelainState('?')).toBe('untracked')
    expect(porcelainState('X')).toBe('unknown')
  })
})

describe('parsePorcelain', () => {
  it('parses staged, unstaged and untracked rows', () => {
    const view = parsePorcelain('M  staged.txt\0 M unstaged.txt\0?? new-file.txt\0')
    expect(view.staged).toEqual([{ path: 'staged.txt', state: 'modified', staged: true }])
    expect(view.unstaged).toEqual([{ path: 'unstaged.txt', state: 'modified', staged: false }])
    expect(view.untracked).toEqual([{ path: 'new-file.txt', state: 'untracked', staged: false }])
  })

  it('splits MM into a staged and an unstaged row', () => {
    const view = parsePorcelain('MM both.txt\0')
    expect(view.staged).toEqual([{ path: 'both.txt', state: 'modified', staged: true }])
    expect(view.unstaged).toEqual([{ path: 'both.txt', state: 'modified', staged: false }])
  })

  it('parses rename pairs (old and new paths)', () => {
    const view = parsePorcelain('R  old-name.txt\0new-name.txt\0')
    expect(view.staged).toEqual([{ path: 'new-name.txt', oldPath: 'old-name.txt', state: 'renamed', staged: true }])
    expect(view.unstaged).toEqual([])
  })

  it('marks conflicted rows', () => {
    const view = parsePorcelain('UU conflicted.txt\0')
    expect(view.staged).toEqual([{ path: 'conflicted.txt', state: 'conflicted', staged: true }])
    expect(view.unstaged).toEqual([{ path: 'conflicted.txt', state: 'conflicted', staged: false }])
  })

  it('handles empty output', () => {
    const view = parsePorcelain('')
    expect(view.staged).toEqual([])
    expect(view.unstaged).toEqual([])
    expect(view.untracked).toEqual([])
  })
})
