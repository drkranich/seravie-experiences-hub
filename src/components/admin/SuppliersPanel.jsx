import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassMulti, AddressAutocomplete } from './ui'
import { ResourceTabs } from './ResourcePanel'
import { KanbanBoard } from './Kanban'
import { LegalGate, useLegalGate } from './LegalGate'
import { logAudit } from '../../lib/audit'
import { uploadTo } from '../../lib/storage'

const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const SUPPLIER_CATEGORIES = {
  artesanato: 'Artesanato', marcenaria: 'Marcenaria', grafica: 'Gráfica', saboaria: 'Saboaria',
  velas: 'Velas', ceramica: 'Cerâmica', costura: 'Costura & Têxtil', comunicacao_visual: 'Comunicação Visual',
  embalagens: 'Embalagens', viveiro: 'Viveiro & Plantas', paisagismo: 'Paisagismo', iluminacao: 'Iluminação',
  design: 'Design', arquitetura: 'Arquitetura', decoracao: 'Decoração', automacao: 'Automação',
  aromatizacao: 'Aromatização', rural: 'Produtor Rural', cafe: 'Cafés Especiais', vinho: 'Vinícola',
  chocolate: 'Chocolateria', brindes: 'Brindes', mobiliario: 'Mobiliário', hotelaria: 'Hotelaria',
}
const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
const VERIF = {
  cadastrado: { label: 'Cadastrado', style: 'bg-white/[0.06] text-admin-muted/70' },
  verificado: { label: 'Verificado', style: 'bg-admin-champ/15 text-admin-champ' },
  curado: { label: 'Curado Seravie', style: 'bg-admin-sage/15 text-admin-sage' },
  elite: { label: 'Elite', style: 'bg-admin-gold/15 text-admin-gold' },
}
const PROD = { artesanal: 'Artesanal', industrial: 'Industrial', both: 'Artesanal + Industrial' }

function VerifBadge({ level }) {
  const v = VERIF[level] || VERIF.cadastrado
  return <span className={`text-[10px] px-2 py-0.5 rounded-lg ${v.style}`}>{v.label}</span>
}

