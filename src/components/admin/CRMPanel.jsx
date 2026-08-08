import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, AvatarUpload, AddressAutocomplete, addressFromContact } from './ui'
import { exportCsv, exportPdf } from '../../lib/export'
import { logAudit } from '../../lib/audit'
import { CRMDashboard } from './crm/CRMDashboard'
import { Customer360 } from './crm/Customer360'
import { Companies } from './crm/Companies'
import { CRMAnalytics } from './crm/CRMAnalytics'
import { CRMSegments } from './crm/CRMSegments'
import { Omnichannel } from './crm/Omnichannel'
import { Projects } from './crm/Projects'
import { CustomerMap, Subscriptions } from './crm/MapAndSubs'

const TYPE_LABELS = { person: 'Pessoa', company: 'Empresa', family: 'Família', partner: 'Parceiro', supplier: 'Fornecedor' }
const STATUS_COLORS = { active: 'text-admin-sage', inactive: 'text-admin-muted', blocked: 'text-admin-rose' }

export function CRMPanel({ notify }) {
  const { profile, canEdit, canManage } = useTenant()
  const mayEdit = canEdit ? canEdit('crm') : true
  const mayDelete = canManage ? canManage('crm') : true
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', type: 'person', notes: '', avatar_url: '' })
  const [addr, setAddr] = useState(addressFromContact(null))
  const [detail, setDetail] = useState(null)
  const [dOrders, setDOrders] = useState([])
  const [dLoading, setDLoading] = useState(false)
  const [view, setView] = useState('dashboard')   // dashboard | contacts
  const [c360, setC360] = useState(null)           // entidade aberta na visão 360°

  const load = async () => {
    setLoading(true)
    let q = supabase.from('contacts').select('*').order('created_at', { ascending: false }).limit(100)
    if (search) q = q.ilike('name', `%${search}%`)
    if (filterType) q = q.eq('type', filterType)
    const { data } = await q
    setContacts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [search, filterType])

  const save = async () => {
    if (!form.name.trim()) { notify('Nome obrigatório', 'error'); return }
    const payload = { ...form, ...addr, tenant_id: profile?.tenant_id }
    const { error } = selected
      ? await supabase.from('contacts').update(payload).eq('id', selected.id)
      : await supabase.from('contacts').insert(payload)
    if (error) { notify('Erro ao salvar', 'error'); return }
    notify(selected ? 'Contato atualizado' : 'Contato criado', 'success')
    setShowForm(false); setSelected(null); setForm({ name: '', email: '', phone: '', type: 'person', notes: '', avatar_url: '' }); setAddr(addressFromContact(null))
    load()
  }

  const remove = async (id) => {
    if (!confirm('Remover contato?')) return
    await supabase.from('contacts').delete().eq('id', id)
    notify('Removido', 'success'); load()
  }

  const openEdit = (c) => {
    setSelected(c); setForm({ name: c.name, email: c.email || '', phone: c.phone || '', type: c.type, notes: c.notes || '', avatar_url: c.avatar_url || '' }); setAddr(addressFromContact(c)); setShowForm(true)
  }

  const openDetail = async (c) => {
    setDetail(c); setDLoading(true); setDOrders([])
    const { data } = await supabase.from('orders').select('number, total, created_at, items, payment_status, payment_method').eq('contact_id', c.id).order('created_at', { ascending: false }).limit(100)
    setDOrders(data || []); setDLoading(false)
  }
  const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // LGPD — exportar e anonimizar dados do titular.
  const exportSubject = (c) => {
    const payload = { titular: c, pedidos: dOrders, exportado_em: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `dados-titular-${String(c.name || 'titular').replace(/\s+/g, '_')}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    logAudit({ action: 'export', resource_type: 'contacts', resource_id: c.id, new_data: { lgpd_export: true } }, profile?.tenant_id)
    notify('Dados do titular exportados', 'success')
  }
  const anonymize = async (c) => {
    if (!confirm('Anonimizar os dados pessoais deste titular (LGPD)? Nome, e-mail, telefone, documento e notas serão apagados. Esta ação é irreversível.')) return
    const { error } = await supabase.from('contacts').update({ name: 'Titular anonimizado', email: null, phone: null, document: null, notes: null }).eq('id', c.id)
    if (error) return notify('Erro ao anonimizar: ' + error.message, 'error')
    logAudit({ action: 'update', resource_type: 'contacts', resource_id: c.id, old_data: { name: c.name }, new_data: { anonymized: true } }, profile?.tenant_id)
    notify('Titular anonimizado', 'success'); setDetail(null); load()
  }

  // Visão 360° em tela cheia
  if (c360) return (
    <div>
      <Customer360 contact={c360} notify={notify} onBack={() => { setC360(null); load() }} />
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">Relationship Studio</h1>
          <p className="text-admin-muted/60 text-sm mt-1">Experience CRM · visão 360° do relacionamento</p>
        </div>
        <div className="hidden" />
      </div>

      {/* Navegação */}
      <div className="flex gap-1.5 mb-6 flex-wrap">
        {[['dashboard', 'Dashboard', 'grid'], ['contacts', 'Contatos', 'user'], ['companies', 'Empresas', 'building'], ['omni', 'Conversas', 'mail'], ['projects', 'Projetos', 'layers'], ['subs', 'Assinaturas', 'star'], ['segments', 'Segmentação', 'search'], ['map', 'Mapa', 'building'], ['analytics', 'Analytics', 'chart']].map(([k, v, ic]) => (
          <button key={k} onClick={() => setView(k)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors ${view === k ? 'bg-admin-champ/15 text-admin-champ border border-admin-champ/20' : 'text-admin-muted hover:text-admin-text border border-transparent'}`}>
            <Icon name={ic} className="w-4 h-4" />{v}
          </button>
        ))}
      </div>

      {view === 'dashboard' && <CRMDashboard notify={notify} onOpenContact={(c) => setC360(c)} />}
      {view === 'companies' && <Companies notify={notify} onOpenContact={(c) => setC360(c)} />}
      {view === 'omni' && <Omnichannel notify={notify} />}
      {view === 'projects' && <Projects notify={notify} onOpenContact={(c) => setC360(c)} />}
      {view === 'subs' && <Subscriptions notify={notify} onOpenContact={(c) => setC360(c)} />}
      {view === 'segments' && <CRMSegments notify={notify} onOpenContact={(c) => setC360(c)} />}
      {view === 'map' && <CustomerMap notify={notify} />}
      {view === 'analytics' && <CRMAnalytics notify={notify} />}

      {view === 'contacts' && (
      <>
      <div className="flex items-center justify-end mb-6">
        <div className="flex gap-2">
          <button onClick={() => exportCsv('contatos.csv', contacts.map((c) => ({ nome: c.name, email: c.email, telefone: c.phone, tipo: TYPE_LABELS[c.type] || c.type, status: c.status, ltv: c.ltv }))) || notify('Nada para exportar', 'error')}
            className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors">
            <Icon name="upload" className="w-4 h-4" /> CSV
          </button>
          <button onClick={() => exportPdf('Contatos', contacts.map((c) => ({ nome: c.name, email: c.email, telefone: c.phone, tipo: TYPE_LABELS[c.type] || c.type, status: c.status, ltv: c.ltv })), 'Experience CRM') || notify('Nada para exportar', 'error')}
            className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors">
            <Icon name="upload" className="w-4 h-4" /> PDF
          </button>
          {mayEdit && <button onClick={() => { setSelected(null); setForm({ name: '', email: '', phone: '', type: 'person', notes: '', avatar_url: '' }); setAddr(addressFromContact(null)); setShowForm(true) }}
            className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors">
            <Icon name="spark" className="w-4 h-4" /> Novo contato
          </button>}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contatos…"
            className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" />
        </div>
        <GlassSelect value={filterType} onChange={v => setFilterType(v)} className="min-w-44"
          options={[{value:'',label:'Todos os tipos'}, ...Object.entries(TYPE_LABELS).map(([value, label]) => ({value,label}))]} />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-admin-muted/40 text-sm py-12 text-center">Carregando…</div>
      ) : contacts.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Icon name="user" className="w-10 h-10 text-admin-champ/30 mx-auto mb-3" />
          <p className="text-admin-muted/50 text-sm">Nenhum contato encontrado</p>
          {mayEdit && <button onClick={() => setShowForm(true)} className="mt-4 text-admin-champ text-sm hover:underline">Criar primeiro contato</button>}
        </div>
      ) : (
        <div className="grid gap-2">
          {contacts.map(c => (
            <div key={c.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.03] transition-colors group">
              <div className="w-8 h-8 rounded-full bg-admin-champ/15 flex items-center justify-center shrink-0">
                <span className="text-admin-champ font-serif text-sm">{c.name[0].toUpperCase()}</span>
              </div>
              <button onClick={() => setC360(c)} className="flex-1 min-w-0 text-left">
                <p className="text-admin-text text-sm font-medium truncate hover:text-admin-champ transition-colors">{c.name}</p>
                <p className="text-admin-muted/50 text-xs truncate">{c.email || c.phone || '—'}</p>
              </button>
              <span className="text-[10px] text-admin-muted/40 hidden sm:block">{TYPE_LABELS[c.type]}</span>
              <span className={`text-[10px] hidden sm:block ${STATUS_COLORS[c.status]}`}>{c.status}</span>
              {c.ltv > 0 && <span className="text-[10px] text-admin-gold hidden md:block">R$ {c.ltv.toFixed(0)}</span>}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {mayEdit && <button onClick={() => openEdit(c)} className="p-1.5 hover:text-admin-champ text-admin-muted transition-colors rounded-lg hover:bg-white/[0.05]">
                  <Icon name="edit" className="w-3.5 h-3.5" />
                </button>}
                {mayDelete && <button onClick={() => remove(c.id)} className="p-1.5 hover:text-admin-rose text-admin-muted transition-colors rounded-lg hover:bg-white/[0.05]">
                  <Icon name="x" className="w-3.5 h-3.5" />
                </button>}
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-admin-text">{selected ? 'Editar contato' : 'Novo contato'}</h2>
              <button onClick={() => setShowForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <AvatarUpload value={form.avatar_url} onChange={(v) => setForm((f) => ({ ...f, avatar_url: v }))} notify={notify} fallbackIcon={form.type === 'company' ? 'building' : 'user'} />
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Nome completo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">E-mail</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="email@…" />
                </div>
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Telefone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="(11) 9…" />
                </div>
              </div>
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Tipo</label>
                <GlassSelect value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))}
                  options={Object.entries(TYPE_LABELS).map(([value, label]) => ({value,label}))} />
              </div>
              <div className="pt-2 border-t border-white/[0.05]"><p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Endereço</p><AddressAutocomplete value={addr} onChange={setAddr} notify={notify} /></div>
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" placeholder="Observações…" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">
                {selected ? 'Salvar alterações' : 'Criar contato'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer 360 */}
      {detail && (() => {
        const paid = dOrders.filter((o) => o.payment_status === 'paid')
        const totalSpent = paid.reduce((s, o) => s + Number(o.total || 0), 0)
        const nOrders = paid.length
        const ticket = nOrders ? totalSpent / nOrders : 0
        const last = paid[0]?.created_at
        const first = paid[paid.length - 1]?.created_at
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="glass-pop rounded-2xl p-7 w-full max-w-lg overflow-visible">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-admin-champ/15 flex items-center justify-center shrink-0"><span className="text-admin-champ font-serif text-lg">{detail.name[0].toUpperCase()}</span></div>
                  <div>
                    <h2 className="font-serif text-2xl text-admin-text leading-tight">{detail.name}</h2>
                    <div className="flex gap-2 mt-0.5"><span className="text-admin-muted/50 text-xs">{TYPE_LABELS[detail.type]}</span><span className={`text-xs ${STATUS_COLORS[detail.status]}`}>{detail.status}</span></div>
                  </div>
                </div>
                <button onClick={() => setDetail(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
              </div>

              {(detail.email || detail.phone) && <p className="text-admin-muted/60 text-sm mb-4">{[detail.email, detail.phone].filter(Boolean).join(' · ')}</p>}

              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="glass-soft rounded-xl p-3"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Total gasto</p><p className="text-admin-sage text-lg font-medium">{brl(totalSpent)}</p></div>
                <div className="glass-soft rounded-xl p-3"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Pedidos</p><p className="text-admin-text text-lg font-medium">{nOrders}</p></div>
                <div className="glass-soft rounded-xl p-3"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">Ticket médio</p><p className="text-admin-text text-lg font-medium">{brl(ticket)}</p></div>
              </div>
              {(first || last) && <p className="text-admin-muted/40 text-xs mb-4">{first && `Primeira compra: ${new Date(first).toLocaleDateString('pt-BR')}`}{first && last && ' · '}{last && `Última: ${new Date(last).toLocaleDateString('pt-BR')}`}</p>}

              <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Histórico de compras</p>
              <div className="space-y-1.5 max-h-52 overflow-y-auto mb-4">
                {dLoading ? <p className="text-admin-muted/40 text-xs py-4 text-center">Carregando…</p> : dOrders.length === 0 ? <p className="text-admin-muted/40 text-xs py-4 text-center">Nenhuma compra registrada</p> : dOrders.map((o, i) => (
                  <div key={i} className="glass-soft rounded-lg px-3 py-2 flex items-center gap-3">
                    <span className="text-admin-muted/50 text-xs">#{o.number}</span>
                    <span className="text-admin-muted/40 text-xs flex-1">{new Date(o.created_at).toLocaleDateString('pt-BR')} · {(o.items || []).length} itens</span>
                    <span className={`text-xs ${o.payment_status === 'paid' ? 'text-admin-sage' : 'text-admin-muted/40'}`}>{brl(o.total)}</span>
                  </div>
                ))}
              </div>

              {detail.notes && <div className="mb-4"><p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-1">Notas</p><p className="text-admin-muted/70 text-sm">{detail.notes}</p></div>}

              <div className="flex gap-2 flex-wrap items-center">
                {mayEdit && <button onClick={() => { openEdit(detail); setDetail(null) }} className="flex-1 min-w-[120px] bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Editar contato</button>}
                <button onClick={() => exportSubject(detail)} className="px-3 py-2.5 rounded-xl text-xs text-admin-muted hover:text-admin-champ border border-white/[0.06] transition-colors" title="Exportar dados do titular (LGPD)">Exportar (LGPD)</button>
                {mayDelete && <button onClick={() => anonymize(detail)} className="px-3 py-2.5 rounded-xl text-xs text-admin-rose hover:bg-admin-rose/10 transition-colors" title="Anonimizar dados (LGPD)">Anonimizar</button>}
                <button onClick={() => setDetail(null)} className="px-4 py-2.5 rounded-xl text-sm text-admin-muted">Fechar</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
