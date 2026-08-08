import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { SUPPLIER_CATEGORIES, CATEGORY_ICON, MOODBOARD_THEMES } from '../../../lib/suppliersMarket'

// Moodboards — curadoria por tema que conecta fornecedores reais.
// Grid de boards; abrir mostra a paleta + fornecedores vinculados; criar/editar.

function PaletteDots({ palette = [] }) {
  return <div className="flex gap-1">{palette.slice(0, 5).map((c, i) => <span key={i} className="w-4 h-4 rounded-full ring-1 ring-white/10" style={{ background: c }} />)}</div>
}

export function Moodboards({ suppliers, onOpenSupplier, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [boards, setBoards] = useState([])
  const [items, setItems] = useState({})       // boardId -> [items]
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)         // board aberto
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: bs } = await supabase.from('moodboards').select('*').order('created_at', { ascending: false })
      const { data: its } = await supabase.from('moodboard_items').select('*')
      const grouped = {}
      ;(its || []).forEach((it) => { (grouped[it.moodboard_id] ||= []).push(it) })
      setBoards(bs || []); setItems(grouped)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const createBoard = async (payload) => {
    const { data, error } = await supabase.from('moodboards').insert({ ...payload, tenant_id: tenantId }).select('*').single()
    if (error) return notify?.('Erro ao criar moodboard: ' + error.message, 'error')
    setBoards((b) => [data, ...b]); setCreating(false); notify?.('Moodboard criado', 'success')
  }

  const supplierById = useCallback((id) => suppliers.find((s) => s.id === id), [suppliers])

  const removeBoard = async (b, e) => {
    e.stopPropagation()
    if (!confirm(`Excluir o moodboard “${b.title}”?`)) return
    const { error } = await supabase.from('moodboards').delete().eq('id', b.id)
    if (error) return notify?.('Erro ao excluir: ' + error.message, 'error')
    setBoards((prev) => prev.filter((x) => x.id !== b.id)); notify?.('Moodboard excluído', 'info')
  }

  if (open) return <BoardDetail board={open} items={items[open.id] || []} suppliers={suppliers} supplierById={supplierById} onBack={() => { setOpen(null); load() }} onOpenSupplier={onOpenSupplier} tenantId={tenantId} notify={notify} reload={load} />

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl text-admin-text">Moodboards</h1>
          <p className="text-admin-muted/50 text-sm mt-1">Curadorias por tema que conectam fornecedores reais ao seu projeto.</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Novo moodboard</button>
      </div>

      {/* Meus moodboards (criados pelo usuário) — podem ser excluídos */}
      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-2xl h-52 animate-pulse opacity-40" />)}</div>
        : boards.length > 0 && (
          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-wider text-admin-champ/60 mb-3">Meus moodboards</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {boards.map((b) => {
                const its = items[b.id] || []
                const thumbs = its.map((it) => it.image_url || supplierById(it.supplier_id)?.cover_url).filter(Boolean).slice(0, 4)
                return (
                  <div key={b.id} className="group relative glass rounded-2xl overflow-hidden hover:ring-1 hover:ring-admin-champ/30 transition-all">
                    <button onClick={(e) => removeBoard(b, e)} className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/50 backdrop-blur-md text-white/70 hover:text-admin-rose flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Excluir moodboard"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setOpen(b)} className="w-full text-left">
                      <div className="grid grid-cols-2 gap-0.5 h-40 bg-white/[0.03]">
                        {thumbs.length ? thumbs.map((url, i) => <div key={i} className="overflow-hidden"><img src={url} alt="" className="w-full h-full object-cover" /></div>)
                          : <div className="col-span-2 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${(Array.isArray(b.palette) && b.palette[0]) || '#2a2a2a'}22, transparent)` }}><Icon name="palette" className="w-10 h-10 text-admin-champ/20" /></div>}
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-2"><p className="text-admin-text font-medium truncate">{b.title}</p><PaletteDots palette={Array.isArray(b.palette) ? b.palette : []} /></div>
                        <p className="text-admin-muted/40 text-xs mt-1">{its.length} {its.length === 1 ? 'fornecedor' : 'fornecedores'}{b.theme ? ` · ${b.theme}` : ''}</p>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      {/* Temas Seravie — FIXOS, sempre visíveis, com cores. Clique cria uma curadoria. */}
      <div>
        <p className="text-[11px] uppercase tracking-wider text-admin-champ/60 mb-3">Temas Seravie · comece por um</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MOODBOARD_THEMES.map((t) => (
            <button key={t.theme} onClick={() => createBoard({ title: t.title, theme: t.theme, palette: t.palette, is_public: true })} className="group glass rounded-2xl overflow-hidden text-left hover:ring-1 hover:ring-admin-champ/30 transition-all">
              <div className="h-16 flex" >{t.palette.map((c, i) => <div key={i} className="flex-1" style={{ background: c }} />)}</div>
              <div className="p-4">
                <div className="flex items-center justify-between"><p className="text-admin-text text-sm font-medium">{t.title}</p><Icon name="plus" className="w-4 h-4 text-admin-champ/50 group-hover:text-admin-champ" /></div>
                <p className="text-admin-muted/40 text-xs mt-1">Criar curadoria</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {creating && <CreateModal onClose={() => setCreating(false)} onCreate={createBoard} />}
    </div>
  )
}

// paletas prontas para escolha rápida + edição de cor por swatch
const PALETTE_PRESETS = [
  ['#3c2a1e', '#c79a6a', '#efe7d8'],
  ['#1f3a3a', '#c9a86a', '#f2ede3'],
  ['#2e4b3c', '#e7b6c2', '#f4efe6'],
  ['#3a1622', '#7b2d3a', '#e6d2cf'],
  ['#2a2a2a', '#c9a86a', '#f0ece4'],
]

function CreateModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('')
  const [theme, setTheme] = useState('')
  const [palette, setPalette] = useState(PALETTE_PRESETS[0])
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const setColor = (i, v) => setPalette((p) => p.map((c, j) => (j === i ? v : c)))
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Novo moodboard</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ex.: Cafeteria Escandinava)" className={cls} />
          <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Tema (opcional)" className={cls} />
          <div>
            <label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-2">Paleta de cores</label>
            {/* prévia da paleta */}
            <div className="h-10 rounded-xl overflow-hidden flex ring-1 ring-white/10 mb-2">{palette.map((c, i) => <div key={i} className="flex-1" style={{ background: c }} />)}</div>
            {/* editar cada cor */}
            <div className="flex items-center gap-2 mb-3">
              {palette.map((c, i) => (
                <label key={i} className="relative w-8 h-8 rounded-lg overflow-hidden ring-1 ring-white/15 cursor-pointer" style={{ background: c }}>
                  <input type="color" value={c} onChange={(e) => setColor(i, e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                </label>
              ))}
              <span className="text-admin-muted/40 text-[10px]">toque para trocar</span>
            </div>
            {/* presets */}
            <div className="flex items-center gap-2">
              {PALETTE_PRESETS.map((pp, i) => (
                <button key={i} onClick={() => setPalette(pp)} className="h-6 w-12 rounded-md overflow-hidden flex ring-1 ring-white/10 hover:ring-admin-champ/40 transition-all" title="Usar paleta">{pp.map((c, j) => <span key={j} className="flex-1" style={{ background: c }} />)}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button>
          <button onClick={() => title.trim() && onCreate({ title, theme, is_public: true, palette })} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Criar</button>
        </div>
      </div>
    </div>
  )
}

function BoardDetail({ board, items, suppliers, supplierById, onBack, onOpenSupplier, tenantId, notify, reload }) {
  const [adding, setAdding] = useState(false)
  const [pick, setPick] = useState('')

  const addSupplier = async () => {
    if (!pick) return
    const { error } = await supabase.from('moodboard_items').insert({ moodboard_id: board.id, tenant_id: tenantId, supplier_id: pick, sort_order: items.length })
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setPick(''); setAdding(false); notify?.('Fornecedor adicionado ao moodboard', 'success'); reload()
  }
  const removeItem = async (id) => {
    await supabase.from('moodboard_items').delete().eq('id', id)
    reload()
  }

  const linked = items.map((it) => ({ it, sup: supplierById(it.supplier_id) })).filter((x) => x.sup)
  const available = suppliers.filter((s) => !items.some((it) => it.supplier_id === s.id))

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-admin-muted/60 hover:text-admin-text text-sm mb-4 transition-colors"><Icon name="down" className="w-4 h-4 rotate-90" /> Voltar aos moodboards</button>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">{board.title}</h1><p className="text-admin-muted/50 text-sm mt-1">{linked.length} fornecedores{board.theme ? ` · ${board.theme}` : ''}</p></div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Adicionar fornecedor</button>
      </div>

      {linked.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><Icon name="palette" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">Este moodboard ainda não tem fornecedores.</p><p className="text-admin-muted/35 text-xs mt-1">Adicione fornecedores reais para montar a curadoria.</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {linked.map(({ it, sup }) => (
            <div key={it.id} className="group glass rounded-2xl overflow-hidden relative">
              <button onClick={() => removeItem(it.id)} className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/40 backdrop-blur-md text-white/70 hover:text-admin-rose flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="x" className="w-3.5 h-3.5" /></button>
              <button onClick={() => onOpenSupplier(sup)} className="w-full text-left">
                <div className="h-36 bg-white/[0.03] overflow-hidden">{sup.cover_url ? <img src={sup.cover_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Icon name={CATEGORY_ICON[sup.category] || 'box'} className="w-8 h-8 text-admin-champ/20" /></div>}</div>
                <div className="p-4"><p className="text-admin-text text-sm font-medium truncate">{sup.name}</p><p className="text-admin-muted/45 text-xs">{SUPPLIER_CATEGORIES[sup.category] || sup.category}{sup.city ? ` · ${sup.city}` : ''}</p></div>
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setAdding(false)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Adicionar fornecedor</h2><button onClick={() => setAdding(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            {available.length === 0 ? <p className="text-admin-muted/50 text-sm">Todos os fornecedores já estão neste moodboard.</p> : (
              <>
                <GlassSelect value={pick} onChange={setPick} options={[{ value: '', label: 'Selecione um fornecedor' }, ...available.map((s) => ({ value: s.id, label: `${s.name} · ${SUPPLIER_CATEGORIES[s.category] || s.category}` }))]} />
                <div className="flex justify-end gap-2 mt-5"><button onClick={() => setAdding(false)} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={addSupplier} disabled={!pick} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50">Adicionar</button></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
