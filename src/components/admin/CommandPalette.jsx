import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon } from './ui'
import { navCommands, rankItems, norm } from '../../lib/commandSearch'

// Ctrl+K / Cmd+K — buscador global do ecossistema Seravie.
// Encontra: navegação (painéis/abas), dados reais (clientes, empresas, unidades,
// produtos, pedidos, conversas), ações rápidas e ajuda. Teclado 100% funcional.

const GROUP_ORDER = ['Ações', 'Resultados', 'Navegação', 'Ajuda']

// Ações rápidas — navegam para a tela certa (a criação em si acontece lá).
const QUICK_ACTIONS = [
  { id: 'act:new_contact', label: 'Novo cliente', icon: 'user', route: 'crm', keywords: ['adicionar', 'cadastrar', 'lead'] },
  { id: 'act:new_company', label: 'Nova empresa', icon: 'building', route: 'crm_companies', keywords: ['organização', 'cnpj'] },
  { id: 'act:new_sale', label: 'Nova venda (PDV)', icon: 'tag', route: 'pos', keywords: ['pedido', 'caixa', 'vender'] },
  { id: 'act:new_deal', label: 'Novo negócio (Pipeline)', icon: 'chart', route: 'pipeline', keywords: ['oportunidade', 'funil'] },
  { id: 'act:invite_manager', label: 'Convidar gerente (unidade)', icon: 'users', route: 'franchise', keywords: ['equipe', 'rede', 'franquia'] },
  { id: 'act:network', label: 'Painel da Rede', icon: 'grid', route: 'franchise', keywords: ['consolidado', 'unidades', 'multi-loja'] },
  { id: 'act:settings', label: 'Configurações', icon: 'gear', route: 'settings', keywords: ['marca', 'logo', 'endereço'] },
]

const HELP_ITEMS = [
  { id: 'help:shortcuts', label: 'Ctrl K / ⌘K — abrir este buscador', icon: 'search', kind: 'help' },
  { id: 'help:nav', label: '↑ ↓ navegar · Enter abrir · Esc fechar', icon: 'grip', kind: 'help' },
  { id: 'help:search', label: 'Dica: digite parte do nome — busca sem acento e por partes', icon: 'spark', kind: 'help' },
]

// Fontes de dados: cada uma vira um grupo de resultados ao pesquisar.
const DATA_SOURCES = [
  { key: 'contacts', table: 'contacts', label: 'Clientes', icon: 'user', route: 'crm', cols: 'id,name,email,phone', text: (r) => [r.name, r.email, r.phone], title: (r) => r.name || r.email || 'Cliente', sub: (r) => r.email || r.phone || '' },
  { key: 'companies', table: 'contacts', label: 'Empresas', icon: 'building', route: 'crm_companies', filter: (q) => q.eq('type', 'company'), cols: 'id,name,email,phone,type', text: (r) => [r.name, r.email], title: (r) => r.name || 'Empresa', sub: (r) => r.email || '' },
  { key: 'units', table: 'units', label: 'Unidades', icon: 'map', route: 'franchise', cols: 'id,name,city,state', text: (r) => [r.name, r.city, r.state], title: (r) => r.name || 'Unidade', sub: (r) => [r.city, r.state].filter(Boolean).join(', ') },
  { key: 'orders', table: 'orders', label: 'Pedidos', icon: 'cart', route: 'pos', cols: 'id,code,total,status,created_at', text: (r) => [r.code, r.id], title: (r) => 'Pedido ' + (r.code || String(r.id).slice(0, 8)), sub: (r) => (r.status || '') + (r.total ? ' · R$ ' + Number(r.total).toFixed(2) : '') },
  { key: 'conversations', table: 'conversations', label: 'Conversas', icon: 'mail', route: 'conversations', cols: 'id,subject,channel', text: (r) => [r.subject, r.channel], title: (r) => r.subject || 'Conversa', sub: (r) => r.channel || '' },
]

