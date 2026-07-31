import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, Toggle } from './ui'
import { ResourcePanel, ResourceTabs } from './ResourcePanel'
import { exportCsv, exportPdf } from '../../lib/export'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const ORDER_STATUS = { pending: 'Pendente', paid: 'Pago', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' }
const ORDER_COLORS = { pending: 'text-admin-gold', paid: 'text-admin-champ', shipped: 'text-admin-sage', delivered: 'text-admin-muted/40', cancelled: 'text-admin-rose' }

function ListingsTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [reloadKey, setReloadKey] = useState(0)

  const importFromCatalog = async () => {
    const { data } = await supabase.from('products').select('name, description, price, sku, stock').eq('status', 'active')
    if (!data?.length) return notify('Nenhum produto ativo no catálogo', 'error')
    const { data: existing } = await supabase.from('store_listings').select('title')
    const have = new Set((existing || []).map((x) => x.title))
    const rows = data.filter((p) => !have.has(p.name)).map((p) => ({ tenant_id: tenantId, title: p.name, description: p.description, price: p.price || 0, sku: p.sku, stock: p.stock || 0, is_published: true, source_table: 'products' }))
    if (!rows.length) return notify('O catálogo já está na vitrine', 'info')
    const { error } = await supabase.from('store_listings').insert(rows)
    if (error) return notify('Erro ao importar: ' + error.message, 'error')
    notify(`${rows.length} itens importados para a vitrine`, 'success'); setReloadKey((k) => k + 1)
  }

  return (
    <div>
      <div className="glass-soft rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-admin-muted/60 text-xs leading-relaxed max-w-xl">A vitrine é desacoplada: aceita itens de qualquer frente do seu ecossistema. Cadastre manualmente ou importe do catálogo de produtos.</p>
        <button onClick={importFromCatalog} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors shrink-0"><Icon name="upload" className="w-4 h-4 rotate-180" />Importar do catálogo</button>
      </div>
      <ResourcePanel
        key={reloadKey}
        embedded notify={notify} table="store_listings" title="Vitrine" subtitle="itens na vitrine" icon="cart" newLabel="Novo item" exportName="vitrine"
        orderBy={{ column: 'created_at', ascending: false }} inject={{ is_published: true }}
        fields={[
          { key: 'title', label: 'Título', type: 'text', primary: true, required: true, full: true },
          { key: 'category', label: 'Categoria', type: 'text', chip: true },
          { key: 'price', label: 'Preço (R$)', type: 'currency' },
          { key: 'compare_at_price', label: 'Preço "de" (R$)', type: 'currency' },
          { key: 'sku', label: 'SKU', type: 'text', chip: true },
          { key: 'stock', label: 'Estoque', type: 'int', chip: true },
          { key: 'image_url', label: 'URL da imagem', type: 'text', full: true },
          { key: 'is_published', label: 'Publicado na loja', type: 'bool', chip: true },
          { key: 'description', label: 'Descrição', type: 'textarea' },
        ]}
        kpis={[
          { label: 'Itens na vitrine', calc: (r) => r.length, fmt: 'int' },
          { label: 'Publicados', calc: (r) => r.filter((x) => x.is_published).length, fmt: 'int' },
          { label: 'Estoque total', calc: (r) => r.reduce((s, x) => s + (Number(x.stock) || 0), 0), fmt: 'int' },
          { label: 'Valor da vitrine', calc: (r) => r.reduce((s, x) => s + (Number(x.stock) || 0) * (Number(x.price) || 0), 0), fmt: 'currency' },
        ]}
      />
    </div>
  )
}

