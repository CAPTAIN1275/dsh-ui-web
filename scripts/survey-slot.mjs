import { readFileSync, existsSync } from 'node:fs'
const pkgs = ['dsh-pet', 'dsh-task-board', 'dsh-ssh', 'dsh-usage-dashboard', 'skins/skin-center']
for (const d of pkgs) {
  const f = `packages/${d}/src/client/index.ts`
  if (!existsSync(f)) { console.log(`=== ${d} === (no src/client/index.ts)`); continue }
  const t = readFileSync(f, 'utf8')
  const nsMatches = [...t.matchAll(/(?:NS|_NS|NAMESPACE)\s*=\s*['"]([^'"]+)['"]/g)].map(m => m[1])
  const itemCount = (t.match(/name: 'web-ui\.plugin\.item'/g) || []).length
  const directCount = (t.match(/name: 'settings\.plugin\.item'/g) || []).length
  console.log(`=== ${d} === namespaces:[${nsMatches.join(',')}] web-ui.plugin.item:${itemCount} settings.plugin.item:${directCount}`)
}
