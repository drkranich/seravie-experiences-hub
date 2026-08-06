import { useState, useEffect, useMemo } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { ResourcePanel, ResourceTabs } from './ResourcePanel'
import { KanbanBoard } from './Kanban'
import { logAudit } from '../../lib/audit'
import { FlowStudio } from './FlowStudio'
import { PhoneFrame, StorePreview, ProductPreview, OrderReceiptPreview } from './FlowPreview'
import { FlowImageField } from './FlowImageField'

const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const KINDS = { quarto: 'Quarto', mesa: 'Mesa', chale: 'Chalé', suite: 'Suíte', loja: 'Loja', setor: 'Setor', geladeira: 'Frigobar', adega: 'Adega', prateleira: 'Prateleira', expositor: 'Expositor', evento: 'Evento', piscina: 'Piscina', spa: 'Spa', mercado: 'Mercado autônomo' }
const flowUrl = (code) => `${window.location.origin}/flow/${code}`

function QRThumb({ code, size = 120 }) {
  const [url, setUrl] = useState('')
  useEffect(() => { QRCode.toDataURL(flowUrl(code), { margin: 1, width: 360, color: { dark: '#14160f', light: '#f4f0e6' } }).then(setUrl).catch(() => {}) }, [code])
  if (!url) return <div className="rounded-xl bg-white/[0.05]" style={{ width: size, height: size }} />
  return <img src={url} alt="QR" width={size} height={size} className="rounded-xl bg-[#f4f0e6] p-1" />
}

