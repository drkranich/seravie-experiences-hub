import { useState } from 'react'
import { CORE_SECTIONS } from './navigation.config'
import { Icon } from './ui'

// Grupos de permissão derivados da navegação: cada módulo (setor) e suas páginas (subsetores).
// Assim o acesso pode ser concedido por página — cada página = um setor com responsável.
export const PERMISSION_GROUPS = (() => {
  const out = []
  for (const sec of CORE_SECTIONS) {
    for (const item of sec.items) {
      out.push({
        key: item.key, label: item.label, group: sec.group,
        pages: (item.pages || []).map((p) => ({ key: p.key, label: p.label })),
      })
    }
  }
  return out
})()

export const ALL_PERM_KEYS = PERMISSION_GROUPS.flatMap((g) => [g.key, ...g.pages.map((p) => p.key)])
const ALL_PERM_KEY_SET = new Set(ALL_PERM_KEYS)

// Níveis: none < view < edit < manage. Só "manage" pode EXCLUIR.
export const LEVEL_ORDER = ['none', 'view', 'edit', 'manage']

// Um perm avulso ('view:x' | 'edit:x' | 'manage:x') -> { level, key }. '*' é tratado à parte.
const parsePerm = (p) => {
  const i = String(p).indexOf(':')
  if (i < 0) return null
  const level = p.slice(0, i)
  const key = p.slice(i + 1)
  if (!LEVEL_ORDER.includes(level)) return null
  return { level, key }
}

// perms (array 'view:<k>' | 'edit:<k>' | 'manage:<k>' | '*') -> mapa de níveis por chave.
// Preserva chaves LEGADAS (fora da navegação) para que não sejam apagadas ao salvar.
export const permsToLevels = (perms) => {
  const arr = Array.isArray(perms) ? perms : []
  const star = arr.includes('*')
  const lv = {}
  // chaves conhecidas (derivadas da navegação)
  ALL_PERM_KEYS.forEach((k) => {
    if (star || arr.includes(`manage:${k}`)) lv[k] = 'manage'
    else if (arr.includes(`edit:${k}`)) lv[k] = 'edit'
    else if (arr.includes(`view:${k}`)) lv[k] = 'view'
    else lv[k] = 'none'
  })
  // chaves legadas presentes nas perms mas ausentes da navegação — mantém o maior nível
  if (!star) {
    arr.forEach((p) => {
      const parsed = parsePerm(p)
      if (!parsed || ALL_PERM_KEY_SET.has(parsed.key)) return
      const cur = lv[parsed.key] || 'none'
      if (LEVEL_ORDER.indexOf(parsed.level) > LEVEL_ORDER.indexOf(cur)) lv[parsed.key] = parsed.level
    })
  }
  return lv
}
// Chaves que estão no mapa de níveis mas NÃO pertencem à navegação (legadas/customizadas).
export const legacyLevelKeys = (lv) => Object.keys(lv || {}).filter((k) => !ALL_PERM_KEY_SET.has(k))
// mapa de níveis -> perms (array). Só grava chaves com acesso.
export const levelsToPerms = (lv) => {
  const out = []
  Object.entries(lv || {}).forEach(([k, v]) => { if (v && v !== 'none') out.push(`${v}:${k}`) })
  return out
}

const LEVEL_STYLE = { none: 'bg-white/[0.04] text-admin-muted/40', view: 'bg-admin-champ/10 text-admin-champ', edit: 'bg-admin-gold/10 text-admin-gold', manage: 'bg-admin-sage/10 text-admin-sage', partial: 'bg-admin-gold/10 text-admin-gold' }
const LEVEL_LABEL = { none: 'Sem acesso', view: 'Ver', edit: 'Editar', manage: 'Gerenciar (excluir)', partial: 'Parcial' }
const nextLevel = (v) => LEVEL_ORDER[(LEVEL_ORDER.indexOf(v === undefined ? 'none' : v) + 1) % LEVEL_ORDER.length]

// Resumo do acesso de um módulo: nível comum ou 'partial'.
function moduleSummary(g, levels) {
  const keys = [g.key, ...g.pages.map((p) => p.key)]
  const vals = keys.map((k) => levels[k] || 'none')
  return vals.every((v) => v === vals[0]) ? vals[0] : 'partial'
}

