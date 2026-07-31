import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'

const VERTICALS = [
  { key: 'franchise', label: 'Franchise Experience', icon: 'leaf', desc: 'Rede, unidades, auditorias, VM, comunicados' },
  { key: 'chocolate', label: 'Chocolate Experience', icon: 'star', desc: 'Linhas, kits, sazonalidades, vitrines' },
  { key: 'gift', label: 'Gift Experience', icon: 'gift', desc: 'Catálogo por ocasião, personalização, corporativo' },
  { key: 'coffee', label: 'Coffee Experience', icon: 'spark', desc: 'Cardápio, métodos, assinaturas, baristas' },
  { key: 'wine', label: 'Wine Experience', icon: 'spark', desc: 'Rótulos, safras, clube, degustações' },
  { key: 'gourmet', label: 'Gourmet Retail', icon: 'image', desc: 'Empórios, cestas, harmonizações, curadoria' },
  { key: 'brewery', label: 'Brewery Experience', icon: 'spark', desc: 'Rótulos, tap list, growlers, clube' },
  { key: 'bakery', label: 'Bakery Experience', icon: 'spark', desc: 'Cardápio, encomendas, produção sob demanda' },
  { key: 'floriculture', label: 'Floriculture Experience', icon: 'leaf', desc: 'Arranjos, assinaturas florais, casamentos' },
  { key: 'tourism', label: 'Tourism Experience', icon: 'image', desc: 'Passeios, guias, roteiros, transfers' },
  { key: 'beauty', label: 'Beauty Experience', icon: 'star', desc: 'Produtos, rotinas, consultorias, assinaturas' },
  { key: 'spa', label: 'Spa Experience', icon: 'spark', desc: 'Protocolos, agenda, terapeutas, gift cards' },
  { key: 'architecture', label: 'Architecture Experience', icon: 'layout', desc: 'Projetos, moodboards, cronograma, fornecedores' },
  { key: 'events', label: 'Events Experience', icon: 'star', desc: 'Casamentos, buffets, convidados, checklist' },
]

