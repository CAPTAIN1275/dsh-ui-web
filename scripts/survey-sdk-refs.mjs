#!/usr/bin/env node
/** Survey SDK version references across all family packages. */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const roots = ['packages', join('packages', 'skins')]
const files = []
for (const root of roots) {
  if (!existsSync(root)) continue
  for (const entry of readdirSync(root)) {
    const p = join(root, entry, 'package.json')
    if (existsSync(p)) files.push(p)
  }
}

const refs = {}
let withPeer = 0
let withDev = 0
const versions = new Set()
for (const f of files) {
  const pkg = JSON.parse(readFileSync(f, 'utf8'))
  const peers = Object.keys(pkg.peerDependencies ?? {})
  const devs = Object.keys(pkg.devDependencies ?? {})
  const sdkPeers = peers.filter((x) => x.startsWith('@deepseek-ai/'))
  const sdkDevs = devs.filter((x) => x.startsWith('@deepseek-ai/'))
  if (sdkPeers.length) withPeer++
  if (sdkDevs.length) withDev++
  for (const x of sdkPeers) {
    refs[x] = refs[x] ?? { peers: [], devs: [] }
    refs[x].peers.push(f)
    versions.add(`${x} peer ${pkg.peerDependencies[x]}`)
  }
  for (const x of sdkDevs) {
    refs[x] = refs[x] ?? { peers: [], devs: [] }
    refs[x].devs.push(f)
    versions.add(`${x} dev ${pkg.devDependencies[x]}`)
  }
}
console.log(`packages with SDK peers: ${withPeer} | with SDK devDeps: ${withDev}`)
console.log('--- version declarations ---')
for (const v of [...versions].sort()) console.log(v)