/**
 * Matriz de permissões por página. `levels` é o mapa { chave: 'none'|'view'|'manage' }.
 * onChange recebe o novo mapa. Módulo aplica em bloco; expandir ajusta página a página.
 */
export function PermissionMatrix({ levels, onChange, readOnly = false }) {
  const [open, setOpen] = useState({})
  const groupsByGroup = PERMISSION_GROUPS.reduce((acc, g) => { (acc[g.group] = acc[g.group] || []).push(g); return acc }, {})
  const legacy = legacyLevelKeys(levels).filter((k) => (levels[k] && levels[k] !== 'none'))

  const setKey = (k, val) => { if (!readOnly) onChange({ ...levels, [k]: val }) }
  const cycleModule = (g) => {
    if (readOnly) return
    const cur = moduleSummary(g, levels)
    const base = cur === 'partial' ? 'view' : nextLevel(cur) // none→view→edit→manage→none
    const upd = { ...levels, [g.key]: base }
    g.pages.forEach((p) => { upd[p.key] = base })
    onChange(upd)
  }

  return (
    <div className={`glass-soft rounded-xl p-2 max-h-[22rem] overflow-y-auto space-y-3 ${readOnly ? 'opacity-70 pointer-events-none' : ''}`}>
      {legacy.length > 0 && (
        <div className="rounded-lg bg-admin-gold/[0.06] border border-admin-gold/20 px-2.5 py-2">
          <p className="text-[9px] uppercase tracking-wider text-admin-gold/80 mb-1">Permissões herdadas (fora dos módulos atuais)</p>
          <div className="flex flex-wrap gap-1.5">
            {legacy.map((k) => (
              <span key={k} className="text-[10px] px-2 py-0.5 rounded-lg bg-admin-gold/10 text-admin-gold/90">{levels[k]}:{k}</span>
            ))}
          </div>
          <p className="text-[10px] text-admin-muted/50 mt-1.5">Mantidas ao salvar. Ajuste o acesso pelos módulos abaixo.</p>
        </div>
      )}
      {Object.entries(groupsByGroup).map(([groupName, mods]) => (
        <div key={groupName}>
          <p className="text-[9px] uppercase tracking-wider text-admin-muted/40 px-2 mb-1">{groupName}</p>
          {mods.map((g) => {
            const summary = moduleSummary(g, levels)
            const badge = summary
            const isOpen = open[g.key]
            return (
              <div key={g.key} className="rounded-lg">
                <div className="flex items-center justify-between px-2 py-1.5 hover:bg-white/[0.02] rounded-lg">
                  <button onClick={() => g.pages.length && setOpen((o) => ({ ...o, [g.key]: !o[g.key] }))} className="flex items-center gap-2 text-left flex-1 min-w-0">
                    {g.pages.length > 0 && <Icon name={isOpen ? 'down' : 'up'} className={`w-3 h-3 text-admin-muted/40 shrink-0 ${isOpen ? '' : 'rotate-90'}`} />}
                    <span className="text-admin-text text-sm font-medium truncate">{g.label}</span>
                    {g.pages.length > 0 && <span className="text-admin-muted/30 text-[10px] shrink-0">{g.pages.length} pág.</span>}
                  </button>
                  <button onClick={() => cycleModule(g)} className={`text-[11px] px-3 py-1 rounded-lg transition-colors shrink-0 ${LEVEL_STYLE[badge]}`}>{LEVEL_LABEL[badge]}</button>
                </div>
                {isOpen && g.pages.length > 0 && (
                  <div className="ml-5 border-l border-white/[0.06] pl-2 py-1 space-y-0.5">
                    {g.pages.map((p) => {
                      const lv = levels[p.key] || 'none'
                      return (
                        <div key={p.key} className="flex items-center justify-between px-2 py-1 hover:bg-white/[0.02] rounded-lg">
                          <span className="text-admin-muted/70 text-xs truncate">{p.label}</span>
                          <button onClick={() => setKey(p.key, nextLevel(lv))} className={`text-[10px] px-2.5 py-0.5 rounded-lg transition-colors shrink-0 ${LEVEL_STYLE[lv]}`}>{LEVEL_LABEL[lv]}</button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
