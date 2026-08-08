import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`

// Empresas / Pessoas / Organograma — pessoa jurídica com seus contatos e hierarquia.
export function Companies({ notify, onOpenContact }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)   // empresa aberta (organograma)
  const [modal, setModal] = useState(null)          // empresa em edição / {} nova

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('contacts').select('*').eq('type', 'company').order('name').limit(1000)
      setCompanies(data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const remove = async (c) => {
    if (!confirm(`Excluir a empresa "${c.name}"? As pessoas vinculadas ficam sem empresa.`)) return
    try {
      await supabase.from('contacts').update({ parent_company_id: null }).eq('parent_company_id', c.id)
      await supabase.from('contacts').delete().eq('id', c.id)
    } catch { /* noop */ }
    notify('Empresa removida', 'success'); setSelected(null); load()
  }

  if (selected) return <CompanyOrg company={selected} tenantId={tenantId} notify={notify} onBack={() => { setSelected(null); load() }} onOpenContact={onOpenContact} />

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-admin-muted/50 text-xs max-w-xl leading-relaxed">Empresas (pessoa jurídica) com seus contatos, cargos e organograma. Vincule pessoas a uma empresa para ver a hierarquia.</p>
        <button onClick={() => setModal({})} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Nova empresa</button>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p>
        : companies.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-admin-champ/10 flex items-center justify-center mx-auto mb-4"><Icon name="building" className="w-7 h-7 text-admin-champ/60" /></div>
            <h3 className="font-serif text-2xl text-admin-text mb-2">Nenhuma empresa ainda</h3>
            <p className="text-admin-muted/60 text-sm mb-5 max-w-md mx-auto">Cadastre uma empresa e vincule as pessoas de contato para montar o organograma.</p>
            <button onClick={() => setModal({})} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-5 py-2.5 rounded-xl text-sm transition-colors">Cadastrar empresa</button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {companies.map((c) => (
              <div key={c.id} className="glass rounded-2xl p-5 group">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-admin-champ/10 flex items-center justify-center shrink-0">
                    {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" /> : <Icon name="building" className="w-5 h-5 text-admin-champ/70" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-admin-text text-sm font-medium truncate">{c.name}</p>
                    <p className="text-admin-muted/50 text-xs">{c.city || c.document || c.email || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.05] text-xs">
                  <button onClick={() => setSelected(c)} className="text-admin-champ/80 hover:underline flex items-center gap-1"><Icon name="layers" className="w-3.5 h-3.5" />Organograma</button>
                  <button onClick={() => setModal(c)} className="ml-auto text-admin-muted/60 hover:text-admin-text">editar</button>
                  <button onClick={() => remove(c)} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      {modal && <CompanyModal company={modal} tenantId={tenantId} notify={notify} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </div>
  )
}

function CompanyModal({ company, tenantId, notify, onClose, onSaved }) {
  const editing = company?.id
  const [f, setF] = useState({ name: company?.name || '', document: company?.document || '', email: company?.email || '', phone: company?.phone || '', city: company?.city || '' })
  const [busy, setBusy] = useState(false)
  const set = (p) => setF((s) => ({ ...s, ...p }))
  const save = async () => {
    if (!f.name.trim()) return notify('Nome obrigatório', 'error')
    setBusy(true)
    const payload = { ...f, name: f.name.trim(), type: 'company', status: 'active' }
    try {
      let error
      if (editing) { const r = await supabase.from('contacts').update(payload).eq('id', company.id); error = r.error }
      else { const r = await supabase.from('contacts').insert({ ...payload, tenant_id: tenantId, source: 'crm' }); error = r.error }
      if (error) throw error
      notify(editing ? 'Empresa atualizada' : 'Empresa criada', 'success'); onSaved()
    } catch (e) { notify('Erro: ' + (e.message || e), 'error') } finally { setBusy(false) }
  }
  const L = ({ children }) => <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{children}</label>
  const inp = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-md">
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar empresa' : 'Nova empresa'}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-4">
          <div><L>Nome / Razão social *</L><input value={f.name} onChange={(e) => set({ name: e.target.value })} className={inp} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><L>CNPJ</L><input value={f.document} onChange={(e) => set({ document: e.target.value })} className={inp} /></div>
            <div><L>Cidade</L><input value={f.city} onChange={(e) => set({ city: e.target.value })} className={inp} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><L>E-mail</L><input value={f.email} onChange={(e) => set({ email: e.target.value })} className={inp} /></div>
            <div><L>Telefone</L><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} className={inp} /></div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button disabled={busy} onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{busy ? 'Salvando…' : (editing ? 'Salvar' : 'Criar empresa')}</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ---- Organograma da empresa ----
function CompanyOrg({ company, tenantId, notify, onBack, onOpenContact }) {
  const [people, setPeople] = useState([])
  const [allPeople, setAllPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [linkModal, setLinkModal] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [linkedRes, peopleRes] = await Promise.all([
        supabase.from('contacts').select('id, name, job_title, email, phone, avatar_url').eq('parent_company_id', company.id).order('name'),
        supabase.from('contacts').select('id, name').eq('type', 'person').is('parent_company_id', null).order('name').limit(1000),
      ])
      setPeople(linkedRes.data || [])
      setAllPeople(peopleRes.data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [company.id])

  const link = async (personId, jobTitle) => {
    try { await supabase.from('contacts').update({ parent_company_id: company.id, job_title: jobTitle || null }).eq('id', personId) } catch { /* noop */ }
    notify('Pessoa vinculada', 'success'); setLinkModal(false); load()
  }
  const unlink = async (p) => {
    try { await supabase.from('contacts').update({ parent_company_id: null }).eq('id', p.id) } catch { /* noop */ }
    notify('Vínculo removido', 'info'); load()
  }
  const setTitle = async (p, title) => {
    try { await supabase.from('contacts').update({ job_title: title }).eq('id', p.id) } catch { /* noop */ }
    setPeople((xs) => xs.map((x) => x.id === p.id ? { ...x, job_title: title } : x))
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button onClick={onBack} className="text-admin-muted hover:text-admin-text flex items-center gap-1.5 text-sm"><Icon name="up" className="w-4 h-4 -rotate-90" />Voltar</button>
        <h3 className="text-admin-text text-lg font-serif">{company.name} · organograma</h3>
        <button onClick={() => setLinkModal(true)} className="ml-auto flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-3 py-1.5 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Vincular pessoa</button>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p> : (
        <div className="flex flex-col items-center">
          {/* nó da empresa */}
          <div className="glass rounded-2xl px-6 py-4 text-center mb-2">
            <div className="w-12 h-12 rounded-xl bg-admin-champ/12 flex items-center justify-center mx-auto mb-2"><Icon name="building" className="w-6 h-6 text-admin-champ" /></div>
            <p className="text-admin-text font-medium">{company.name}</p>
            <p className="text-admin-muted/40 text-xs">{people.length} pessoa(s) · {company.city || 'empresa'}</p>
          </div>

          {people.length > 0 && <div className="w-px h-6 bg-white/[0.1]" />}

          {/* pessoas em grade */}
          {people.length === 0 ? (
            <p className="text-admin-muted/40 text-sm py-8">Nenhuma pessoa vinculada. Clique em "Vincular pessoa".</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full mt-2">
              {people.map((p) => (
                <div key={p.id} className="glass rounded-xl p-4 group">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-admin-sage/12 flex items-center justify-center shrink-0">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : <Icon name="user" className="w-4 h-4 text-admin-sage" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => onOpenContact && onOpenContact(p)} className="text-admin-text text-sm font-medium truncate hover:text-admin-champ text-left block w-full">{p.name}</button>
                      <input value={p.job_title || ''} onChange={(e) => setTitle(p, e.target.value)} placeholder="cargo…" className="text-admin-muted/50 text-xs bg-transparent outline-none w-full mt-0.5 focus:text-admin-text" />
                    </div>
                    <button onClick={() => unlink(p)} className="text-admin-muted/30 hover:text-admin-rose opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><Icon name="x" className="w-3.5 h-3.5" /></button>
                  </div>
                  {(p.email || p.phone) && <p className="text-admin-muted/40 text-[11px] mt-2">{[p.email, p.phone].filter(Boolean).join(' · ')}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {linkModal && <LinkPersonModal people={allPeople} onClose={() => setLinkModal(false)} onLink={link} />}
    </div>
  )
}

function LinkPersonModal({ people, onClose, onLink }) {
  const [personId, setPersonId] = useState('')
  const [title, setTitle] = useState('')
  const [q, setQ] = useState('')
  const filtered = q ? people.filter((p) => (p.name || '').toLowerCase().includes(q.toLowerCase())).slice(0, 30) : people.slice(0, 30)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-7 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">Vincular pessoa</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa…" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none mb-3" />
        <div className="max-h-56 overflow-y-auto space-y-1 mb-4">
          {filtered.length === 0 ? <p className="text-admin-muted/40 text-sm py-3 text-center">Nenhuma pessoa livre encontrada.</p> : filtered.map((p) => (
            <button key={p.id} onClick={() => setPersonId(p.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${personId === p.id ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-text/80 hover:bg-white/[0.04]'}`}>{p.name || 'Sem nome'}</button>
          ))}
        </div>
        <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Cargo (opcional)</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Diretor de compras" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none mb-5" />
        <div className="flex gap-3">
          <button disabled={!personId} onClick={() => onLink(personId, title)} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">Vincular</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