export function CommandPalette({ open, onClose, sections = [], onNavigate, notify }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [dataResults, setDataResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const navCmds = useMemo(() => navCommands(sections), [sections])

  // reset ao abrir
  useEffect(() => {
    if (open) { setQ(''); setSel(0); setDataResults([]); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  // busca de dados reais (debounce 250ms, só com 2+ caracteres)
  useEffect(() => {
    if (!open) return
    const term = q.trim()
    if (term.length < 2) { setDataResults([]); setLoading(false); return }
    let alive = true
    setLoading(true)
    const h = setTimeout(async () => {
      try {
        const per = await Promise.all(DATA_SOURCES.map(async (src) => {
          try {
            let query = supabase.from(src.table).select(src.cols).limit(5)
            if (src.filter) query = src.filter(query)
            // busca por nome/assunto quando a coluna existir
            const orParts = []
            if (src.cols.includes('name')) orParts.push(`name.ilike.%${term}%`)
            if (src.cols.includes('subject')) orParts.push(`subject.ilike.%${term}%`)
            if (src.cols.includes('code')) orParts.push(`code.ilike.%${term}%`)
            if (src.cols.includes('email')) orParts.push(`email.ilike.%${term}%`)
            if (orParts.length) query = query.or(orParts.join(','))
            const { data } = await query
            return (data || []).map((r) => ({
              id: src.key + ':' + r.id,
              kind: 'data',
              group: src.label,
              icon: src.icon,
              route: src.route,
              label: src.title(r),
              sublabel: src.sub(r),
              _raw: r,
            }))
          } catch { return [] }
        }))
        if (alive) setDataResults(per.flat())
      } catch { if (alive) setDataResults([]) } finally { if (alive) setLoading(false) }
    }, 250)
    return () => { alive = false; clearTimeout(h) }
  }, [q, open])

  // monta a lista final agrupada e ranqueada
  const groups = useMemo(() => {
    const term = q.trim()
    const actions = rankItems(QUICK_ACTIONS.map((a) => ({ ...a, kind: 'action', group: 'Ações' })), term)
    const nav = rankItems(navCmds, term)
    const help = term ? rankItems(HELP_ITEMS, term) : HELP_ITEMS
    // dados já vêm filtrados do servidor; ranqueia por relevância local
    const data = rankItems(dataResults, term).map((d) => ({ ...d, group: d.group || 'Resultados' }))

    const byGroup = {}
    const push = (arr) => arr.forEach((it) => { const g = it.group || 'Navegação'; (byGroup[g] ||= []).push(it) })
    if (term) { push(actions); push(data); push(nav.slice(0, 20)); push(help) }
    else {
      // estado inicial: ações + navegação principal + ajuda
      push(actions)
      push(nav.filter((n) => n.group && !n.sublabel).slice(0, 12))
      push(help)
    }
    // limita cada grupo e ordena os grupos
    const ordered = Object.keys(byGroup).sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a); const ib = GROUP_ORDER.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    return ordered.map((g) => ({ group: g, items: byGroup[g].slice(0, g === 'Navegação' ? 12 : 8) }))
  }, [q, navCmds, dataResults])

  // lista plana (para navegação por teclado)
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])
  useEffect(() => { setSel(0) }, [q, dataResults])

  const run = useCallback((item) => {
    if (!item) return
    if (item.kind === 'help') { notify?.('Use ↑ ↓ para navegar e Enter para abrir.', 'info'); return }
    if (item.route && onNavigate) onNavigate(item.route)
    if (item.kind === 'data' && item._raw) {
      // guarda o alvo pra tela de destino poder focar (best-effort, via sessionStorage evitado)
      notify?.(`Abrindo ${item.label}…`, 'info')
    }
    onClose?.()
  }, [onNavigate, onClose, notify])

  const onKey = useCallback((e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(flat[sel]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose?.() }
  }, [flat, sel, run, onClose])

  // rola o item selecionado à vista
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${sel}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!open) return null

  let running = -1 // índice global crescente para casar com `sel`
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl glass-pop rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* campo de busca */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07]">
          <Icon name="search" className="w-4.5 h-4.5 text-admin-champ/60 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Buscar telas, clientes, pedidos, ações…"
            className="flex-1 bg-transparent text-admin-text text-sm outline-none placeholder:text-admin-muted/40"
          />
          {loading && <Icon name="refresh" className="w-4 h-4 text-admin-muted/40 animate-spin" />}
          <kbd className="text-[10px] text-admin-muted/40 border border-white/10 rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        {/* resultados */}
        <div ref={listRef} className="max-h-[56vh] overflow-y-auto py-2">
          {flat.length === 0 ? (
            <div className="px-4 py-10 text-center text-admin-muted/40 text-sm">
              Nada encontrado para “{q}”.
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.group} className="mb-1">
                <p className="px-4 py-1 text-[10px] uppercase tracking-wider text-admin-muted/35">{g.group}</p>
                {g.items.map((it) => {
                  running += 1
                  const idx = running
                  const activeItem = idx === sel
                  return (
                    <button
                      key={it.id}
                      data-idx={idx}
                      onMouseEnter={() => setSel(idx)}
                      onClick={() => run(it)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${activeItem ? 'bg-admin-champ/12' : 'hover:bg-white/[0.03]'}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${activeItem ? 'bg-admin-champ/20 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60'}`}>
                        <Icon name={it.icon || 'grid'} className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-admin-text text-sm truncate">{it.label}</p>
                        {it.sublabel && <p className="text-admin-muted/40 text-[11px] truncate">{it.sublabel}</p>}
                      </div>
                      {it.kind === 'action' && <span className="text-[9px] text-admin-champ/50 uppercase tracking-wider shrink-0">ação</span>}
                      {activeItem && <Icon name="down" className="w-3.5 h-3.5 text-admin-champ/50 rotate-[-90deg] shrink-0" />}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* rodapé */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] text-[10px] text-admin-muted/40">
          <span>{flat.length} resultado{flat.length === 1 ? '' : 's'}</span>
          <span className="flex items-center gap-2"><kbd className="border border-white/10 rounded px-1">↑↓</kbd> navegar <kbd className="border border-white/10 rounded px-1">↵</kbd> abrir</span>
        </div>
      </div>
    </div>
  )
}
