/**
 * Tests for the update-status logic: link-mode (local dev install) probes the
 * registry for the latest release so the panel shows the real npm version
 * instead of "-", and npm mode still compares per-package.
 * @module @captain1275/dsh-remote-web-ui/update
 */
import { describe, expect, it } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { checkUpdates, compareVersions, parseSemver, type UpdateCheckDeps } from './update.ts'

/** Build a fake install: profile + profile package.json + node_modules anchor. */
function makeInstall(profileName: string, depSpec: string): { profileDir: string; anchorPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'update-test-'))
  const profileDir = join(root, profileName)
  const nm = join(profileDir, 'node_modules', '@captain1275', 'dsh-web-ui-all')
  mkdirSync(nm, { recursive: true })
  mkdirSync(join(profileDir, 'node_modules', '@captain1275', 'dsh-pet'), { recursive: true })
  writeFileSync(join(profileDir, 'package.json'), JSON.stringify({
    name: `dsh-profile-${profileName}`,
    dependencies: { '@captain1275/dsh-web-ui-all': depSpec },
  }))
  writeFileSync(join(nm, 'package.json'), JSON.stringify({
    name: '@captain1275/dsh-web-ui-all',
    version: '0.1.12',
    dependencies: { '@captain1275/dsh-pet': '0.1.12' },
  }))
  writeFileSync(join(profileDir, 'node_modules', '@captain1275', 'dsh-pet', 'package.json'), JSON.stringify({
    name: '@captain1275/dsh-pet',
    version: '0.1.12',
  }))
  return { profileDir, anchorPath: join(nm, 'package.json') }
}

function makeDeps(anchorPath: string, latest: string | undefined): UpdateCheckDeps {
  return {
    anchorManifestPath: anchorPath,
    resolve: (spec) => {
      // Resolve family packages next to the anchor's node_modules root.
      const idx = spec.indexOf('@captain1275/')
      const name = spec.slice(idx).split('/package.json')[0]
      const anchor = anchorPath.replace(/[\\/]@captain1275[\\/]dsh-web-ui-all[\\/]package\.json$/, '')
      return join(anchor, name, 'package.json')
    },
    fetchLatest: async () => latest,
  }
}

describe('checkUpdates link mode', () => {
  it('probes the registry latest even for a local dev install', async () => {
    const { anchorPath } = makeInstall('web', 'link:../dsh-web-ui-all')
    const status = await checkUpdates(makeDeps(anchorPath, '0.2.0'))
    expect(status.mode).toBe('link')
    expect(status.anchor).toBe('@captain1275/dsh-web-ui-all')
    expect(status.packages[0]?.latest).toBe('0.2.0')
    expect(status.packages[0]?.current).toBe('0.1.12')
    expect(status.packages[0]?.outdated).toBe(true)
    rmSync(join(tmpdir(), 'update-test-'), { recursive: true, force: true })
  })

  it('reports a missing latest as undefined (renders "-")', async () => {
    const { anchorPath } = makeInstall('web', 'link:../dsh-web-ui-all')
    const status = await checkUpdates(makeDeps(anchorPath, undefined))
    expect(status.mode).toBe('link')
    expect(status.packages[0]?.latest).toBeUndefined()
    expect(status.packages[0]?.outdated).toBe(false)
  })
})

describe('checkUpdates npm mode', () => {
  it('flags outdated family packages against the registry', async () => {
    const { anchorPath } = makeInstall('web', '^0.1.12')
    const status = await checkUpdates(makeDeps(anchorPath, '0.2.0'))
    expect(status.mode).toBe('npm')
    expect(status.outdated).toBe(true)
    expect(status.packages.length).toBeGreaterThan(1)
  })
})

describe('semver helpers', () => {
  it('parses and compares versions', () => {
    expect(parseSemver('0.2.0')).toEqual({ major: 0, minor: 2, patch: 0, prerelease: [] })
    expect(compareVersions('0.2.0', '0.1.12')).toBeGreaterThan(0)
    expect(compareVersions('0.1.12', '0.2.0')).toBeLessThan(0)
    expect(compareVersions('0.2.0', '0.2.0')).toBe(0)
  })
})
