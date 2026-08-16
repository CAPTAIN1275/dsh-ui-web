/**
 * Smoke tests for dsh-web-ui-settings: locales, persona config normalization,
 * and skill-file sync (the CI gate requires at least one test file per package).
 * @module @captain1275/dsh-client-ui-web-ui-settings
 */
import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { en, zh, type WebUIPluginsKey } from './client/locales.ts'
import {
  DEFAULT_PERSONA,
  PERSONA_PRESETS,
  SKILL_NAME_RE,
  applyPersonaSkill,
  currentPluginVersion,
  isVersionNewer,
  normalizeConfig,
  personaConfigPath,
  personaSkillDisabledPath,
  personaSkillPath,
  readPersonaConfig,
} from './index.ts'

/** 测试用：在临时 DSH_HOME 下运行。 */
function withTempHome(fn: () => void): void {
  const home = join(tmpdir(), `dsh-web-ui-settings-test-${process.pid}-${Date.now()}`)
  const prev = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    fn()
  } finally {
    if (prev === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prev
    rmSync(home, { recursive: true, force: true })
  }
}

describe('dsh-web-ui-settings locales', () => {
  it('defines the Web UI plugin group copy in zh', () => {
    expect(zh['title']).toBe('Web UI 插件')
  })

  it('zh and en share the same key set', () => {
    const zhKeys = Object.keys(zh).sort() as WebUIPluginsKey[]
    const enKeys = Object.keys(en).sort()
    expect(enKeys).toEqual(zhKeys)
  })
})

describe('dsh-web-ui-settings persona host logic', () => {
  it('default persona is enabled with a valid skill name', () => {
    expect(DEFAULT_PERSONA.enabled).toBe(true)
    expect(SKILL_NAME_RE.test(DEFAULT_PERSONA.name)).toBe(true)
    expect(DEFAULT_PERSONA.description.length).toBeGreaterThan(0)
    expect(DEFAULT_PERSONA.content.length).toBeGreaterThan(0)
  })

  it('normalizes config and rejects invalid skill names', () => {
    expect(normalizeConfig({ name: 'catgirl-rp' })?.name).toBe('catgirl-rp')
    expect(normalizeConfig({ name: 'Bad Name!' })).toBeUndefined()
    expect(normalizeConfig({ name: '小咪' })).toBeUndefined()
  })

  it('reads default config when persona.json is absent', () => {
    withTempHome(() => {
      expect(readPersonaConfig().name).toBe(DEFAULT_PERSONA.name)
    })
  })

  it('writes persona.json and syncs SKILL.md on enable, stashes on disable', () => {
    withTempHome(() => {
      const cfg = { ...DEFAULT_PERSONA, description: '测试描述', content: '# 测试正文' }
      applyPersonaSkill(cfg)
      expect(existsSync(personaConfigPath())).toBe(false) // applyPersonaSkill 不写 json
      expect(readFileSync(personaSkillPath(), 'utf8')).toContain('# 测试正文')

      applyPersonaSkill({ ...cfg, enabled: false })
      expect(existsSync(personaSkillPath())).toBe(false)
      expect(existsSync(personaSkillDisabledPath())).toBe(true)

      applyPersonaSkill(cfg)
      expect(readFileSync(personaSkillPath(), 'utf8')).toContain('# 测试正文')
    })
  })

  it('persists config via persona.json for read-back', () => {
    withTempHome(() => {
      mkdirSync(join(process.env.DSH_HOME as string, 'skills'), { recursive: true })
      const cfg = { ...DEFAULT_PERSONA, name: 'my-persona', content: '# 我的' }
      writeFileSync(personaConfigPath(), JSON.stringify(cfg), 'utf8')
      expect(readPersonaConfig().name).toBe('my-persona')
    })
  })
})

describe('dsh-web-ui-settings persona presets', () => {
  it('ships the catgirl preset with a valid skill name and body', () => {
    const presets = PERSONA_PRESETS
    expect(presets.length).toBeGreaterThan(0)
    const catgirl = presets.find((p) => p.id === 'catgirl')
    expect(catgirl).toBeDefined()
    expect(SKILL_NAME_RE.test(catgirl!.persona.name)).toBe(true)
    expect(catgirl!.persona.description.length).toBeGreaterThan(0)
    expect(catgirl!.persona.content.length).toBeGreaterThan(0)
    // 预设内容不含具体情绪标签（如 <<兴奋>>），只允许「禁止使用」规则里的抽象写法。
    expect(catgirl!.persona.content).not.toContain('<<兴奋>>')
    expect(catgirl!.persona.content).not.toContain('<<难过>>')
  })
})

describe('dsh-web-ui-settings version helpers', () => {
  it('compares semver correctly', () => {
    expect(isVersionNewer('0.2.6', '0.2.5')).toBe(true)
    expect(isVersionNewer('0.2.6', '0.2.6')).toBe(false)
    expect(isVersionNewer('0.2.5', '0.2.6')).toBe(false)
    expect(isVersionNewer('0.10.0', '0.9.9')).toBe(true)
    expect(isVersionNewer('1.0.0', '0.99.99')).toBe(true)
    expect(isVersionNewer('bad', '0.2.6')).toBe(false)
    expect(isVersionNewer('0.2.6', 'bad')).toBe(true)
  })

  it('reads a plausible version from the package manifest', () => {
    expect(currentPluginVersion()).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
