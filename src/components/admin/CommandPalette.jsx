import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon } from './ui'
import { navCommands, rankItems, norm } from '../../lib/commandSearch'
import { setFocus } from '../../lib/focusTarget'

// Ctrl+K / Cmd+K — buscador global do ecossistema Seravie.
// Encontra: navegação (painéis/abas), dados reais (clientes, empresas, unidades,
// produtos, pedidos, conversas), ações rápidas e ajuda. Teclado 100% funcional.

const GROUP_ORDER = ['Ações', 'Resultados', 'Navegação', 'Ajuda']
// rótulos dos grupos de dados (vêm das DATA_SOURCES) — ficam logo após "Ações".
const DATA_GROUPS = new Set(['Clientes', 'Empresas', 'Unidades', 'Pedidos', 'Conversas'])

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
  { key: 'companies', table: 'contacts', label: 'Empresas', icon: 'building', route: 'crm', filter: (q) => q.eq('type', 'company'), cols: 'id,name,email,phone,type', text: (r) => [r.name, r.email], title: (r) => r.name || 'Empresa', sub: (r) => r.email || '' },
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
  // rotas que a pessoa realmente tem acesso (derivadas das seções filtradas por RBAC)
  const allowedRoutes = useMemo(() => new Set(navCmds.map((c) => c.route)), [navCmds])

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
        // só busca dados de fontes cuja tela de destino a pessoa pode acessar
        const sources = DATA_SOURCES.filter((src) => allowedRoutes.has(src.route))
        const per = await Promise.all(sources.map(async (src) => {
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
              _source: src.key,
            }))
          } catch { return [] }
        }))
        if (alive) setDataResults(per.flat())
      } catch { if (alive) setDataResults([]) } finally { if (alive) setLoading(false) }
    }, 250)
    return () => { alive = false; clearTimeout(h) }
  }, [q, open, allowedRoutes])

  // ordem original dos grupos do menu (Núcleo, Frentes, Rede Seravie, Sistema…),
  // exatamente como o dashboard montou as seções filtradas por RBAC.
  const menuGroupOrder = useMemo(() => {
    const seen = []
    for (const c of navCmds) if (c.group && !seen.includes(c.group)) seen.push(c.group)
    return seen
  }, [navCmds])

  // monta a lista final agrupada e ranqueada
  const groups = useMemo(() => {
    const term = q.trim()
    // só oferece ações cujas telas de destino a pessoa pode acessar
    const acts = QUICK_ACTIONS.filter((a) => allowedRoutes.has(a.route)).map((a) => ({ ...a, kind: 'action', group: 'Ações' }))
    const actions = rankItems(acts, term)
    const nav = rankItems(navCmds, term)
    const help = term ? rankItems(HELP_ITEMS, term) : HELP_ITEMS
    const data = rankItems(dataResults, term).map((d) => ({ ...d, group: d.group || 'Resultados' }))

    const byGroup = {}
    const push = (arr) => arr.forEach((it) => { const g = it.group || 'Navegação'; (byGroup[g] ||= []).push(it) })

    // Ações e Resultados no topo; a navegação mantém os grupos REAIS do menu.
    push(actions)
    if (term) push(data)
    // Em repouso mostra itens de topo (menu escaneável); ao digitar busca em TUDO
    // (inclui todas as subpáginas de todas as frentes e do super admin).
    push(term ? nav : nav.filter((n) => !n.sublabel))
    push(help)

    // Ordena: Ações → Resultados → grupos do menu (ordem original) → Ajuda → resto.
    const rank = (g) => {
      if (g === 'Ações') return 0
      if (g === 'Resultados' || DATA_GROUPS.has(g)) return 1
      const i = menuGroupOrder.indexOf(g)
      if (i >= 0) return 10 + i
      if (g === 'Ajuda') return 900
      return 500
    }
    const ordered = Object.keys(byGroup).sort((a, b) => rank(a) - rank(b))
    // limite generoso por grupo (evita listas absurdas, mas mostra o menu inteiro)
    return ordered
      .map((g) => ({ group: g, items: byGroup[g].slice(0, 40) }))
      .filter((g) => g.items.length)
  }, [q, navCmds, dataResults, menuGroupOrder, allowedRoutes])

  // lista plana (para navegação por teclado)
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])
  useEffect(() => { setSel(0) }, [q, dataResults])

  const run = useCallback((item) => {
    if (!item) return
    if (item.kind === 'help') { notify?.('Use ↑ ↓ para navegar e Enter para abrir.', 'info'); return }
    // Deep-link: registra o alvo ANTES de navegar, para a tela de destino abrir o registro.
    if (item.kind === 'data' && item._raw && item._source) {
      setFocus(item._source, item._raw.id, item._raw)
    }
    if (item.route && onNavigate) onNavigate(item.route)
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
      <div className="w-full max-w-xl glass-pop rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[75vh]" onClick={(e) => e.stopPropagation()}>
        {/* campo de busca */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07] shrink-0">
          <span className="w-4 h-4 shrink-0 flex items-center justify-center text-admin-champ/60"><Icon name="search" className="w-4 h-4" /></span>
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
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto py-2">
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
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] text-[10px] text-admin-muted/40 shrink-0">
          <span>{flat.length} resultado{flat.length === 1 ? '' : 's'}</span>
          <span className="flex items-center gap-2"><kbd className="border border-white/10 rounded px-1">↑↓</kbd> navegar <kbd className="border border-white/10 rounded px-1">↵</kbd> abrir</span>
        </div>
      </div>
    </div>
  )
}
