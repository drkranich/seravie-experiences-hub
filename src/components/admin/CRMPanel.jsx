import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'

const TYPE_LABELS = { person: 'Pessoa', company: 'Empresa', family: 'Família', partner: 'Parceiro', supplier: 'Fornecedor' }
const STATUS_COLORS = { active: 'text-admin-sage', inactive: 'text-admin-muted', blocked: 'text-admin-rose' }

export function CRMPanel({ notify }) {
  const { profile } = useTenant()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', type: 'person', notes: '' })

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
    const payload = { ...form, tenant_id: profile?.tenant_id }
    const { error } = selected
      ? await supabase.from('contacts').update(payload).eq('id', selected.id)
      : await supabase.from('contacts').insert(payload)
    if (error) { notify('Erro ao salvar', 'error'); return }
    notify(selected ? 'Contato atualizado' : 'Contato criado', 'success')
    setShowForm(false); setSelected(null); setForm({ name: '', email: '', phone: '', type: 'person', notes: '' })
    load()
  }

  const remove = async (id) => {
    if (!confirm('Remover contato?')) return
    await supabase.from('contacts').delete().eq('id', id)
    notify('Removido', 'success'); load()
  }

  const openEdit = (c) => {
    setSelected(c); setForm({ name: c.name, email: c.email || '', phone: c.phone || '', type: c.type, notes: c.notes || '' }); setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">Experience CRM</h1>
          <p className="text-admin-muted/60 text-sm mt-1">{contacts.length} contatos · Customer 360</p>
        </div>
        <button onClick={() => { setSelected(null); setForm({ name: '', email: '', phone: '', type: 'person', notes: '' }); setShowForm(true) }}
          className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors">
          <Icon name="spark" className="w-4 h-4" /> Novo contato
        </button>
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
          <button onClick={() => setShowForm(true)} className="mt-4 text-admin-champ text-sm hover:underline">Criar primeiro contato</button>
        </div>
      ) : (
        <div className="grid gap-2">
          {contacts.map(c => (
            <div key={c.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.03] transition-colors group">
              <div className="w-8 h-8 rounded-full bg-admin-champ/15 flex items-center justify-center shrink-0">
                <span className="text-admin-champ font-serif text-sm">{c.name[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-admin-text text-sm font-medium truncate">{c.name}</p>
                <p className="text-admin-muted/50 text-xs truncate">{c.email || c.phone || '—'}</p>
              </div>
              <span className="text-[10px] text-admin-muted/40 hidden sm:block">{TYPE_LABELS[c.type]}</span>
              <span className={`text-[10px] hidden sm:block ${STATUS_COLORS[c.status]}`}>{c.status}</span>
              {c.ltv > 0 && <span className="text-[10px] text-admin-gold hidden md:block">R$ {c.ltv.toFixed(0)}</span>}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(c)} className="p-1.5 hover:text-admin-champ text-admin-muted transition-colors rounded-lg hover:bg-white/[0.05]">
                  <Icon name="edit" className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(c.id)} className="p-1.5 hover:text-admin-rose text-admin-muted transition-colors rounded-lg hover:bg-white/[0.05]">
                  <Icon name="x" className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-admin-text">{selected ? 'Editar contato' : 'Novo contato'}</h2>
              <button onClick={() => setShowForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
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
    </div>
  )
}
