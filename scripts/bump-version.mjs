#!/usr/bin/env node
/**
 * Bump every family package version to a single target version.
 * Usage: node scripts/bump-version.mjs <x.y.z>
 * Prints changed files; exits non-zero on mismatch.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')

const version = process.argv[2] ?? ''
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('usage: node scripts/bump-version.mjs <x.y.z>')
  process.exit(2)
}

function packageFiles() {
  const out = []
  for (const root of ['packages', join('packages', 'skins')]) {
    const abs = join(REPO_ROOT, root)
    if (!existsSync(abs)) continue
    for (const entry of readdirSync(abs)) {
      const pkgPath = join(abs, entry, 'package.json')
      if (existsSync(pkgPath)) out.push(pkgPath)
    }
  }
  return out.sort()
}

let changed = 0
for (const file of packageFiles()) {
  const raw = readFileSync(file, 'utf8')
  const pkg = JSON.parse(raw)
  if (pkg.version === version) continue
  pkg.version = version
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
  console.log(`[bump] ${pkg.name} ${pkg.version}`)
  changed++
}

if (changed === 0) {
  console.log(`[bump] nothing to change (all already ${version})`)
}
console.log(`[bump] done, ${changed} file(s) written`)