// ---------- Pontos (QR) ----------
function PointsTab({ notify }) {
  const { profile, canEdit, canManage } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('flow') : true
  const mayDelete = canManage ? canManage('flow') : true
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [qrView, setQrView] = useState(null)
  const [qrProducts, setQrProducts] = useState([])
  useEffect(() => {
    if (!qrView) { setQrProducts([]); return }
    supabase.from('flow_products').select('*').eq('active', true).or(`point_id.eq.${qrView.id},point_id.is.null`).order('sort_order').limit(8).then(({ data }) => setQrProducts(data || []))
  }, [qrView])

  const load = async () => { setLoading(true); const { data } = await supabase.from('flow_points').select('*').order('created_at', { ascending: false }); setRows(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm({ name: '', kind: 'mesa', branch: '', description: '', cover_url: '', active: true }); setModal(true) }
  const openEdit = (r) => { setEditing(r); setForm({ ...r }); setModal(true) }
  const save = async () => {
    if (!form.name?.trim()) return notify('Informe o nome do ponto', 'error')
    const payload = { name: form.name, kind: form.kind, branch: form.branch || null, description: form.description || null, cover_url: form.cover_url || null, active: form.active !== false }
    let error, id
    if (editing) { const r = await supabase.from('flow_points').update(payload).eq('id', editing.id); error = r.error; id = editing.id }
    else { const r = await supabase.from('flow_points').insert({ ...payload, tenant_id: tenantId }).select('id').single(); error = r.error; id = r.data?.id }
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    logAudit({ action: editing ? 'update' : 'create', resource_type: 'flow_points', resource_id: id, new_data: payload }, tenantId)
    setModal(false); load()
  }
  const remove = async (r) => {
    if (!confirm(`Remover o ponto "${r.name}"? Os QR Codes dele deixarão de funcionar.`)) return
    const { error } = await supabase.from('flow_points').delete().eq('id', r.id)
    if (error) return notify('Erro ao excluir', 'error')
    logAudit({ action: 'delete', resource_type: 'flow_points', resource_id: r.id, old_data: r }, tenantId); notify('Ponto removido', 'success'); load()
  }
  const copyLink = (code) => { navigator.clipboard?.writeText(flowUrl(code)); notify('Link copiado', 'success') }
  const downloadQR = async (r) => {
    const data = await QRCode.toDataURL(flowUrl(r.code), { margin: 2, width: 900, color: { dark: '#14160f', light: '#ffffff' } })
    const a = document.createElement('a'); a.href = data; a.download = `qr-${r.name.replace(/\s+/g, '-').toLowerCase()}.png`; a.click()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-admin-muted/50 text-sm">{rows.length} pontos de venda</p>
        {mayEdit && <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Novo ponto</button>}
      </div>
      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p> : rows.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><p className="text-admin-muted/50 text-sm">Nenhum ponto ainda.</p><p className="text-admin-muted/30 text-xs mt-1">Crie um ponto (quarto, mesa, frigobar…) e gere o QR Code para colar no ambiente.</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4 flex gap-4">
              <button onClick={() => setQrView(r)} className="shrink-0"><QRThumb code={r.code} size={96} /></button>
              <div className="min-w-0 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="text-admin-text text-sm font-medium truncate">{r.name}</p><p className="text-admin-muted/40 text-[11px]">{KINDS[r.kind] || r.kind}{r.branch ? ` · ${r.branch}` : ''}</p></div>
                  {!r.active && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-admin-muted/50">inativo</span>}
                </div>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                  <button onClick={() => copyLink(r.code)} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Copiar link</button>
                  <button onClick={() => downloadQR(r)} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Baixar QR</button>
                  {mayEdit && <button onClick={() => openEdit(r)} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Editar</button>}
                  {mayDelete && <button onClick={() => remove(r)} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-rose">Excluir</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {qrView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto" onClick={() => setQrView(null)}>
          <div className="glass-pop rounded-2xl p-7" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col sm:flex-row gap-8 items-center">
              {/* QR + ações */}
              <div className="text-center">
                <QRThumb code={qrView.code} size={220} />
                <p className="text-admin-text font-medium mt-4">{qrView.name}</p>
                <p className="text-admin-muted/40 text-xs break-all mt-1 max-w-[220px] mx-auto">{flowUrl(qrView.code)}</p>
                <div className="flex gap-2 mt-5 justify-center"><button onClick={() => downloadQR(qrView)} className="bg-admin-champ/15 text-admin-champ px-4 py-2 rounded-xl text-sm">Baixar PNG</button><button onClick={() => copyLink(qrView.code)} className="bg-white/[0.05] text-admin-muted/70 px-4 py-2 rounded-xl text-sm">Copiar link</button></div>
              </div>
              {/* preview da loja pública */}
              <PhoneFrame label="Como o cliente vê"><StorePreview point={qrView} products={qrProducts} /></PhoneFrame>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-lg">
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar ponto' : 'Novo ponto'}</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Nome *</label><input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="Ex: Quarto 204 · Mesa 7 · Frigobar Suíte" /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Tipo</label><GlassSelect value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v }))} options={Object.entries(KINDS).map(([value, label]) => ({ value, label }))} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Filial (opcional)</label><input value={form.branch || ''} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} className={inputCls} /></div>
              <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Descrição</label><textarea value={form.description || ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></div>
              <div className="col-span-2"><FlowImageField label="Imagem de capa" value={form.cover_url || ''} onChange={(url) => setForm((f) => ({ ...f, cover_url: url }))} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm text-admin-muted/70"><input type="checkbox" checked={form.active !== false} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="accent-admin-champ" />Ponto ativo (QR funcionando)</label>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">{editing ? 'Salvar' : 'Criar ponto'}</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Pagamentos (config do tenant) ----------
// Grava em tenants.settings.payments. NUNCA guarda segredos do Stripe aqui —
// as chaves secretas ficam nos Secrets do Supabase. Aqui só flags e dados do PIX.
function PaymentsTab({ notify }) {
  const { profile, canManage } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canManage ? canManage('flow') : true
  const [cfg, setCfg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    supabase.from('tenants').select('settings').eq('id', tenantId).maybeSingle().then(({ data }) => {
      setCfg({
        pix_enabled: false, pix_key: '', pix_key_type: 'cpf', pix_holder: '', pix_qr_url: '', pix_instructions: '',
        require_receipt: true, stripe_enabled: false, pix_dynamic_enabled: false, cash_enabled: true,
        ...((data?.settings || {}).payments || {}),
      })
      setLoading(false)
    })
  }, [tenantId])

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }))
  const save = async () => {
    setSaving(true)
    const { data: t } = await supabase.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
    const { error } = await supabase.from('tenants').update({ settings: { ...(t?.settings || {}), payments: cfg } }).eq('id', tenantId)
    setSaving(false)
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    logAudit({ action: 'update', resource_type: 'tenant_payments', resource_id: tenantId, new_data: { ...cfg, pix_key: cfg.pix_key ? '***' : '' } }, tenantId)
    notify('Formas de pagamento salvas', 'success')
  }

  if (loading || !cfg) return <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p>
  const PIX_TYPES = { cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', phone: 'Telefone', random: 'Chave aleatória' }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* PIX estático */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div><p className="text-admin-text font-medium">PIX (chave estática)</p><p className="text-admin-muted/50 text-xs mt-0.5">O cliente paga na sua chave e anexa o comprovante — abre um chamado no Help Desk para conferência.</p></div>
          <label className="flex items-center gap-2 shrink-0"><input type="checkbox" checked={!!cfg.pix_enabled} onChange={(e) => set('pix_enabled', e.target.checked)} className="w-4 h-4 accent-admin-champ" disabled={!mayEdit} /><span className="text-xs text-admin-muted/70">Ativo</span></label>
        </div>
        {cfg.pix_enabled && (
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Tipo de chave</label><GlassSelect value={cfg.pix_key_type} onChange={(v) => set('pix_key_type', v)} options={Object.entries(PIX_TYPES).map(([value, label]) => ({ value, label }))} /></div>
            <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Chave PIX</label><input value={cfg.pix_key} onChange={(e) => set('pix_key', e.target.value)} className={inputCls} placeholder="sua chave" /></div>
            <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Favorecido (nome)</label><input value={cfg.pix_holder} onChange={(e) => set('pix_holder', e.target.value)} className={inputCls} /></div>
            <div className="col-span-2"><FlowImageField label="QR Code do PIX (imagem — opcional)" value={cfg.pix_qr_url} onChange={(url) => set('pix_qr_url', url)} accept="image" hint="Se vazio, geramos o QR a partir da chave" /></div>
            <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Instruções ao cliente</label><textarea value={cfg.pix_instructions} onChange={(e) => set('pix_instructions', e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Ex: envie o comprovante para confirmar o pedido" /></div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-admin-muted/70"><input type="checkbox" checked={cfg.require_receipt !== false} onChange={(e) => set('require_receipt', e.target.checked)} className="accent-admin-champ" />Exigir comprovante para concluir o pedido</label>
          </div>
        )}
      </div>

      {/* Stripe (cartão / PIX dinâmico) */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div><p className="text-admin-text font-medium">Stripe · cartão e PIX dinâmico</p><p className="text-admin-muted/50 text-xs mt-0.5">Checkout automático com confirmação online. As chaves secretas ficam nos Secrets do Supabase, nunca aqui.</p></div>
          <label className="flex items-center gap-2 shrink-0"><input type="checkbox" checked={!!cfg.stripe_enabled} onChange={(e) => set('stripe_enabled', e.target.checked)} className="w-4 h-4 accent-admin-champ" disabled={!mayEdit} /><span className="text-xs text-admin-muted/70">Ativo</span></label>
        </div>
        {cfg.stripe_enabled && (
          <label className="flex items-center gap-2 text-sm text-admin-muted/70 mt-4"><input type="checkbox" checked={!!cfg.pix_dynamic_enabled} onChange={(e) => set('pix_dynamic_enabled', e.target.checked)} className="accent-admin-champ" />Oferecer também PIX dinâmico (via Stripe)</label>
        )}
      </div>

      {/* Pagar no local */}
      <div className="glass rounded-2xl p-5 flex items-center justify-between">
        <div><p className="text-admin-text font-medium">Pagar no local</p><p className="text-admin-muted/50 text-xs mt-0.5">Permite enviar o pedido e acertar o pagamento presencialmente.</p></div>
        <label className="flex items-center gap-2 shrink-0"><input type="checkbox" checked={cfg.cash_enabled !== false} onChange={(e) => set('cash_enabled', e.target.checked)} className="w-4 h-4 accent-admin-champ" disabled={!mayEdit} /><span className="text-xs text-admin-muted/70">Ativo</span></label>
      </div>

      {mayEdit && <button onClick={save} disabled={saving} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-6 py-2.5 rounded-xl text-sm disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar formas de pagamento'}</button>}
    </div>
  )
}

// Preview interativo reutilizável: escolhe um item da lista e mostra no celular como o cliente vê.
function PreviewShelf({ label, emptyHint, load, itemLabel, render }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [sel, setSel] = useState(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!open) return
    setLoading(true)
    load().then((data) => { const list = data || []; setItems(list); setSel((s) => s || list[0] || null); setLoading(false) })
  }, [open])
  return (
    <>
      <div className="flex justify-end mb-3">
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ"><Icon name="eye" className="w-3.5 h-3.5" />{label}</button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="glass-pop rounded-2xl p-7 max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{label}</h2><button onClick={() => setOpen(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p> : items.length === 0 ? (
              <p className="text-admin-muted/40 text-sm py-12 text-center">{emptyHint}</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="sm:w-56 shrink-0 max-h-[520px] overflow-y-auto space-y-1.5">
                  {items.map((it) => (
                    <button key={it.id} onClick={() => setSel(it)} className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${sel?.id === it.id ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.03] text-admin-muted/70 hover:text-admin-text'}`}>{itemLabel(it)}</button>
                  ))}
                </div>
                <div className="flex-1 flex justify-center"><PhoneFrame label="Como o cliente vê">{sel ? render(sel) : null}</PhoneFrame></div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ---------- Catálogo ----------
function CatalogTab({ notify }) {
  return (
    <div>
    <PreviewShelf label="Ver na loja" emptyHint="Cadastre um produto para ver como ele aparece na loja do cliente."
      load={() => supabase.from('flow_products').select('*').order('sort_order').then((r) => r.data)}
      itemLabel={(p) => p.name}
      render={(p) => <ProductPreview product={p} />}
    />
    <ResourcePanel notify={notify} module="flow" table="flow_products" embedded exportName="flow-catalogo" newLabel="Novo produto"
      orderBy={{ column: 'sort_order', ascending: true }}
      fields={[
        { key: 'name', label: 'Produto', type: 'text', primary: true, required: true, full: true, search: true },
        { key: 'point_id', label: 'Ponto (vazio = todos)', type: 'ref', refTable: 'flow_points', refLabel: 'name', chip: true, filter: true, placeholder: '— todos os pontos —' },
        { key: 'category', label: 'Categoria', type: 'text', chip: true, filter: false },
        { key: 'price', label: 'Preço', type: 'currency', required: true },
        { key: 'promo_price', label: 'Preço promocional', type: 'currency' },
        { key: 'stock', label: 'Estoque (vazio = ilimitado)', type: 'int' },
        { key: 'min_stock', label: 'Estoque mínimo', type: 'int' },
        { key: 'image_url', label: 'Imagem', type: 'image', full: true },
        { key: 'video_url', label: 'Vídeo (URL)', type: 'text', full: true },
        { key: 'sort_order', label: 'Ordem', type: 'int' },
        { key: 'active', label: 'Ativo', type: 'bool', default: true },
        { key: 'description', label: 'Descrição', type: 'textarea' },
      ]}
      kpis={[
        { label: 'Produtos', calc: (r) => r.length, fmt: 'int' },
        { label: 'Ativos', calc: (r) => r.filter((x) => x.active).length, fmt: 'int' },
        { label: 'Em promoção', calc: (r) => r.filter((x) => x.promo_price > 0).length, fmt: 'int' },
        { label: 'Estoque baixo', calc: (r) => r.filter((x) => x.stock != null && x.min_stock != null && x.stock <= x.min_stock).length, fmt: 'int' },
      ]}
    />
    </div>
  )
}

// Faixa de comprovantes de PIX estático aguardando conferência manual.
function ReceiptsStrip({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const load = async () => {
    const { data } = await supabase.from('flow_orders').select('*').eq('payment_status', 'awaiting_confirmation').order('created_at', { ascending: false }).limit(50)
    setRows(data || [])
  }
  useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv) }, [])

  const confirmPay = async (o) => {
    const { error } = await supabase.from('flow_orders').update({ payment_status: 'paid', status: 'paid', paid_at: new Date().toISOString() }).eq('id', o.id)
    if (error) return notify('Erro ao confirmar', 'error')
    logAudit({ action: 'update', resource_type: 'flow_orders', resource_id: o.id, new_data: { payment_status: 'paid' } }, tenantId)
    notify('Pagamento confirmado', 'success'); load()
  }
  const rejectPay = async (o) => {
    if (!confirm('Recusar este comprovante? O pedido volta para pendente.')) return
    const { error } = await supabase.from('flow_orders').update({ payment_status: 'pending' }).eq('id', o.id)
    if (error) return notify('Erro ao recusar', 'error')
    notify('Comprovante recusado', 'success'); load()
  }

  if (!rows.length) return null
  return (
    <div className="glass rounded-2xl p-4 mb-4 border border-admin-gold/25">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="eye" className="w-4 h-4 text-admin-gold" />
        <p className="text-admin-gold text-sm font-medium">Comprovantes aguardando conferência</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-admin-gold/15 text-admin-gold">{rows.length}</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((o) => (
          <div key={o.id} className="glass-soft rounded-xl p-3 flex gap-3">
            <a href={o.receipt_url || '#'} target="_blank" rel="noreferrer" className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-white/[0.05] flex items-center justify-center">
              {o.receipt_url ? <img src={o.receipt_url} alt="comprovante" className="w-full h-full object-cover" /> : <Icon name="image" className="w-5 h-5 text-admin-muted/40" />}
            </a>
            <div className="min-w-0 flex-1">
              <p className="text-admin-text text-sm truncate">{o.point_name || 'Pedido'}{o.reference ? ` · ${o.reference}` : ''}</p>
              <p className="text-admin-gold text-xs">{brl(o.total)}</p>
              {(o.customer_name || o.customer_phone) && <p className="text-admin-muted/50 text-[11px] truncate">{[o.customer_name, o.customer_phone].filter(Boolean).join(' · ')}</p>}
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => confirmPay(o)} className="text-[10px] px-2 py-1 rounded-lg bg-admin-sage/15 text-admin-sage hover:bg-admin-sage/25">Confirmar</button>
                <button onClick={() => rejectPay(o)} className="text-[10px] px-2 py-1 rounded-lg bg-white/[0.05] text-admin-muted/60 hover:text-admin-rose">Recusar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- Pedidos ----------
function OrdersTab({ notify }) {
  return (
    <div>
    <ReceiptsStrip notify={notify} />
    <PreviewShelf label="Ver comprovante" emptyHint="Quando chegar um pedido, você vê aqui o comprovante como o cliente recebe."
      load={() => supabase.from('flow_orders').select('*').order('created_at', { ascending: false }).limit(30).then((r) => r.data)}
      itemLabel={(o) => `${o.point_name || 'Pedido'}${o.reference ? ' · ' + o.reference : ''} — ${brl(o.total)}`}
      render={(o) => <OrderReceiptPreview order={o} />}
    />
    <KanbanBoard notify={notify} module="flow" table="flow_orders" title="" subtitle="pedidos recebidos pelos QR Codes" icon="cart"
      stageField="status" stageLabel="Status" primary="point_name" valueField="total"
      stages={[
        ['pending', 'Recebido', 'border-admin-champ/40'],
        ['paid', 'Pago', 'border-admin-sage/40'],
        ['preparing', 'Preparando', 'border-admin-gold/40'],
        ['delivered', 'Entregue', 'border-admin-sage/50'],
        ['cancelled', 'Cancelado', 'border-admin-rose/40'],
      ]}
      chips={['reference', 'customer_name', 'payment_method']}
      fields={[
        { key: 'point_name', label: 'Ponto', type: 'text', primary: true, full: true },
        { key: 'reference', label: 'Nº quarto/mesa', type: 'text' },
        { key: 'customer_name', label: 'Cliente', type: 'text' },
        { key: 'total', label: 'Total', type: 'currency' },
        { key: 'payment_method', label: 'Pagamento', type: 'text' },
        { key: 'notes', label: 'Observações', type: 'textarea', full: true },
      ]}
      kpis={[
        { label: 'Pedidos', fmt: 'int', calc: (r) => r.length },
        { label: 'Recebidos', fmt: 'int', calc: (r) => r.filter((x) => x.status === 'pending').length },
        { label: 'Faturamento', fmt: 'currency', calc: (r) => r.filter((x) => !['cancelled'].includes(x.status)).reduce((s, x) => s + Number(x.total || 0), 0) },
      ]}
    />
    </div>
  )
}

// Barra animada de ranking: largura cresce com transição CSS ao montar/atualizar.
function RankBar({ name, value, max, suffix, display, accent = 'champ', rank }) {
  const [w, setW] = useState(0)
  useEffect(() => { const id = requestAnimationFrame(() => setW(max > 0 ? Math.max(4, (value / max) * 100) : 0)); return () => cancelAnimationFrame(id) }, [value, max])
  const barColor = accent === 'rose' ? 'bg-admin-rose/40' : accent === 'gold' ? 'bg-admin-gold/45' : 'bg-admin-champ/50'
  const valColor = accent === 'rose' ? 'text-admin-rose' : accent === 'gold' ? 'text-admin-gold' : 'text-admin-champ'
  const shown = display != null ? display : suffix ? `${value} ${suffix}` : value
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="text-admin-text text-sm truncate flex items-center gap-2">
          {rank != null && <span className="text-admin-muted/40 text-[11px] w-4 shrink-0">{rank}º</span>}
          <span className="truncate">{name}</span>
        </span>
        <span className={`text-sm shrink-0 ${valColor}`}>{shown}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-[width] duration-700 ease-out`} style={{ width: `${w}%` }} />
      </div>
    </div>
  )
}

// ---------- Painel (dashboard em tempo real) ----------
function DashboardTab() {
  const [orders, setOrders] = useState([])
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [kindFilter, setKindFilter] = useState('') // '' = todas as frentes
  const load = async () => {
    setLoading(true)
    const [{ data: ords }, { data: pts }] = await Promise.all([
      supabase.from('flow_orders').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('flow_points').select('id, name, kind'),
    ])
    setOrders(ords || []); setPoints(pts || []); setLoading(false)
  }
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [])

  // Mapa nome-do-ponto -> kind (o pedido guarda point_name; casamos pelo nome).
  const kindByPointName = useMemo(() => Object.fromEntries(points.map((p) => [p.name, p.kind])), [points])
  // Tipos de frente presentes nos pontos, para o filtro.
  const availableKinds = useMemo(() => [...new Set(points.map((p) => p.kind).filter(Boolean))], [points])

  const stats = useMemo(() => {
    const valid = orders.filter((o) => o.status !== 'cancelled' && (!kindFilter || kindByPointName[o.point_name] === kindFilter))
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const revToday = valid.filter((o) => new Date(o.created_at) >= today).reduce((s, o) => s + Number(o.total || 0), 0)
    const revMonth = valid.filter((o) => new Date(o.created_at) >= monthStart).reduce((s, o) => s + Number(o.total || 0), 0)
    const ticket = valid.length ? valid.reduce((s, o) => s + Number(o.total || 0), 0) / valid.length : 0
    const byProduct = {}; const byPoint = {}; const byHour = Array(24).fill(0)
    valid.forEach((o) => {
      byPoint[o.point_name || '—'] = (byPoint[o.point_name || '—'] || 0) + Number(o.total || 0)
      byHour[new Date(o.created_at).getHours()] += Number(o.total || 0)
        ; (o.items || []).forEach((it) => { byProduct[it.name] = (byProduct[it.name] || 0) + (it.qty || 0) })
    })
    const ranked = Object.entries(byProduct).sort((a, b) => b[1] - a[1])
    const topProducts = ranked.slice(0, 6)
    const bottomProducts = ranked.length > 6 ? ranked.slice(-5).reverse() : ranked.slice(1).reverse()
    const topPoints = Object.entries(byPoint).sort((a, b) => b[1] - a[1]).slice(0, 6)
    const peakHour = byHour.indexOf(Math.max(...byHour))
    return { revToday, revMonth, ticket, count: valid.length, topProducts, bottomProducts, topPoints, byHour, peakHour }
  }, [orders, kindFilter, kindByPointName])

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>
  const maxHour = Math.max(1, ...stats.byHour)
  const maxTopProd = Math.max(1, ...stats.topProducts.map((x) => x[1]))
  const maxBottomProd = Math.max(1, ...stats.bottomProducts.map((x) => x[1]))
  const maxPoint = Math.max(1, ...stats.topPoints.map((x) => x[1]))

  return (
    <div className="space-y-5">
      {/* Filtro por tipo de frente (kind do ponto) */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-admin-muted/50 text-xs uppercase tracking-wider">Frente:</span>
        <div className="w-52"><GlassSelect value={kindFilter} onChange={setKindFilter} options={[{ value: '', label: 'Todas as frentes' }, ...availableKinds.map((k) => ({ value: k, label: KINDS[k] || k }))]} /></div>
        {kindFilter && <span className="text-admin-champ/70 text-xs">Filtrando por {KINDS[kindFilter] || kindFilter}</span>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[['Faturamento hoje', brl(stats.revToday), 'text-admin-champ'], ['Faturamento no mês', brl(stats.revMonth), 'text-admin-sage'], ['Ticket médio', brl(stats.ticket), 'text-admin-gold'], ['Pedidos', String(stats.count), 'text-admin-text']].map(([l, v, c]) => (
          <div key={l} className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">{l}</p><p className={`text-2xl font-medium ${c}`}>{v}</p></div>
        ))}
      </div>

      {/* Rankings animados: MAIS e MENOS vendidos */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">🔥 Mais vendidos</p>
          {stats.topProducts.length === 0 ? <p className="text-admin-muted/40 text-sm">Sem vendas ainda.</p> : stats.topProducts.map(([name, qty], i) => (
            <RankBar key={name} name={name} value={qty} max={maxTopProd} suffix="un" accent="champ" rank={i + 1} />
          ))}
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] tracking-wider uppercase text-admin-rose/70 mb-3">🐢 Menos vendidos</p>
          {stats.bottomProducts.length === 0 ? <p className="text-admin-muted/40 text-sm">Ainda sem dados suficientes.</p> : stats.bottomProducts.map(([name, qty], i) => (
            <RankBar key={name} name={name} value={qty} max={maxBottomProd} suffix="un" accent="rose" rank={i + 1} />
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Vendas por ponto</p>
        {stats.topPoints.length === 0 ? <p className="text-admin-muted/40 text-sm">Sem vendas ainda.</p> : stats.topPoints.map(([name, val]) => (
          <RankBar key={name} name={name} value={val} display={brl(val)} max={maxPoint} accent="gold" />
        ))}
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4"><p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Faturamento por hora</p>{stats.count > 0 && <p className="text-admin-muted/40 text-xs">Pico às {String(stats.peakHour).padStart(2, '0')}h</p>}</div>
        <div className="flex items-end gap-1 h-32">
          {stats.byHour.map((v, h) => (
            <div key={h} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h}h · ${brl(v)}`}>
              <div className="w-full rounded-t bg-admin-champ/50 transition-[height] duration-700 ease-out" style={{ height: `${(v / maxHour) * 100}%`, minHeight: v > 0 ? 3 : 0 }} />
              {h % 6 === 0 && <span className="text-[8px] text-admin-muted/30 mt-1">{h}h</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function FlowPanel({ notify }) {
  return (
    <ResourceTabs title="Seravie Flow" subtitle="vendas por QR Code e experiências/formulários cinematográficos"
      tabs={[
        { key: 'studio', label: 'Flow Studio', render: () => <FlowStudio notify={notify} /> },
        { key: 'points', label: 'Pontos & QR', render: () => <PointsTab notify={notify} /> },
        { key: 'catalog', label: 'Catálogo', render: () => <CatalogTab notify={notify} /> },
        { key: 'orders', label: 'Pedidos', render: () => <OrdersTab notify={notify} /> },
        { key: 'payments', label: 'Pagamentos', render: () => <PaymentsTab notify={notify} /> },
        { key: 'dash', label: 'Painel', render: () => <DashboardTab /> },
      ]}
    />
  )
}