export function VerticalsPanel({ notify }) {
  const { profile } = useTenant()
  const [active, setActive] = useState([])
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('lines')
  const [lines, setLines] = useState([])
  const [kits, setKits] = useState([])
  const [giftItems, setGiftItems] = useState([])
  const [coffeeMenu, setCoffeeMenu] = useState([])
  const [wineLabels, setWineLabels] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => {
    supabase.from('vertical_configs').select('vertical').then(({ data }) => setActive((data || []).map(d => d.vertical)))
  }, [])

  const toggle = async (key) => {
    if (active.includes(key)) {
      await supabase.from('vertical_configs').delete().eq('tenant_id', profile?.tenant_id).eq('vertical', key)
      setActive(a => a.filter(v => v !== key))
      notify(`${key} desativado`, 'success')
    } else {
      await supabase.from('vertical_configs').insert({ tenant_id: profile?.tenant_id, vertical: key, config: { enabled: true } })
      setActive(a => [...a, key])
      notify(`${key} ativado`, 'success')
    }
  }

  const openVertical = async (v) => {
    setSelected(v); setLoading(true)
    if (v.key === 'chocolate') {
      const { data } = await supabase.from('chocolate_lines').select('*').order('sort_order')
      setLines(data || [])
      const { data: k } = await supabase.from('chocolate_kits').select('*').order('created_at', { ascending: false })
      setKits(k || [])
    } else if (v.key === 'gift') {
      const { data } = await supabase.from('gift_items').select('*').order('name')
      setGiftItems(data || [])
    } else if (v.key === 'coffee') {
      const { data } = await supabase.from('coffee_menu').select('*').order('name')
      setCoffeeMenu(data || [])
    } else if (v.key === 'wine') {
      const { data } = await supabase.from('wine_labels').select('*').order('name')
      setWineLabels(data || [])
    } else if (v.key === 'events') {
      const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false })
      setEvents(data || [])
    }
    setLoading(false)
  }

  const saveChocolateLine = async () => {
    if (!form.name?.trim()) { notify('Nome obrigatório', 'error'); return }
    await supabase.from('chocolate_lines').insert({ name: form.name, description: form.description, season: form.season, tenant_id: profile?.tenant_id })
    notify('Linha criada', 'success'); setShowForm(false); setForm({})
    const { data } = await supabase.from('chocolate_lines').select('*').order('sort_order')
    setLines(data || [])
  }

  const saveEvent = async () => {
    if (!form.title?.trim()) { notify('Título obrigatório', 'error'); return }
    await supabase.from('events').insert({ ...form, tenant_id: profile?.tenant_id })
    notify('Evento criado', 'success'); setShowForm(false); setForm({})
    const { data } = await supabase.from('events').select('*').order('created_at', { ascending: false })
    setEvents(data || [])
  }

  const SEASON_LABELS = { easter:'Páscoa', christmas:'Natal', mothers_day:'Dia das Mães', valentines:'Namorados', year_round:'Ano todo' }
  const EVENT_STATUS = { briefing:'Briefing', proposal:'Proposta', confirmed:'Confirmado', in_progress:'Em andamento', completed:'Concluído', cancelled:'Cancelado' }
  const STATUS_COLORS = { briefing:'text-admin-muted/50', proposal:'text-admin-gold', confirmed:'text-admin-champ', in_progress:'text-admin-sage', completed:'text-admin-muted/30', cancelled:'text-admin-rose' }

  if (selected) return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setSelected(null)} className="text-admin-muted hover:text-admin-champ transition-colors"><Icon name="x" className="w-4 h-4" /></button>
        <h1 className="font-serif text-3xl text-admin-text">{selected.label}</h1>
        <span className={`text-[10px] px-2 py-0.5 rounded-lg ${active.includes(selected.key) ? 'bg-admin-sage/10 text-admin-sage' : 'bg-white/[0.04] text-admin-muted/40'}`}>{active.includes(selected.key) ? 'ativo' : 'inativo'}</span>
      </div>
      <p className="text-admin-muted/50 text-sm mb-6">{selected.desc}</p>

      {selected.key === 'chocolate' && (
        <div>
          <div className="flex gap-1 mb-5 bg-white/[0.03] p-1 rounded-xl w-fit">
            {[['lines','Linhas'],['kits','Kits']].map(([k,v]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab===k?'bg-admin-champ/15 text-admin-champ':'text-admin-muted hover:text-admin-text'}`}>{v}</button>)}
          </div>
          <div className="flex justify-end mb-4"><button onClick={() => { setShowForm(true); setTab('lines') }} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Nova linha</button></div>
          {tab === 'lines' && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{loading ? <p className="text-admin-muted/30 text-sm py-8 text-center col-span-3">Carregando…</p> : lines.length === 0 ? <div className="glass rounded-2xl p-10 text-center col-span-3"><p className="text-admin-muted/40 text-sm">Nenhuma linha criada</p></div> : lines.map(l => <div key={l.id} className="glass rounded-xl p-4"><p className="text-admin-text text-sm font-medium mb-1">{l.name}</p><p className="text-admin-champ/60 text-xs">{SEASON_LABELS[l.season] || 'Ano todo'}</p>{l.description && <p className="text-admin-muted/40 text-xs mt-1">{l.description}</p>}</div>)}</div>}
          {tab === 'kits' && <div className="space-y-2">{loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : kits.length === 0 ? <div className="glass rounded-2xl p-10 text-center"><p className="text-admin-muted/40 text-sm">Nenhum kit</p></div> : kits.map(k => <div key={k.id} className="glass rounded-xl px-4 py-3 flex items-center gap-4"><div className="flex-1"><p className="text-admin-text text-sm">{k.name}</p><div className="flex gap-3 mt-0.5">{k.occasion && <span className="text-admin-muted/40 text-xs">{k.occasion}</span>}{k.is_corporate && <span className="text-admin-gold text-xs">Corporativo</span>}</div></div><p className="text-admin-gold text-sm">R$ {parseFloat(k.price).toFixed(2)}</p></div>)}</div>}
        </div>
      )}

      {selected.key === 'events' && (
        <div>
          <div className="flex justify-end mb-4"><button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Novo evento</button></div>
          <div className="space-y-2">{loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : events.length === 0 ? <div className="glass rounded-2xl p-10 text-center"><p className="text-admin-muted/40 text-sm">Nenhum evento</p></div> : events.map(e => <div key={e.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4"><div className="flex-1 min-w-0"><p className="text-admin-text text-sm font-medium truncate">{e.title}</p><div className="flex gap-3 mt-0.5"><span className="text-admin-muted/40 text-xs">{e.type}</span>{e.event_date && <span className="text-admin-muted/40 text-xs">{new Date(e.event_date).toLocaleDateString('pt-BR')}</span>}{e.guest_count && <span className="text-admin-muted/40 text-xs">{e.guest_count} convidados</span>}</div></div><span className={`text-[10px] font-medium shrink-0 ${STATUS_COLORS[e.status]}`}>{EVENT_STATUS[e.status]}</span></div>)}</div>
        </div>
      )}

      {!['chocolate','events'].includes(selected.key) && (
        <div className="glass rounded-2xl p-10 text-center">
          <Icon name="spark" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" />
          <p className="text-admin-muted/50 text-sm mb-1">Módulo {selected.label}</p>
          <p className="text-admin-muted/30 text-xs">Configure e gerencie {selected.desc.toLowerCase()}</p>
        </div>
      )}

      {showForm && selected.key === 'chocolate' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Nova linha</h2><button onClick={() => setShowForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome *</label><input value={form.name||''} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Sazonalidade</label><GlassSelect value={form.season||''} onChange={v => setForm(f => ({...f, season: v}))} placeholder="Ano todo" options={[{value:'',label:'Ano todo'}, ...Object.entries(SEASON_LABELS).map(([value,label]) => ({value,label}))]} /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Descrição</label><textarea value={form.description||''} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={saveChocolateLine} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar</button><button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}

      {showForm && selected.key === 'events' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Novo evento</h2><button onClick={() => setShowForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label><input value={form.title||''} onChange={e => setForm(f => ({...f, title: e.target.value}))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Tipo</label><GlassSelect value={form.type||'wedding'} onChange={v => setForm(f => ({...f, type: v}))} options={['wedding','corporate','birthday','graduation','other']} /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Data</label><GlassDate value={form.event_date||''} onChange={v => setForm(f => ({...f, event_date: v}))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Convidados</label><input type="number" value={form.guest_count||''} onChange={e => setForm(f => ({...f, guest_count: e.target.value}))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Orçamento (R$)</label><input type="number" value={form.budget||''} onChange={e => setForm(f => ({...f, budget: e.target.value}))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              </div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Local</label><input value={form.venue||''} onChange={e => setForm(f => ({...f, venue: e.target.value}))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={saveEvent} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar evento</button><button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div className="mb-8"><h1 className="font-serif text-4xl text-admin-text">Núcleos Verticais</h1><p className="text-admin-muted/60 text-sm mt-1">{active.length} de {VERTICALS.length} ativados</p></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {VERTICALS.map(v => (
          <div key={v.key} className={`glass rounded-xl p-4 border transition-colors ${active.includes(v.key) ? 'border-admin-champ/20' : 'border-transparent'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2"><Icon name={v.icon} className="w-4 h-4 text-admin-champ/60" /><p className="text-admin-text text-sm font-medium">{v.label}</p></div>
              <button onClick={() => toggle(v.key)} className={`text-[9px] px-2.5 py-1 rounded-lg transition-colors shrink-0 ${active.includes(v.key) ? 'bg-admin-sage/10 text-admin-sage hover:bg-admin-rose/10 hover:text-admin-rose' : 'bg-white/[0.04] text-admin-muted/40 hover:bg-admin-champ/10 hover:text-admin-champ'}`}>
                {active.includes(v.key) ? 'ativo' : 'ativar'}
              </button>
            </div>
            <p className="text-admin-muted/40 text-xs mb-3">{v.desc}</p>
            {active.includes(v.key) && <button onClick={() => openVertical(v)} className="text-[10px] text-admin-champ hover:underline">Gerenciar →</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
