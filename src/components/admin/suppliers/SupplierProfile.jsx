import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect, GlassMulti } from '../ui'
import { SUPPLIER_CATEGORIES, CATEGORY_ICON, VERIF_LEVELS, STATES, brl } from '../../../lib/suppliersMarket'
import { SupplierChat } from './SupplierChat'
import { uploadTo } from '../../../lib/storage'

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
  const [canReview, setCanReview] = useState(false)   // só quem cotou/comprou pode avaliar
  const [chatOpen, setChatOpen] = useState(false)
  const [prodModal, setProdModal] = useState(null) // produto em edição/criação | null
  const [editOpen, setEditOpen] = useState(false)
  const [sup, setSup] = useState(supplier)          // cópia local (reflete edições sem recarregar)
  const isMine = sup.tenant_id === tenantId

  const saveProfile = async (patch) => {
    const { data, error } = await supabase.from('suppliers').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', sup.id).select('*').single()
    if (error) return notify?.('Erro ao salvar perfil: ' + error.message, 'error')
    setSup(data); setEditOpen(false); notify?.('Perfil atualizado', 'success')
  }

  const saveProduct = async (form) => {
    if (!form.name?.trim()) return notify?.('Informe o nome do produto', 'error')
    const payload = {
      name: form.name, description: form.description || null, price: form.price !== '' && form.price != null ? Number(form.price) : null,
      unit: form.unit || null, min_qty: form.min_qty !== '' && form.min_qty != null ? Number(form.min_qty) : null,
      stock: form.stock !== '' && form.stock != null ? parseInt(form.stock) : null,
      direct_sale: !!form.direct_sale, notes: form.notes || null, image_url: form.image_url || null,
      gallery: Array.isArray(form.gallery) ? form.gallery : [], videos: Array.isArray(form.videos) ? form.videos : [],
    }
    if (form.id) {
      const { data, error } = await supabase.from('supplier_products').update(payload).eq('id', form.id).select('*').single()
      if (error) return notify?.('Erro ao salvar: ' + error.message, 'error')
      setProducts((p) => p.map((x) => (x.id === form.id ? data : x)))
    } else {
      const { data, error } = await supabase.from('supplier_products').insert({ ...payload, tenant_id: tenantId, supplier_id: s.id, status: 'active' }).select('*').single()
      if (error) return notify?.('Erro ao criar: ' + error.message, 'error')
      setProducts((p) => [data, ...p])
    }
    setProdModal(null); notify?.('Produto salvo', 'success')
  }
  const deleteProduct = async (p) => {
    if (!confirm(`Excluir o produto “${p.name}”?`)) return
    const { error } = await supabase.from('supplier_products').delete().eq('id', p.id)
    if (error) return notify?.('Erro ao excluir: ' + error.message, 'error')
    setProducts((x) => x.filter((y) => y.id !== p.id)); notify?.('Produto excluído', 'info')
  }

  const submitReview = async () => {
    if (!reviewForm?.rating) return notify?.('Escolha uma nota', 'error')
    const { data, error } = await supabase.from('supplier_reviews').insert({
      tenant_id: tenantId, supplier_id: s.id, author_name: reviewForm.author_name || null,
      rating: reviewForm.rating, comment: reviewForm.comment || null,
    }).select('*').single()
    if (error) return notify?.(error.message?.includes('policy') || error.message?.includes('row-level') ? 'Só é possível avaliar após cotar ou comprar deste fornecedor.' : 'Erro ao avaliar: ' + error.message, 'error')
    setReviews((r) => [data, ...r]); setReviewForm(null); notify?.('Avaliação publicada', 'success')
  }
  const s = sup
  const cat = SUPPLIER_CATEGORIES[s.category] || s.category
  const [gallery, setGallery] = useState(Array.isArray(supplier.gallery) ? supplier.gallery : [])
  const galleryRef = useRef(null)
  const specialties = Array.isArray(s.specialties) ? s.specialties : []
  const states = Array.isArray(s.states) ? s.states : []

  const persistGallery = async (next) => {
    setGallery(next)
    const { error } = await supabase.from('suppliers').update({ gallery: next }).eq('id', s.id)
    if (error) notify?.('Erro ao salvar galeria: ' + error.message, 'error')
  }
  const onGalleryFile = async (e) => {
    const files = Array.from(e.target.files || []); if (!files.length) return
    const urls = []
    for (const file of files) { const r = await uploadTo(file, { folder: 'suppliers/galeria', accept: 'image', maxMB: 10 }); if (r.error) { notify?.(r.error, 'error'); continue } urls.push(r.url) }
    if (urls.length) { await persistGallery([...gallery, ...urls]); notify?.('Imagem(ns) adicionada(s)', 'success') }
    if (galleryRef.current) galleryRef.current.value = ''
  }
  const removeGalleryImg = async (i) => { await persistGallery(gallery.filter((_, j) => j !== i)); notify?.('Imagem removida', 'info') }

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from('supplier_products').select('*').eq('supplier_id', s.id).eq('status', 'active').order('created_at', { ascending: false }),
        supabase.from('supplier_reviews').select('*').eq('supplier_id', s.id).order('created_at', { ascending: false }).limit(20),
      ])
      if (!alive) return
      setProducts(p || []); setReviews(r || [])
      // elegibilidade para avaliar: teve interação real com o fornecedor?
      try { const { data: ok } = await supabase.rpc('can_review_supplier', { p_supplier: s.id }); if (alive) setCanReview(!!ok) } catch { /* noop */ }
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
            {isMine && <button onClick={() => setEditOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ transition-colors"><Icon name="pen" className="w-4 h-4" />Editar perfil</button>}
            <button onClick={onFav} className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm transition-colors ${isFav ? 'bg-admin-champ/15 text-admin-champ' : 'glass-input text-admin-muted/70 hover:text-admin-champ'}`}><Icon name="star" className="w-4 h-4" filled={isFav} />{isFav ? 'Salvo' : 'Salvar'}</button>
            <button onClick={() => { const url = `${window.location.origin}/fornecedor/${s.id}`; navigator.clipboard?.writeText(url).then(() => notify?.('Link do fornecedor copiado!', 'success')).catch(() => notify?.('Link: ' + url, 'info')) }} className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm glass-input text-admin-muted/70 hover:text-admin-champ transition-colors"><Icon name="share" className="w-4 h-4" />Compartilhar</button>
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
            <div>
              {isMine && (
                <div className="flex justify-end mb-4"><button onClick={() => setProdModal({ name: '', description: '', price: '', unit: 'un', min_qty: '', stock: '', direct_sale: false, notes: '', image_url: '' })} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ transition-colors"><Icon name="plus" className="w-4 h-4" />Adicionar produto</button></div>
              )}
              {products.length === 0 ? <Empty icon="box" text={isMine ? 'Adicione seu primeiro produto.' : 'Este fornecedor ainda não publicou produtos.'} />
                : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{products.map((p) => (
                    <div key={p.id} className="group glass rounded-2xl overflow-hidden relative">
                      {isMine && (
                        <div className="absolute top-2 right-2 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setProdModal({ id: p.id, name: p.name || '', description: p.description || '', price: p.price ?? '', unit: p.unit || 'un', min_qty: p.min_qty ?? '', stock: p.stock ?? '', direct_sale: !!p.direct_sale, notes: p.notes || '', image_url: p.image_url || '', gallery: Array.isArray(p.gallery) ? p.gallery : [], videos: Array.isArray(p.videos) ? p.videos : [] })} className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-md text-white/80 hover:text-admin-champ flex items-center justify-center" title="Editar"><Icon name="pen" className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteProduct(p)} className="w-7 h-7 rounded-full bg-black/50 backdrop-blur-md text-white/80 hover:text-admin-rose flex items-center justify-center" title="Excluir"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                      <div className="h-36 bg-white/[0.03] overflow-hidden">{p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Icon name="box" className="w-8 h-8 text-admin-champ/20" /></div>}</div>
                      <div className="p-4">
                        <p className="text-admin-text text-sm font-medium truncate">{p.name}</p>
                        {p.description && <p className="text-admin-muted/50 text-xs mt-1 line-clamp-2">{p.description}</p>}
                        {p.notes && <p className="text-admin-muted/40 text-[11px] mt-1.5 italic line-clamp-2">Obs.: {p.notes}</p>}
                        <div className="flex items-center justify-between mt-3"><span className="text-admin-champ text-sm">{p.price ? brl(p.price) : 'Sob consulta'}</span>{p.unit && <span className="text-admin-muted/40 text-[11px]">/{p.unit}</span>}</div>
                      </div>
                    </div>
                  ))}</div>}
            </div>
          )}

          {tab === 'galeria' && (
            <div>
              {isMine && (
                <div className="flex justify-end mb-4">
                  <input ref={galleryRef} type="file" accept="image/*" multiple onChange={onGalleryFile} className="hidden" />
                  <button onClick={() => galleryRef.current?.click()} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ transition-colors"><Icon name="upload" className="w-4 h-4" />Adicionar imagens</button>
                </div>
              )}
              {gallery.length === 0 ? <Empty icon="image" text={isMine ? 'Adicione imagens à sua galeria.' : 'Nenhuma imagem na galeria ainda.'} />
                : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{gallery.map((url, i) => (
                    <div key={i} className="group relative rounded-xl overflow-hidden aspect-square bg-white/[0.03]">
                      <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" /></a>
                      {isMine && <button onClick={() => removeGalleryImg(i)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-md text-white/80 hover:text-admin-rose flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Excluir imagem"><Icon name="trash" className="w-3.5 h-3.5" /></button>}
                    </div>
                  ))}</div>}
            </div>
          )}

          {tab === 'avaliacoes' && (
            <div className="max-w-2xl">
              <div className="flex justify-end items-center gap-3 mb-4">
                {!canReview && !isMine && <p className="text-admin-muted/40 text-[11px] flex items-center gap-1.5"><Icon name="check" className="w-3.5 h-3.5" />Avaliações só de quem já cotou ou comprou deste fornecedor.</p>}
                {!reviewForm && canReview && <button onClick={() => setReviewForm({ author_name: '', rating: 5, comment: '' })} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ transition-colors"><Icon name="star" className="w-4 h-4" />Deixar avaliação</button>}
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
      {prodModal && <ProductEditModal initial={prodModal} onClose={() => setProdModal(null)} onSave={saveProduct} notify={notify} />}
      {editOpen && <EditProfileModal supplier={s} onClose={() => setEditOpen(false)} onSave={saveProfile} notify={notify} />}
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

const MAX_IMG = 10
const MAX_VID = 2
function ProductEditModal({ initial, onClose, onSave, notify }) {
  const [f, setF] = useState(initial)
  // galeria = todas as imagens; a 1ª é a capa (image_url). vídeos = até 2.
  const [images, setImages] = useState(() => {
    const g = Array.isArray(initial.gallery) ? initial.gallery : []
    return initial.image_url && !g.includes(initial.image_url) ? [initial.image_url, ...g] : g
  })
  const [videos, setVideos] = useState(Array.isArray(initial.videos) ? initial.videos : [])
  const [upImg, setUpImg] = useState(false)
  const [upVid, setUpVid] = useState(false)
  const [saving, setSaving] = useState(false)
  const imgRef = useRef(null); const vidRef = useRef(null)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'

  const onImages = async (e) => {
    const files = Array.from(e.target.files || [])
    const room = MAX_IMG - images.length
    if (room <= 0) { notify?.(`Limite de ${MAX_IMG} imagens atingido.`, 'error'); return }
    const take = files.slice(0, room)
    if (files.length > room) notify?.(`Enviando ${room} de ${files.length} — limite de ${MAX_IMG} imagens.`, 'info')
    setUpImg(true)
    const urls = []
    for (const file of take) { const r = await uploadTo(file, { folder: 'suppliers/produtos', accept: 'image', maxMB: 10 }); if (r.error) { notify?.(r.error, 'error'); continue } urls.push(r.url) }
    setUpImg(false); if (imgRef.current) imgRef.current.value = ''
    if (urls.length) setImages((prev) => [...prev, ...urls])
  }
  const onVideos = async (e) => {
    const files = Array.from(e.target.files || [])
    const room = MAX_VID - videos.length
    if (room <= 0) { notify?.(`Limite de ${MAX_VID} vídeos atingido.`, 'error'); return }
    const take = files.slice(0, room)
    if (files.length > room) notify?.(`Enviando ${room} de ${files.length} — limite de ${MAX_VID} vídeos.`, 'info')
    setUpVid(true)
    const urls = []
    for (const file of take) { const r = await uploadTo(file, { folder: 'suppliers/produtos-video', accept: 'any', maxMB: 100 }); if (r.error) { notify?.(r.error, 'error'); continue } urls.push(r.url) }
    setUpVid(false); if (vidRef.current) vidRef.current.value = ''
    if (urls.length) setVideos((prev) => [...prev, ...urls])
  }
  const rmImg = (i) => setImages((p) => p.filter((_, j) => j !== i))
  const rmVid = (i) => setVideos((p) => p.filter((_, j) => j !== i))

  const submit = async () => {
    if (f.direct_sale && !(Number(f.price) > 0)) return notify?.('Para venda direta, defina um preço maior que zero.', 'error')
    setSaving(true)
    // capa SEMPRE derivada da lista final de imagens (evita capa órfã de uma
    // imagem excluída). Se não há imagens, a capa fica nula.
    const cover = images.find(Boolean) || null
    await onSave({ ...f, image_url: cover, gallery: images.filter(Boolean), videos: videos.filter(Boolean) })
    setSaving(false)
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">{f.id ? 'Editar produto' : 'Novo produto'}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Nome do produto *</label><input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Pendente Aurora" className={cls} /></div>
          <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="Descrição" className={`${cls} resize-none`} />
          <textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Observações (ex.: prazo especial, variações, condições)" className={`${cls} resize-none`} />
          {/* Preço e disponibilidade — definidos pelo FORNECEDOR do produto */}
          <div className="glass-input rounded-xl p-3 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-admin-champ/70">Preço & disponibilidade</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Preço (R$)</label><input type="number" step="0.01" value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="0,00" className={cls} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Unidade</label><input value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="un, m², kit…" className={cls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Pedido mínimo</label><input type="number" value={f.min_qty} onChange={(e) => set('min_qty', e.target.value)} placeholder="ex.: 1" className={cls} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Estoque (opcional)</label><input type="number" value={f.stock} onChange={(e) => set('stock', e.target.value)} placeholder="deixe vazio se ilimitado" className={cls} /></div>
            </div>
            <label className="flex items-start gap-2 text-sm text-admin-text/80 cursor-pointer">
              <input type="checkbox" checked={!!f.direct_sale} onChange={(e) => set('direct_sale', e.target.checked)} className="w-4 h-4 accent-admin-champ mt-0.5" />
              <span>Disponível para <span className="text-admin-champ">venda direta</span><span className="block text-admin-muted/45 text-[11px]">Aparece no Marketplace de venda direta para compra imediata. Requer um preço definido.</span></span>
            </label>
          </div>

          {/* Imagens (até 10) — a 1ª é a capa */}
          <div>
            <div className="flex items-center justify-between mb-1.5"><label className="text-[10px] uppercase tracking-wider text-admin-muted/50">Imagens ({images.length}/{MAX_IMG})</label><span className="text-[10px] text-admin-muted/35">a 1ª é a capa</span></div>
            <div className="grid grid-cols-4 gap-2">
              {images.map((url, i) => (
                <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-white/[0.04]">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {i === 0 && <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-admin-champ/80 text-black px-1 rounded">capa</span>}
                  <button onClick={() => rmImg(i)} className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white/80 hover:text-admin-rose flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="x" className="w-3 h-3" /></button>
                </div>
              ))}
              {images.length < MAX_IMG && (
                <button onClick={() => imgRef.current?.click()} disabled={upImg} className="aspect-square rounded-lg glass-input flex items-center justify-center text-admin-muted/50 hover:text-admin-champ transition-colors disabled:opacity-50"><Icon name={upImg ? 'clock' : 'plus'} className="w-4 h-4" /></button>
              )}
            </div>
            <input ref={imgRef} type="file" accept="image/*" multiple onChange={onImages} className="hidden" />
          </div>

          {/* Vídeos (até 2) */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Vídeos ({videos.length}/{MAX_VID})</label>
            <div className="space-y-2">
              {videos.map((url, i) => (
                <div key={i} className="flex items-center gap-2 glass-input rounded-lg px-3 py-2 text-xs">
                  <Icon name="play" className="w-4 h-4 text-admin-champ/70 shrink-0" />
                  <a href={url} target="_blank" rel="noreferrer" className="flex-1 truncate text-admin-champ/80">Vídeo {i + 1}</a>
                  <button onClick={() => rmVid(i)} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {videos.length < MAX_VID && (
                <button onClick={() => vidRef.current?.click()} disabled={upVid} className="w-full glass-input rounded-lg px-4 py-2.5 text-sm text-admin-muted/60 hover:text-admin-champ flex items-center justify-center gap-2 transition-colors disabled:opacity-50"><Icon name={upVid ? 'clock' : 'play'} className="w-4 h-4" />{upVid ? 'Enviando…' : 'Adicionar vídeo'}</button>
              )}
            </div>
            <input ref={vidRef} type="file" accept="video/*" multiple onChange={onVideos} className="hidden" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// Edição completa do perfil do fornecedor (cadastro rico que alimenta o link público).
function EditProfileModal({ supplier, onClose, onSave, notify }) {
  const s = supplier
  const [f, setF] = useState({
    name: s.name || '', category: s.category || '', description: s.description || '', services: s.services || '',
    specialties: Array.isArray(s.specialties) ? s.specialties : [], states: Array.isArray(s.states) ? s.states : [],
    whatsapp: s.whatsapp || '', instagram: s.instagram || '', website: s.website || '', catalog_pdf_url: s.catalog_pdf_url || '',
    email: s.email || '', phone: s.phone || '', min_order: s.min_order || '', lead_time: s.lead_time || '',
    years_market: s.years_market ?? '', production_type: s.production_type || 'artesanal',
    customization: !!s.customization, export: !!s.export, logo_url: s.logo_url || '', cover_url: s.cover_url || '',
    video_url: s.video_url || '',
  })
  const [saving, setSaving] = useState(false)
  const [upLogo, setUpLogo] = useState(false)
  const [upCover, setUpCover] = useState(false)
  const [upCatalog, setUpCatalog] = useState(false)
  const [upVideo, setUpVideo] = useState(false)
  const logoRef = useRef(null); const coverRef = useRef(null); const catalogRef = useRef(null); const videoRef = useRef(null)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'

  const upload = async (file, kind) => {
    const setUp = kind === 'logo' ? setUpLogo : setUpCover
    setUp(true)
    const r = await uploadTo(file, { folder: `suppliers/${kind}`, accept: 'image', maxMB: 10 })
    setUp(false)
    if (r.error) return notify?.(r.error, 'error')
    set(kind === 'logo' ? 'logo_url' : 'cover_url', r.url)
  }
  const uploadCatalog = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUpCatalog(true)
    const r = await uploadTo(file, { folder: 'suppliers/catalogo', accept: 'any', maxMB: 25 })
    setUpCatalog(false); if (catalogRef.current) catalogRef.current.value = ''
    if (r.error) return notify?.(r.error, 'error')
    set('catalog_pdf_url', r.url)
  }
  const uploadVideo = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUpVideo(true)
    const r = await uploadTo(file, { folder: 'suppliers/video-institucional', accept: 'any', maxMB: 100 })
    setUpVideo(false); if (videoRef.current) videoRef.current.value = ''
    if (r.error) return notify?.(r.error, 'error')
    set('video_url', r.url)
  }
  const submit = async () => {
    if (!f.name.trim()) return notify?.('Informe o nome', 'error')
    setSaving(true)
    await onSave({
      ...f,
      years_market: f.years_market !== '' && f.years_market != null ? parseInt(f.years_market) : null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Editar perfil do fornecedor</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>

        {/* Capa + logo */}
        <div className="grid grid-cols-[1fr_auto] gap-3 mb-4">
          <div>
            <label className={lbl}>Capa</label>
            <input ref={coverRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'cover')} className="hidden" />
            <button onClick={() => coverRef.current?.click()} disabled={upCover} className="w-full h-20 rounded-xl overflow-hidden glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors">
              {f.cover_url ? <img src={f.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="flex items-center gap-2 text-xs"><Icon name={upCover ? 'clock' : 'image'} className="w-4 h-4" />{upCover ? 'Enviando…' : 'Enviar capa'}</span>}
            </button>
          </div>
          <div>
            <label className={lbl}>Logo</label>
            <input ref={logoRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], 'logo')} className="hidden" />
            <button onClick={() => logoRef.current?.click()} disabled={upLogo} className="w-20 h-20 rounded-xl overflow-hidden glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors">
              {f.logo_url ? <img src={f.logo_url} alt="" className="w-full h-full object-cover" /> : <Icon name={upLogo ? 'clock' : 'image'} className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className={lbl}>Nome do fornecedor *</label><input value={f.name} onChange={(e) => set('name', e.target.value)} className={cls} /></div>
          <div><label className={lbl}>Categoria</label><GlassSelect value={f.category} onChange={(v) => set('category', v)} options={[{ value: '', label: '—' }, ...Object.entries(SUPPLIER_CATEGORIES).map(([value, label]) => ({ value, label }))]} /></div>
          <div><label className={lbl}>Produção</label><GlassSelect value={f.production_type} onChange={(v) => set('production_type', v)} options={[{ value: 'artesanal', label: 'Artesanal' }, { value: 'industrial', label: 'Industrial' }, { value: 'both', label: 'Artesanal + Industrial' }]} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Sobre (descrição institucional)</label><textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} className={`${cls} resize-none`} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Serviços</label><textarea value={f.services} onChange={(e) => set('services', e.target.value)} rows={2} className={`${cls} resize-none`} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Especialidades (separe por vírgula)</label><input value={(f.specialties || []).join(', ')} onChange={(e) => set('specialties', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} className={cls} placeholder="Ex.: Assinatura olfativa, Difusores" /></div>
          <div className="sm:col-span-2"><label className={lbl}>Regiões atendidas</label><GlassMulti value={f.states} onChange={(v) => set('states', v)} options={STATES.map((x) => ({ value: x, label: x }))} placeholder="Selecione as UFs" /></div>

          <div><label className={lbl}>WhatsApp</label><input value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} className={cls} placeholder="5521999990000" /></div>
          <div><label className={lbl}>Instagram</label><input value={f.instagram} onChange={(e) => set('instagram', e.target.value)} className={cls} placeholder="@sua.marca" /></div>
          <div><label className={lbl}>Site</label><input value={f.website} onChange={(e) => set('website', e.target.value)} className={cls} placeholder="suamarca.com.br" /></div>
          <div><label className={lbl}>E-mail</label><input value={f.email} onChange={(e) => set('email', e.target.value)} className={cls} /></div>
          <div>
            <label className={lbl}>Catálogo (PDF)</label>
            <input ref={catalogRef} type="file" accept=".pdf,application/pdf" onChange={uploadCatalog} className="hidden" />
            {f.catalog_pdf_url ? (
              <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2.5">
                <Icon name="book" className="w-4 h-4 text-admin-champ/70 shrink-0" />
                <a href={f.catalog_pdf_url} target="_blank" rel="noreferrer" className="flex-1 truncate text-xs text-admin-champ/80">Catálogo enviado</a>
                <button onClick={() => catalogRef.current?.click()} className="text-[10px] text-admin-muted/60 hover:text-admin-champ">trocar</button>
                <button onClick={() => set('catalog_pdf_url', '')} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <button onClick={() => catalogRef.current?.click()} disabled={upCatalog} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-muted/60 hover:text-admin-champ flex items-center justify-center gap-2 transition-colors disabled:opacity-50"><Icon name={upCatalog ? 'clock' : 'upload'} className="w-4 h-4" />{upCatalog ? 'Enviando…' : 'Enviar catálogo (PDF)'}</button>
            )}
          </div>
          <div>
            <label className={lbl}>Vídeo institucional</label>
            <input ref={videoRef} type="file" accept="video/*" onChange={uploadVideo} className="hidden" />
            {f.video_url ? (
              <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2.5">
                <Icon name="play" className="w-4 h-4 text-admin-champ/70 shrink-0" />
                <a href={f.video_url} target="_blank" rel="noreferrer" className="flex-1 truncate text-xs text-admin-champ/80">Vídeo enviado</a>
                <button onClick={() => videoRef.current?.click()} className="text-[10px] text-admin-muted/60 hover:text-admin-champ">trocar</button>
                <button onClick={() => set('video_url', '')} className="text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <button onClick={() => videoRef.current?.click()} disabled={upVideo} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-muted/60 hover:text-admin-champ flex items-center justify-center gap-2 transition-colors disabled:opacity-50"><Icon name={upVideo ? 'clock' : 'upload'} className="w-4 h-4" />{upVideo ? 'Enviando…' : 'Enviar vídeo'}</button>
            )}
          </div>

          <div><label className={lbl}>Pedido mínimo</label><input value={f.min_order} onChange={(e) => set('min_order', e.target.value)} className={cls} placeholder="Ex.: 5 peças" /></div>
          <div><label className={lbl}>Prazo médio</label><input value={f.lead_time} onChange={(e) => set('lead_time', e.target.value)} className={cls} placeholder="Ex.: 25 dias" /></div>
          <div><label className={lbl}>Anos de mercado</label><input type="number" value={f.years_market} onChange={(e) => set('years_market', e.target.value)} className={cls} /></div>
          <div className="flex items-end gap-4 pb-1">
            <label className="flex items-center gap-2 text-sm text-admin-text/80"><input type="checkbox" checked={f.customization} onChange={(e) => set('customization', e.target.checked)} className="w-4 h-4 accent-admin-champ" />Personaliza</label>
            <label className="flex items-center gap-2 text-sm text-admin-text/80"><input type="checkbox" checked={f.export} onChange={(e) => set('export', e.target.checked)} className="w-4 h-4 accent-admin-champ" />Exporta</label>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button>
          <button onClick={submit} disabled={saving} className="px-5 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar perfil'}</button>
        </div>
      </div>
    </div>
  )
}
