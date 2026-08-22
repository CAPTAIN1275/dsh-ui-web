#!/usr/bin/env node
/**
 * Bump every @deepseek-ai/dsh-* SDK version declaration from ^0.1.0-rc.6 to
 * ^0.1.1-rc.2 across all family package.json files (peerDependencies and
 * devDependencies). @deepseek-ai/cordis stays untouched (not rc-tracked).
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const OLD = '^0.1.0-rc.6'
const NEW = '^0.1.1-rc.2'

const roots = ['packages', join('packages', 'skins')]
const files = []
for (const root of roots) {
  if (!existsSync(root)) continue
  for (const entry of readdirSync(root)) {
    const p = join(root, entry, 'package.json')
    if (existsSync(p)) files.push(p)
  }
}

let changed = 0
for (const f of files) {
  const raw = readFileSync(f, 'utf8')
  const pkg = JSON.parse(raw)
  let dirty = false
  for (const section of ['peerDependencies', 'devDependencies', 'dependencies']) {
    const deps = pkg[section]
    if (typeof deps !== 'object' || deps === null) continue
    for (const [name, ver] of Object.entries(deps)) {
      if (name.startsWith('@deepseek-ai/') && ver === OLD) {
        deps[name] = NEW
        dirty = true
      }
    }
  }
  if (dirty) {
    writeFileSync(f, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
    console.log(`[sdk-bump] ${pkg.name} -> ${NEW}`)
    changed++
  }
}
console.log(`[sdk-bump] done, ${changed} package(s) updated`)
