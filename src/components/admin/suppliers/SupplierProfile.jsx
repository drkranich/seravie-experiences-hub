import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'
import { SUPPLIER_CATEGORIES, CATEGORY_ICON, VERIF_LEVELS, brl } from '../../../lib/suppliersMarket'
import { SupplierChat } from './SupplierChat'

// Perfil do fornecedor — mini-site: capa, logo, galeria, produtos, serviços,
// certificações, regiões, avaliações + ações (orçamento, favoritar, adicionar ao projeto).

function Seal({ level }) {
  const v = VERIF_LEVELS[level] || VERIF_LEVELS.bronze
  // película glassmorphism clara (branca translúcida) + texto escuro = legível sobre qualquer imagem
  const film = { background: 'rgba(255,255,255,0.85)', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }
  return <span style={film} className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-semibold backdrop-blur-md ring-1 ring-black/5 text-[#1c1c1c]"><span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />Fornecedor Homologado · Seravie {v.label}</span>
}
function Stars({ value = 0 }) {
  const full = Math.round(value)
  return <span className="text-admin-gold">{'★'.repeat(full)}<span className="text-white/15">{'★'.repeat(5 - full)}</span></span>
}
const Stat = ({ label, value }) => (
  <div className="glass rounded-xl px-4 py-3 text-center"><p className="text-admin-text text-lg font-serif">{value}</p><p className="text-[10px] uppercase tracking-wider text-admin-muted/45 mt-0.5">{label}</p></div>
)

export function SupplierProfile({ supplier, isFav, onFav, onBack, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [products, setProducts] = useState([])
  const [reviews, setReviews] = useState([])
  const [tab, setTab] = useState('sobre')
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [reviewForm, setReviewForm] = useState(null) // { author_name, rating, comment } | null
  const [chatOpen, setChatOpen] = useState(false)

  const submitReview = async () => {
    if (!reviewForm?.rating) return notify?.('Escolha uma nota', 'error')
    const { data, error } = await supabase.from('supplier_reviews').insert({
      tenant_id: tenantId, supplier_id: s.id, author_name: reviewForm.author_name || null,
      rating: reviewForm.rating, comment: reviewForm.comment || null,
    }).select('*').single()
    if (error) return notify?.('Erro ao avaliar: ' + error.message, 'error')
    setReviews((r) => [data, ...r]); setReviewForm(null); notify?.('Avaliação publicada', 'success')
  }
  const s = supplier
  const cat = SUPPLIER_CATEGORIES[s.category] || s.category
  const gallery = Array.isArray(s.gallery) ? s.gallery : []
  const specialties = Array.isArray(s.specialties) ? s.specialties : []
  const states = Array.isArray(s.states) ? s.states : []

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from('supplier_products').select('*').eq('supplier_id', s.id).eq('status', 'active').order('created_at', { ascending: false }),
        supabase.from('supplier_reviews').select('*').eq('supplier_id', s.id).order('created_at', { ascending: false }).limit(20),
      ])
      if (!alive) return
      setProducts(p || []); setReviews(r || [])
    })()
    return () => { alive = false }
  }, [s.id])

  const TABS = [
    ['sobre', 'Sobre'], ['produtos', `Produtos${products.length ? ` (${products.length})` : ''}`],
    ['galeria', 'Galeria'], ['avaliacoes', `Avaliações${reviews.length ? ` (${reviews.length})` : ''}`],
  ]

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-admin-muted/60 hover:text-admin-text text-sm mb-4 transition-colors">
        <Icon name="down" className="w-4 h-4 rotate-90" /> Voltar ao marketplace
      </button>

      {/* Capa */}
      <div className="relative rounded-3xl overflow-hidden h-52 sm:h-64 bg-gradient-to-br from-admin-copper/20 to-admin-champ/10">
        {s.cover_url
          ? <img src={s.cover_url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Icon name={CATEGORY_ICON[s.category] || 'box'} className="w-16 h-16 text-admin-champ/20" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Cabeçalho — logo sobrepõe a capa; o texto fica ABAIXO da capa (nunca sobre a imagem) */}
      <div className="px-4 sm:px-6 relative z-10">
        <div className="flex items-end gap-4 flex-wrap -mt-12">
          <div className="w-24 h-24 rounded-2xl bg-admin-side ring-4 ring-admin-side overflow-hidden shrink-0 flex items-center justify-center">
            {s.logo_url ? <img src={s.logo_url} alt="" className="w-full h-full object-cover" /> : <Icon name={CATEGORY_ICON[s.category] || 'box'} className="w-9 h-9 text-admin-champ/60" />}
          </div>
          {/* selo posicionado sobre a capa, à direita, com fundo escuro (legível em qualquer imagem) */}
          <div className="flex-1" />
        </div>
        <div className="flex items-end gap-4 flex-wrap mt-3">
          <div className="flex-1 min-w-[200px]">
            <h1 className="font-serif text-2xl sm:text-3xl text-admin-text leading-tight">{s.name}</h1>
            <div className="mt-1.5"><Seal level={s.verification_level} /></div>
            <p className="text-admin-muted/55 text-sm mt-2">{cat}{s.city ? ` · ${s.city}${s.state ? '/' + s.state : ''}` : ''}</p>
            {s.rating > 0 && <div className="flex items-center gap-2 mt-1.5"><Stars value={s.rating} /><span className="text-admin-muted/45 text-xs">{Number(s.rating).toFixed(1)} · {s.reviews_count || reviews.length} avaliações</span></div>}
          </div>
          {/* Ações */}
          <div className="flex items-center gap-2 pb-1 flex-wrap">
            <button onClick={onFav} className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${isFav ? 'bg-admin-rose/20 text-admin-rose' : 'glass-input text-admin-muted/70 hover:text-admin-rose'}`}><Icon name="heart" className="w-4 h-4" />{isFav ? 'Favoritado' : 'Favoritar'}</button>
            <button onClick={() => notify?.('Adicionado ao projeto (em breve: seleção de projeto).', 'success')} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm glass-input text-admin-muted/70 hover:text-admin-champ transition-colors"><Icon name="plus" className="w-4 h-4" />Adicionar ao projeto</button>
            <button onClick={() => setChatOpen(true)} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm glass-input text-admin-muted/70 hover:text-admin-champ transition-colors"><Icon name="mail" className="w-4 h-4" />Conversar</button>
            <button onClick={() => setQuoteOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ transition-colors"><Icon name="mail" className="w-4 h-4" />Solicitar orçamento</button>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <Stat label="Anos de mercado" value={s.years_market || '—'} />
          <Stat label="Projetos" value={s.projects_count || '—'} />
          <Stat label="Pedido mínimo" value={s.min_order || '—'} />
          <Stat label="Prazo médio" value={s.lead_time || '—'} />
        </div>

        {/* Abas */}
        <div className="flex gap-1 mt-6 bg-white/[0.03] p-1 rounded-xl w-fit flex-wrap">
          {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted/60 hover:text-admin-text'}`}>{l}</button>)}
        </div>

        <div className="mt-5 pb-8">
          {tab === 'sobre' && (
            <div className="grid lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                {s.description && <div className="glass rounded-2xl p-5"><h3 className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-2">Sobre</h3><p className="text-admin-muted/70 text-sm leading-relaxed whitespace-pre-wrap">{s.description}</p></div>}
                {s.services && <div className="glass rounded-2xl p-5"><h3 className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-2">Serviços</h3><p className="text-admin-muted/70 text-sm leading-relaxed whitespace-pre-wrap">{s.services}</p></div>}
                {specialties.length > 0 && (
                  <div className="glass rounded-2xl p-5"><h3 className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Especialidades</h3>
                    <div className="flex flex-wrap gap-2">{specialties.map((sp, i) => <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] text-admin-muted/70">{sp}</span>)}</div>
                  </div>
                )}
              </div>
              <div className="space-y-5">
                <div className="glass rounded-2xl p-5 space-y-3">
                  <h3 className="text-[11px] uppercase tracking-wider text-admin-champ/70">Atendimento</h3>
                  {s.whatsapp && <a href={`https://wa.me/${String(s.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-admin-sage hover:underline"><Icon name="chart" className="w-4 h-4" />WhatsApp</a>}
                  {s.instagram && <a href={s.instagram.startsWith('http') ? s.instagram : `https://instagram.com/${s.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-admin-champ/80 hover:underline"><Icon name="star" className="w-4 h-4" />Instagram</a>}
                  {s.website && <a href={s.website.startsWith('http') ? s.website : `https://${s.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-admin-muted/70 hover:text-admin-text"><Icon name="link" className="w-4 h-4" />Site</a>}
                  {s.catalog_pdf_url && <a href={s.catalog_pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-admin-muted/70 hover:text-admin-text"><Icon name="book" className="w-4 h-4" />Catálogo (PDF)</a>}
                </div>
                {states.length > 0 && (
                  <div className="glass rounded-2xl p-5"><h3 className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Regiões atendidas</h3>
                    <div className="flex flex-wrap gap-1.5">{states.map((uf) => <span key={uf} className="text-[11px] px-2 py-0.5 rounded-md bg-admin-champ/10 text-admin-champ/80">{uf}</span>)}</div>
                  </div>
                )}
                <div className="glass rounded-2xl p-5 space-y-2 text-sm">
                  <h3 className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-2">Detalhes</h3>
                  <div className="flex justify-between"><span className="text-admin-muted/45">Produção</span><span className="text-admin-text/80">{{ artesanal: 'Artesanal', industrial: 'Industrial', both: 'Artesanal + Industrial' }[s.production_type] || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-admin-muted/45">Personalização</span><span className="text-admin-text/80">{s.customization ? 'Sim' : 'Não'}</span></div>
                  <div className="flex justify-between"><span className="text-admin-muted/45">Exporta</span><span className="text-admin-text/80">{s.export ? 'Sim' : 'Não'}</span></div>
                </div>
              </div>
            </div>
          )}

          {tab === 'produtos' && (
            products.length === 0 ? <Empty icon="box" text="Este fornecedor ainda não publicou produtos." />
              : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{products.map((p) => (
                  <div key={p.id} className="glass rounded-2xl overflow-hidden">
                    <div className="h-36 bg-white/[0.03] overflow-hidden">{p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Icon name="box" className="w-8 h-8 text-admin-champ/20" /></div>}</div>
                    <div className="p-4"><p className="text-admin-text text-sm font-medium truncate">{p.name}</p>{p.description && <p className="text-admin-muted/50 text-xs mt-1 line-clamp-2">{p.description}</p>}<div className="flex items-center justify-between mt-3"><span className="text-admin-champ text-sm">{p.price ? brl(p.price) : 'Sob consulta'}</span>{p.unit && <span className="text-admin-muted/40 text-[11px]">/{p.unit}</span>}</div></div>
                  </div>
                ))}</div>
          )}

          {tab === 'galeria' && (
            gallery.length === 0 ? <Empty icon="image" text="Nenhuma imagem na galeria ainda." />
              : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{gallery.map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden aspect-square bg-white/[0.03]"><img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" /></a>)}</div>
          )}

          {tab === 'avaliacoes' && (
            <div className="max-w-2xl">
              <div className="flex justify-end mb-4">
                {!reviewForm && <button onClick={() => setReviewForm({ author_name: '', rating: 5, comment: '' })} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ transition-colors"><Icon name="star" className="w-4 h-4" />Deixar avaliação</button>}
              </div>
              {reviewForm && (
                <div className="glass rounded-2xl p-5 mb-4">
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setReviewForm((f) => ({ ...f, rating: n }))} className={`text-xl ${n <= reviewForm.rating ? 'text-admin-gold' : 'text-white/15'}`}>★</button>)}
                  </div>
                  <input value={reviewForm.author_name} onChange={(e) => setReviewForm((f) => ({ ...f, author_name: e.target.value }))} placeholder="Seu nome (opcional)" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none mb-3" />
                  <textarea value={reviewForm.comment} onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))} rows={3} placeholder="Conte sua experiência…" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" />
                  <div className="flex justify-end gap-2 mt-3"><button onClick={() => setReviewForm(null)} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={submitReview} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Publicar avaliação</button></div>
                </div>
              )}
              {reviews.length === 0 ? <Empty icon="star" text="Ainda sem avaliações. Seja o primeiro." />
                : <div className="space-y-3">{reviews.map((r) => (
                    <div key={r.id} className="glass rounded-2xl p-4"><div className="flex items-center justify-between mb-1"><p className="text-admin-text text-sm">{r.author_name || 'Anônimo'}</p><Stars value={r.rating} /></div>{r.comment && <p className="text-admin-muted/60 text-sm">{r.comment}</p>}<p className="text-admin-muted/30 text-[10px] mt-2">{new Date(r.created_at).toLocaleDateString('pt-BR')}</p></div>
                  ))}</div>}
            </div>
          )}
        </div>
      </div>

      {quoteOpen && <QuoteModal supplier={s} tenantId={tenantId} onClose={() => setQuoteOpen(false)} notify={notify} />}
      {chatOpen && <SupplierChat supplier={s} onClose={() => setChatOpen(false)} notify={notify} />}
    </div>
  )
}

function Empty({ icon, text }) {
  return <div className="glass rounded-2xl p-10 text-center"><Icon name={icon} className="w-9 h-9 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">{text}</p></div>
}

function QuoteModal({ supplier, tenantId, onClose, notify }) {
  const [f, setF] = useState({ requester_name: '', requester_company: '', requester_whatsapp: '', message: '', budget: '' })
  const [sending, setSending] = useState(false)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const send = async () => {
    if (!f.requester_name.trim() || !f.message.trim()) return notify?.('Informe seu nome e a mensagem', 'error')
    setSending(true)
    const { error } = await supabase.from('supplier_quotes').insert({
      supplier_id: supplier.id, tenant_id: supplier.tenant_id, requester_tenant: tenantId,
      requester_name: f.requester_name, requester_company: f.requester_company, requester_whatsapp: f.requester_whatsapp,
      message: f.message, budget: f.budget ? Number(f.budget) : null, status: 'pending',
    })
    setSending(false)
    if (error) return notify?.('Não foi possível enviar: ' + error.message, 'error')
    notify?.('Pedido de orçamento enviado ao fornecedor.', 'success'); onClose()
  }
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Solicitar orçamento</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <p className="text-admin-muted/50 text-xs mb-4">Para <span className="text-admin-champ/80">{supplier.name}</span>. A negociação ocorre diretamente entre vocês.</p>
        <div className="space-y-3">
          <input value={f.requester_name} onChange={(e) => set('requester_name', e.target.value)} placeholder="Seu nome *" className={cls} />
          <input value={f.requester_company} onChange={(e) => set('requester_company', e.target.value)} placeholder="Sua empresa" className={cls} />
          <input value={f.requester_whatsapp} onChange={(e) => set('requester_whatsapp', e.target.value)} placeholder="WhatsApp" className={cls} />
          <input type="number" value={f.budget} onChange={(e) => set('budget', e.target.value)} placeholder="Orçamento estimado (R$)" className={cls} />
          <textarea value={f.message} onChange={(e) => set('message', e.target.value)} rows={4} placeholder="O que você precisa? *" className={`${cls} resize-none`} />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button>
          <button onClick={send} disabled={sending} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50">{sending ? 'Enviando…' : 'Enviar pedido'}</button>
        </div>
      </div>
    </div>
  )
}