// ---------- Diretório (leitura de todo o ecossistema) ----------
function Directory({ notify }) {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [uf, setUf] = useState('')
  const [lvl, setLvl] = useState('')
  const [detail, setDetail] = useState(null)
  const [quote, setQuote] = useState({ requester_name: '', requester_company: '', requester_whatsapp: '', message: '', budget: '' })
  const [sending, setSending] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data } = await supabase.from('suppliers').select('*').eq('status', 'published').order('verification_level', { ascending: false }).order('rating', { ascending: false })
      setRows(data || []); setLoading(false)
    })()
  }, [])

  const filtered = rows.filter((r) => {
    if (cat && r.category !== cat) return false
    if (uf && !(r.states || []).includes(uf)) return false
    if (lvl && r.verification_level !== lvl) return false
    if (q.trim()) {
      const s = q.toLowerCase()
      const hay = [r.name, r.city, r.products, (r.specialties || []).join(' '), (r.subcategories || []).join(' ')].join(' ').toLowerCase()
      if (!hay.includes(s)) return false
    }
    return true
  })

  const sendQuote = async () => {
    if (!detail) return
    setSending(true)
    const { data, error } = await supabase.functions.invoke('supplier-quote', {
      body: { supplier_id: detail.id, ...quote },
    })
    setSending(false)
    if (error || data?.error) return notify('Não foi possível enviar o pedido de orçamento: ' + (data?.error || error?.message), 'error')
    notify('Pedido de orçamento enviado ao fornecedor. A negociação ocorre diretamente entre vocês.', 'success')
    setQuote({ requester_name: '', requester_company: '', requester_whatsapp: '', message: '', budget: '' })
    setDetail(null)
  }

  return (
    <div>
      <div className="glass rounded-2xl p-4 mb-5 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Icon name="search" className="w-4 h-4 text-admin-muted/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar fornecedor, especialidade, cidade…" className={`${inputCls} pl-9`} />
        </div>
        <div className="w-44"><GlassSelect value={cat} onChange={setCat} options={[{ value: '', label: 'Todas categorias' }, ...Object.entries(SUPPLIER_CATEGORIES).map(([value, label]) => ({ value, label }))]} /></div>
        <div className="w-28"><GlassSelect value={uf} onChange={setUf} options={[{ value: '', label: 'UF' }, ...STATES.map((s) => ({ value: s, label: s }))]} /></div>
        <div className="w-40"><GlassSelect value={lvl} onChange={setLvl} options={[{ value: '', label: 'Curadoria' }, ...Object.entries(VERIF).map(([value, v]) => ({ value, label: v.label }))]} /></div>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando diretório…</p> : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><p className="text-admin-muted/50 text-sm">Nenhum fornecedor publicado ainda com esses filtros.</p><p className="text-admin-muted/30 text-xs mt-1">Fornecedores aparecem aqui quando publicam o próprio perfil na aba "Meu Perfil de Fornecedor".</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <button key={r.id} onClick={() => setDetail(r)} className="glass rounded-2xl overflow-hidden text-left hover:border-admin-champ/30 border border-transparent transition-colors flex flex-col">
              <div className="h-24 bg-gradient-to-br from-admin-champ/15 to-admin-sage/10 relative">
                {r.cover_url && <img src={r.cover_url} alt="" className="w-full h-full object-cover" />}
                <div className="absolute top-2 right-2"><VerifBadge level={r.verification_level} /></div>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2">
                  {r.logo_url ? <img src={r.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" /> : <div className="w-8 h-8 rounded-lg bg-admin-champ/10 flex items-center justify-center text-admin-champ text-xs">{(r.name || '?')[0]}</div>}
                  <div className="min-w-0"><p className="text-admin-text text-sm font-medium truncate">{r.name}</p><p className="text-admin-muted/40 text-[11px]">{SUPPLIER_CATEGORIES[r.category] || r.category}{r.city ? ` · ${r.city}` : ''}</p></div>
                </div>
                {r.description && <p className="text-admin-muted/50 text-xs mt-2 line-clamp-2">{r.description}</p>}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(r.specialties || []).slice(0, 3).map((s, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-lg bg-white/[0.04] text-admin-muted/60">{s}</span>)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="glass-pop rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="h-32 bg-gradient-to-br from-admin-champ/20 to-admin-sage/10 relative rounded-t-2xl">
              {detail.cover_url && <img src={detail.cover_url} alt="" className="w-full h-full object-cover rounded-t-2xl" />}
              <button onClick={() => setDetail(null)} className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/40 text-white flex items-center justify-center"><Icon name="x" className="w-4 h-4" /></button>
            </div>
            <div className="p-7">
              <div className="flex items-center gap-3 mb-3">
                {detail.logo_url ? <img src={detail.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover" /> : <div className="w-12 h-12 rounded-xl bg-admin-champ/10 flex items-center justify-center text-admin-champ">{(detail.name || '?')[0]}</div>}
                <div><h2 className="font-serif text-2xl text-admin-text">{detail.name}</h2><div className="flex items-center gap-2 mt-0.5"><VerifBadge level={detail.verification_level} /><span className="text-admin-muted/40 text-xs">{SUPPLIER_CATEGORIES[detail.category] || detail.category}</span></div></div>
              </div>
              {detail.description && <p className="text-admin-muted/70 text-sm mb-4">{detail.description}</p>}
              <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                {detail.city && <div><span className="text-admin-muted/40">Cidade:</span> <span className="text-admin-text">{detail.city}</span></div>}
                {(detail.states || []).length > 0 && <div><span className="text-admin-muted/40">Atende:</span> <span className="text-admin-text">{(detail.states || []).join(', ')}</span></div>}
                {detail.production_type && <div><span className="text-admin-muted/40">Produção:</span> <span className="text-admin-text">{PROD[detail.production_type] || detail.production_type}</span></div>}
                {detail.min_order && <div><span className="text-admin-muted/40">Pedido mínimo:</span> <span className="text-admin-text">{detail.min_order}</span></div>}
                {detail.lead_time && <div><span className="text-admin-muted/40">Prazo médio:</span> <span className="text-admin-text">{detail.lead_time}</span></div>}
                {detail.years_market != null && <div><span className="text-admin-muted/40">Mercado:</span> <span className="text-admin-text">{detail.years_market} anos</span></div>}
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {detail.whatsapp && <a href={`https://wa.me/${detail.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-admin-sage/15 text-admin-sage">WhatsApp</a>}
                {detail.instagram && <a href={detail.instagram.startsWith('http') ? detail.instagram : `https://instagram.com/${detail.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/70">Instagram</a>}
                {detail.website && <a href={detail.website} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/70">Site</a>}
                {detail.catalog_pdf_url && <a href={detail.catalog_pdf_url} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/70">Catálogo PDF</a>}
              </div>

              <div className="glass-soft rounded-xl p-4">
                <p className="text-admin-champ text-sm mb-3">Solicitar orçamento</p>
                <p className="text-admin-muted/40 text-[11px] mb-3">A Seravie apenas conecta as partes. A negociação ocorre diretamente entre você e o fornecedor.</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input value={quote.requester_name} onChange={(e) => setQuote((s) => ({ ...s, requester_name: e.target.value }))} placeholder="Seu nome" className={inputCls} />
                  <input value={quote.requester_company} onChange={(e) => setQuote((s) => ({ ...s, requester_company: e.target.value }))} placeholder="Empresa" className={inputCls} />
                  <input value={quote.requester_whatsapp} onChange={(e) => setQuote((s) => ({ ...s, requester_whatsapp: e.target.value }))} placeholder="WhatsApp" className={inputCls} />
                  <input type="number" value={quote.budget} onChange={(e) => setQuote((s) => ({ ...s, budget: e.target.value }))} placeholder="Orçamento estimado (R$)" className={inputCls} />
                </div>
                <textarea value={quote.message} onChange={(e) => setQuote((s) => ({ ...s, message: e.target.value }))} rows={3} placeholder="O que você procura?" className={`${inputCls} resize-none mb-3`} />
                <button onClick={sendQuote} disabled={sending || !user} className="w-full bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{sending ? 'Enviando…' : 'Enviar pedido de orçamento'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Meu Perfil de Fornecedor ----------
const EMPTY = { name: '', category: '', description: '', city: '', cep: '', address: '', address_number: '', neighborhood: '', state: '', lat: null, lng: null, logo_url: '', cover_url: '', whatsapp: '', instagram: '', website: '', catalog_pdf_url: '', products: '', services: '', min_order: '', lead_time: '', years_market: '', production_type: 'artesanal', customization: false, export: false, status: 'draft', specialties: [], subcategories: [], states: [] }

function MyProfile({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const { pending, docs, recheck } = useLegalGate()
  const [gate, setGate] = useState(false)
  const [row, setRow] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data } = await supabase.from('suppliers').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: true }).limit(1)
      const r = (data || [])[0] || null
      setRow(r)
      if (r) setForm({ ...EMPTY, ...r, specialties: r.specialties || [], subcategories: r.subcategories || [], states: r.states || [], years_market: r.years_market ?? '' })
      setLoading(false)
    })()
  }, [tenantId])

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }))
  const logoRef = useRef(null); const coverRef = useRef(null)
  const [upLogo, setUpLogo] = useState(false); const [upCover, setUpCover] = useState(false)
  const uploadImg = async (file, kind) => {
    const setU = kind === 'logo' ? setUpLogo : setUpCover
    setU(true)
    const r = await uploadTo(file, { folder: `suppliers/${kind}`, accept: 'image', maxMB: 10 })
    setU(false)
    if (r.error) return notify(r.error, 'error')
    set(kind === 'logo' ? 'logo_url' : 'cover_url', r.url)
  }
  const save = async (publish) => {
    if (!form.name.trim()) return notify('Informe o nome do fornecedor', 'error')
    setSaving(true)
    const payload = {
      name: form.name, category: form.category || null, description: form.description, city: form.city,
      cep: form.cep || null, address: form.address || null, address_number: form.address_number || null,
      neighborhood: form.neighborhood || null, state: form.state || null, country: form.country || 'BR',
      lat: form.lat ?? null, lng: form.lng ?? null,
      logo_url: form.logo_url, cover_url: form.cover_url, whatsapp: form.whatsapp, instagram: form.instagram,
      website: form.website, catalog_pdf_url: form.catalog_pdf_url, products: form.products, services: form.services,
      min_order: form.min_order, lead_time: form.lead_time, years_market: form.years_market ? parseInt(form.years_market) : null,
      production_type: form.production_type, customization: !!form.customization, export: !!form.export,
      specialties: form.specialties, subcategories: form.subcategories, states: form.states,
      status: publish != null ? (publish ? 'published' : 'draft') : form.status,
    }
    let error, id
    if (row) { const r = await supabase.from('suppliers').update(payload).eq('id', row.id); error = r.error; id = row.id }
    else { const r = await supabase.from('suppliers').insert({ ...payload, tenant_id: tenantId }).select('id').single(); error = r.error; id = r.data?.id }
    setSaving(false)
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    logAudit({ action: row ? 'update' : 'create', resource_type: 'suppliers', resource_id: id, new_data: payload }, tenantId)
    setForm((s) => ({ ...s, status: payload.status }))
    if (!row) setRow({ id, ...payload })
    notify(publish ? 'Perfil publicado no diretório Seravie Suppliers' : 'Perfil salvo', 'success')
  }

  // Publicar no diretório exige aceite dos documentos vigentes.
  const tryPublish = () => { if (pending.length > 0) setGate(true); else save(true) }

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>

  return (
    <div className="max-w-3xl">
      {gate && <LegalGate docs={docs} notify={notify} onClose={() => setGate(false)} onAccept={async () => { setGate(false); await recheck(); await save(true) }} />}
      <div className="glass rounded-2xl p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2.5 py-1 rounded-lg ${form.status === 'published' ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.06] text-admin-muted/60'}`}>{form.status === 'published' ? 'Publicado no diretório' : 'Rascunho (não visível)'}</span>
          <VerifBadge level={row?.verification_level || 'cadastrado'} />
        </div>
        <button onClick={() => notify('A verificação por biometria facial e documento será ativada assim que o provedor de identidade for conectado.', 'info')} className="text-xs px-3 py-1.5 rounded-lg bg-admin-champ/10 text-admin-champ">Solicitar verificação</button>
      </div>

      <div className="glass rounded-2xl p-6 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Nome do fornecedor *</label><input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Categoria</label><GlassSelect value={form.category} onChange={(v) => set('category', v)} options={[{ value: '', label: '—' }, ...Object.entries(SUPPLIER_CATEGORIES).map(([value, label]) => ({ value, label }))]} /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Produção</label><GlassSelect value={form.production_type} onChange={(v) => set('production_type', v)} options={Object.entries(PROD).map(([value, label]) => ({ value, label }))} /></div>
          <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Descrição institucional</label><textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className={`${inputCls} resize-none`} /></div>
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Endereço-sede (GPS)</label>
            <AddressAutocomplete
              value={{ cep: form.cep, address: form.address, address_number: form.address_number, neighborhood: form.neighborhood, city: form.city, state: form.state, lat: form.lat, lng: form.lng }}
              onChange={(a) => setForm((s) => ({ ...s, cep: a.cep, address: a.address, address_number: a.address_number, neighborhood: a.neighborhood, city: a.city, state: a.state, lat: a.lat, lng: a.lng }))}
              notify={notify}
            />
          </div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Anos de mercado</label><input type="number" value={form.years_market} onChange={(e) => set('years_market', e.target.value)} className={inputCls} /></div>
          <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Estados atendidos</label><GlassMulti value={form.states} onChange={(v) => set('states', v)} options={STATES.map((s) => ({ value: s, label: s }))} placeholder="Selecione as UFs" /></div>
          <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Especialidades (separe por vírgula)</label><input value={(form.specialties || []).join(', ')} onChange={(e) => set('specialties', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} className={inputCls} placeholder="Ex: farmhouse, rústico, personalização" /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Pedido mínimo</label><input value={form.min_order} onChange={(e) => set('min_order', e.target.value)} className={inputCls} placeholder="Ex: 50 un" /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Prazo médio de produção</label><input value={form.lead_time} onChange={(e) => set('lead_time', e.target.value)} className={inputCls} placeholder="Ex: 15 dias" /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">WhatsApp</label><input value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} className={inputCls} /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Instagram</label><input value={form.instagram} onChange={(e) => set('instagram', e.target.value)} className={inputCls} /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Site</label><input value={form.website} onChange={(e) => set('website', e.target.value)} className={inputCls} /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Catálogo (PDF URL)</label><input value={form.catalog_pdf_url} onChange={(e) => set('catalog_pdf_url', e.target.value)} className={inputCls} /></div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Logo</label>
            <input ref={logoRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImg(e.target.files[0], 'logo')} className="hidden" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => logoRef.current?.click()} disabled={upLogo} className="w-16 h-16 rounded-xl overflow-hidden glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors shrink-0 disabled:opacity-50">
                {form.logo_url ? <img src={form.logo_url} alt="" className="w-full h-full object-cover" /> : <Icon name={upLogo ? 'clock' : 'image'} className="w-5 h-5" />}
              </button>
              <input value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} className={inputCls} placeholder="ou cole uma URL" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Capa</label>
            <input ref={coverRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadImg(e.target.files[0], 'cover')} className="hidden" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => coverRef.current?.click()} disabled={upCover} className="w-16 h-16 rounded-xl overflow-hidden glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors shrink-0 disabled:opacity-50">
                {form.cover_url ? <img src={form.cover_url} alt="" className="w-full h-full object-cover" /> : <Icon name={upCover ? 'clock' : 'image'} className="w-5 h-5" />}
              </button>
              <input value={form.cover_url} onChange={(e) => set('cover_url', e.target.value)} className={inputCls} placeholder="ou cole uma URL" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-admin-muted/70 mt-1"><input type="checkbox" checked={!!form.customization} onChange={(e) => set('customization', e.target.checked)} className="accent-admin-champ" />Faz personalização</label>
          <label className="flex items-center gap-2 text-sm text-admin-muted/70 mt-1"><input type="checkbox" checked={!!form.export} onChange={(e) => set('export', e.target.checked)} className="accent-admin-champ" />Exporta</label>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={() => save(null)} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm bg-white/[0.05] text-admin-muted/80 hover:text-admin-text">Salvar rascunho</button>
          <button onClick={tryPublish} disabled={saving} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{form.status === 'published' ? 'Atualizar publicação' : 'Publicar no diretório'}</button>
          {form.status === 'published' && <button onClick={() => save(false)} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted/60">Despublicar</button>}
        </div>
      </div>
    </div>
  )
}

// ---------- Orçamentos recebidos ----------
function Quotes({ notify }) {
  return (
    <KanbanBoard notify={notify} module="suppliers" table="supplier_quotes"
      title="" subtitle="pedidos de orçamento recebidos" icon="mail"
      stageField="status" stageLabel="Situação" primary="requester_name" valueField="budget"
      stages={[
        ['new', 'Novo', 'border-admin-champ/40'],
        ['answered', 'Respondido', 'border-admin-gold/40'],
        ['negotiating', 'Negociando', 'border-admin-sage/40'],
        ['closed', 'Fechado', 'border-admin-sage/50'],
        ['declined', 'Recusado', 'border-admin-rose/40'],
      ]}
      chips={['requester_company', 'requester_whatsapp']}
      fields={[
        { key: 'requester_name', label: 'Solicitante', type: 'text', primary: true, required: true, full: true },
        { key: 'requester_company', label: 'Empresa', type: 'text' },
        { key: 'requester_whatsapp', label: 'WhatsApp', type: 'text' },
        { key: 'requester_email', label: 'E-mail', type: 'text' },
        { key: 'budget', label: 'Orçamento estimado', type: 'currency' },
        { key: 'message', label: 'Mensagem', type: 'textarea', full: true },
      ]}
      kpis={[
        { label: 'Pedidos', fmt: 'int', calc: (r) => r.length },
        { label: 'Novos', fmt: 'int', calc: (r) => r.filter((x) => x.status === 'new').length },
        { label: 'Fechados', fmt: 'int', calc: (r) => r.filter((x) => x.status === 'closed').length },
      ]}
    />
  )
}

export function SuppliersPanel({ notify }) {
  return (
    <ResourceTabs title="Seravie Suppliers" subtitle="diretório de fornecedores do ecossistema — a Seravie conecta, a negociação é direta entre as partes"
      tabs={[
        { key: 'dir', label: 'Diretório', render: () => <Directory notify={notify} /> },
        { key: 'me', label: 'Meu Perfil de Fornecedor', render: () => <MyProfile notify={notify} /> },
        { key: 'quotes', label: 'Orçamentos Recebidos', render: () => <Quotes notify={notify} /> },
      ]}
    />
  )
}