function OrdersTab({ notify }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { (async () => { setLoading(true); const { data } = await supabase.from('store_orders').select('*').order('created_at', { ascending: false }).limit(200); setOrders(data || []); setLoading(false) })() }, [])
  const paid = orders.filter((o) => ['paid', 'shipped', 'delivered'].includes(o.payment_status === 'paid' ? 'paid' : o.status))
  const revenue = orders.filter((o) => o.payment_status === 'paid').reduce((s, o) => s + Number(o.total || 0), 0)
  const rows = () => orders.map((o) => ({ Pedido: `#${o.number}`, Cliente: o.customer_name || '—', Total: brl(o.total), Status: ORDER_STATUS[o.status] || o.status, Pagamento: o.payment_status }))
  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <p className="text-admin-muted/50 text-sm">{orders.length} pedidos online</p>
        <div className="flex gap-2">
          <button onClick={() => exportCsv('pedidos-online.csv', rows()) || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />CSV</button>
          <button onClick={() => exportPdf('Pedidos online', rows()) || notify('Nada para exportar', 'error')} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="upload" className="w-4 h-4" />PDF</button>
        </div>
      </div>
      <div className="grid gap-3 mb-6 sm:grid-cols-3">
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Pedidos</p><p className="text-admin-champ text-2xl font-medium">{orders.length}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Pagos</p><p className="text-admin-sage text-2xl font-medium">{orders.filter((o) => o.payment_status === 'paid').length}</p></div>
        <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Receita</p><p className="text-admin-gold text-2xl font-medium">{brl(revenue)}</p></div>
      </div>
      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
        : orders.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center"><Icon name="cart" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum pedido online ainda. Os pedidos aparecem aqui quando o checkout estiver ativo (integração de pagamento é a próxima etapa).</p></div>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3"><p className="text-admin-text text-sm">#{o.number}</p><p className="text-admin-muted/60 text-sm truncate">{o.customer_name || 'Sem cliente'}</p></div>
                  <p className="text-admin-muted/40 text-xs mt-0.5">{o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : ''}{o.customer_email ? ` · ${o.customer_email}` : ''}</p>
                </div>
                <p className="text-admin-gold text-sm shrink-0">{brl(o.total)}</p>
                <span className={`text-[10px] font-medium shrink-0 ${ORDER_COLORS[o.status] || 'text-admin-muted'}`}>{ORDER_STATUS[o.status] || o.status}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

function SettingsTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('store_settings').select('*').eq('tenant_id', tenantId).maybeSingle()
      setForm(data || { currency: 'BRL', primary_color: '#b08d57', is_open: false, shipping_flat: 0, payment_methods: ['pix', 'cartao'] })
    })()
  }, [tenantId])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const save = async () => {
    if (!tenantId) return
    setSaving(true)
    const payload = {
      tenant_id: tenantId, store_name: form.store_name, slug: form.slug, about: form.about,
      currency: form.currency || 'BRL', whatsapp: form.whatsapp, email: form.email, address: form.address,
      shipping_flat: Number(form.shipping_flat) || 0, free_shipping_min: form.free_shipping_min ? Number(form.free_shipping_min) : null,
      primary_color: form.primary_color, logo_url: form.logo_url, is_open: !!form.is_open, updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('store_settings').upsert(payload, { onConflict: 'tenant_id' })
    setSaving(false)
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    notify('Configurações da loja salvas', 'success')
  }

  if (!form) return <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
  const Fld = ({ label, children }) => (<div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{label}</label>{children}</div>)

  return (
    <div className="max-w-2xl">
      <div className="glass rounded-2xl p-6 mb-5">
        <div className="flex items-center justify-between mb-5">
          <div><p className="text-admin-text text-sm font-medium">Loja online</p><p className="text-admin-muted/50 text-xs mt-0.5">{form.is_open ? 'Loja aberta ao público' : 'Loja fechada (rascunho)'}</p></div>
          <Toggle checked={!!form.is_open} onChange={(v) => set('is_open', v)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Fld label="Nome da loja"><input value={form.store_name || ''} onChange={(e) => set('store_name', e.target.value)} className={inputCls} placeholder="Minha Loja" /></Fld>
          <Fld label="Endereço (slug)"><input value={form.slug || ''} onChange={(e) => set('slug', e.target.value)} className={inputCls} placeholder="minha-loja" /></Fld>
          <div className="sm:col-span-2"><Fld label="Sobre a loja"><textarea value={form.about || ''} onChange={(e) => set('about', e.target.value)} rows={2} className={`${inputCls} resize-none`} /></Fld></div>
          <Fld label="WhatsApp"><input value={form.whatsapp || ''} onChange={(e) => set('whatsapp', e.target.value)} className={inputCls} placeholder="(11) 9…" /></Fld>
          <Fld label="E-mail"><input value={form.email || ''} onChange={(e) => set('email', e.target.value)} className={inputCls} /></Fld>
          <div className="sm:col-span-2"><Fld label="Endereço"><input value={form.address || ''} onChange={(e) => set('address', e.target.value)} className={inputCls} /></Fld></div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 mb-5">
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-4">Frete & moeda</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <Fld label="Moeda"><GlassSelect value={form.currency || 'BRL'} onChange={(v) => set('currency', v)} options={[{ value: 'BRL', label: 'Real (R$)' }, { value: 'USD', label: 'Dólar (US$)' }, { value: 'EUR', label: 'Euro (€)' }]} /></Fld>
          <Fld label="Frete fixo (R$)"><input type="number" value={form.shipping_flat ?? ''} onChange={(e) => set('shipping_flat', e.target.value)} className={inputCls} /></Fld>
          <Fld label="Frete grátis acima de (R$)"><input type="number" value={form.free_shipping_min ?? ''} onChange={(e) => set('free_shipping_min', e.target.value)} className={inputCls} /></Fld>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 mb-5">
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Pagamento</p>
        <p className="text-admin-muted/50 text-xs mb-2">A integração de pagamento (Stripe/Pix) é a última etapa do roadmap. Por ora, os métodos abaixo são exibidos como informativos na loja.</p>
        <div className="flex gap-2 flex-wrap">
          {['pix', 'cartao', 'boleto', 'dinheiro'].map((m) => {
            const on = (form.payment_methods || []).includes(m)
            return <button key={m} onClick={() => set('payment_methods', on ? form.payment_methods.filter((x) => x !== m) : [...(form.payment_methods || []), m])} className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${on ? 'bg-admin-champ/15 text-admin-champ' : 'bg-white/[0.04] text-admin-muted/60 hover:text-admin-text'}`}>{m}</button>
          })}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-8 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar configurações'}</button>
    </div>
  )
}

export function StorePanel({ notify }) {
  return (
    <ResourceTabs
      title="E-commerce"
      subtitle="Loja online — produto transversal do ecossistema"
      tabs={[
        { key: 'listings', label: 'Vitrine', render: () => <ListingsTab notify={notify} /> },
        { key: 'orders', label: 'Pedidos online', render: () => <OrdersTab notify={notify} /> },
        { key: 'settings', label: 'Configurações', render: () => <SettingsTab notify={notify} /> },
      ]}
    />
  )
}
