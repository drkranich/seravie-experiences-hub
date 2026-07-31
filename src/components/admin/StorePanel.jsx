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
        <div className="flex items-center justify-between mb-4">
          <div><p className="text-admin-text text-sm font-medium">Loja online</p><p className="text-admin-muted/50 text-xs mt-0.5">{form.is_open ? 'Loja aberta ao público' : 'Loja fechada (rascunho)'}</p></div>
          <Toggle checked={!!form.is_open} onChange={(v) => set('is_open', v)} />
        </div>
        {form.slug && (
          <div className="glass-soft rounded-xl px-4 py-3 mb-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50">Endereço da loja</p><p className="text-admin-champ/80 text-xs truncate">{`${window.location.origin}/#loja/${form.slug}`}</p></div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/#loja/${form.slug}`); notify('Link copiado', 'success') }} className="border border-admin-champ/20 text-admin-champ/80 px-3 py-1.5 rounded-lg text-xs hover:bg-white/[0.04] transition-colors">Copiar link</button>
              <a href={`${window.location.origin}/#loja/${form.slug}`} target="_blank" rel="noreferrer" className="bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-3 py-1.5 rounded-lg text-xs transition-colors">Ver loja ↗</a>
            </div>
          </div>
        )}
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

function ShippingTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)
  const [conn, setConn] = useState(null)
  // calculadora
  const [destCep, setDestCep] = useState('')
  const [pkg, setPkg] = useState({ width: '', height: '', length: '', weight: '' })
  const [calcing, setCalcing] = useState(false)
  const [quotes, setQuotes] = useState(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('store_settings').select('*').eq('tenant_id', tenantId).maybeSingle()
      const dp = data?.default_package || { width: 16, height: 6, length: 20, weight: 0.5 }
      setForm({ shipping_provider: data?.shipping_provider || 'none', melhor_envio_token: data?.melhor_envio_token || '', melhor_envio_sandbox: data?.melhor_envio_sandbox ?? true, origin_postal_code: data?.origin_postal_code || '', default_package: dp })
    })()
  }, [tenantId])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const setDp = (k, v) => setForm((f) => ({ ...f, default_package: { ...f.default_package, [k]: Number(v) || 0 } }))

  const save = async () => {
    if (!tenantId) return
    setSaving(true)
    const payload = { tenant_id: tenantId, shipping_provider: form.shipping_provider, melhor_envio_token: form.melhor_envio_token || null, melhor_envio_sandbox: !!form.melhor_envio_sandbox, origin_postal_code: form.origin_postal_code || null, default_package: form.default_package, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('store_settings').upsert(payload, { onConflict: 'tenant_id' })
    setSaving(false)
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    notify('Configurações de frete salvas', 'success')
  }

  const testConn = async () => {
    if (!form.melhor_envio_token) return notify('Cole o token do Melhor Envio primeiro', 'error')
    setTesting(true); setConn(null)
    const { data, error } = await supabase.functions.invoke('melhor-envio', { body: { action: 'test', token: form.melhor_envio_token, sandbox: form.melhor_envio_sandbox } })
    setTesting(false)
    if (error) { setConn({ ok: false, error: 'Falha ao chamar o serviço de frete.' }); return }
    setConn(data)
    if (data?.ok) notify('Conexão com o Melhor Envio OK', 'success'); else notify(data?.error || 'Token inválido', 'error')
  }

  const calc = async () => {
    if (!destCep) return notify('Informe o CEP de destino', 'error')
    setCalcing(true); setQuotes(null)
    const { data, error } = await supabase.functions.invoke('melhor-envio', { body: { action: 'quote', to: destCep, width: pkg.width, height: pkg.height, length: pkg.length, weight: pkg.weight } })
    setCalcing(false)
    if (error) return notify('Falha ao calcular o frete', 'error')
    if (!data?.ok) return notify(data?.error || 'Não foi possível calcular', 'error')
    setQuotes(data.quotes || [])
    if (!data.quotes?.length) notify('Nenhuma opção de frete retornada', 'info')
  }

  if (!form) return <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
  const Fld = ({ label, children, hint }) => (<div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{label}</label>{children}{hint && <p className="text-admin-muted/40 text-[11px] mt-1">{hint}</p>}</div>)
  const isME = form.shipping_provider === 'melhor_envio'

  return (
    <div className="max-w-2xl">
      <div className="glass rounded-2xl p-6 mb-5">
        <Fld label="Método de frete">
          <GlassSelect value={form.shipping_provider} onChange={(v) => set('shipping_provider', v)} options={[
            { value: 'none', label: 'Sem cálculo de frete' },
            { value: 'flat', label: 'Frete fixo (definido em Configurações)' },
            { value: 'melhor_envio', label: 'Melhor Envio (cálculo automático)' },
          ]} />
        </Fld>
      </div>

      {isME && (
        <>
          <div className="glass rounded-2xl p-6 mb-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Credenciais Melhor Envio</p>
              <label className="flex items-center gap-2 text-xs text-admin-muted/70"><Toggle checked={!!form.melhor_envio_sandbox} onChange={(v) => set('melhor_envio_sandbox', v)} />{form.melhor_envio_sandbox ? 'Sandbox (teste)' : 'Produção'}</label>
            </div>
            <div className="glass-soft rounded-xl px-4 py-3 mb-4">
              <p className="text-admin-muted/60 text-[11px] leading-relaxed">No painel do Melhor Envio, vá em <span className="text-admin-champ/80">Integrações → Tokens</span>, gere um token com permissão de <span className="text-admin-champ/80">shipping-calculate</span> e cole abaixo. Nada de código — é só colar e salvar.</p>
            </div>
            <Fld label="Token (API)">
              <div className="relative">
                <input type={showToken ? 'text' : 'password'} value={form.melhor_envio_token} onChange={(e) => set('melhor_envio_token', e.target.value)} className={`${inputCls} pr-20`} placeholder="Cole aqui o token do Melhor Envio" />
                <button onClick={() => setShowToken((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-admin-champ/70 hover:text-admin-champ px-2 py-1">{showToken ? 'ocultar' : 'mostrar'}</button>
              </div>
            </Fld>
            <div className="mt-4"><Fld label="CEP de origem" hint="De onde suas encomendas saem."><input value={form.origin_postal_code} onChange={(e) => set('origin_postal_code', e.target.value)} className={inputCls} placeholder="00000-000" /></Fld></div>

            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mt-5 mb-3">Pacote padrão</p>
            <div className="grid grid-cols-4 gap-3">
              <Fld label="Larg. (cm)"><input type="number" value={form.default_package.width} onChange={(e) => setDp('width', e.target.value)} className={inputCls} /></Fld>
              <Fld label="Alt. (cm)"><input type="number" value={form.default_package.height} onChange={(e) => setDp('height', e.target.value)} className={inputCls} /></Fld>
              <Fld label="Comp. (cm)"><input type="number" value={form.default_package.length} onChange={(e) => setDp('length', e.target.value)} className={inputCls} /></Fld>
              <Fld label="Peso (kg)"><input type="number" step="0.1" value={form.default_package.weight} onChange={(e) => setDp('weight', e.target.value)} className={inputCls} /></Fld>
            </div>

            <div className="flex items-center gap-3 mt-5 flex-wrap">
              <button onClick={save} disabled={saving} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-6 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar frete'}</button>
              <button onClick={testConn} disabled={testing} className="border border-admin-champ/20 text-admin-champ/80 px-4 py-2.5 rounded-xl text-sm hover:bg-white/[0.04] transition-colors disabled:opacity-50">{testing ? 'Testando…' : 'Testar conexão'}</button>
              {conn && (conn.ok
                ? <span className="text-admin-sage text-xs flex items-center gap-1"><Icon name="check" className="w-4 h-4" />Conectado{conn.account?.name ? ` · ${conn.account.name}` : ''}{conn.sandbox ? ' (sandbox)' : ''}</span>
                : <span className="text-admin-rose text-xs flex items-center gap-1"><Icon name="x" className="w-4 h-4" />{conn.error || 'Falhou'}</span>)}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Calcular frete (teste)</p>
            <p className="text-admin-muted/50 text-xs mb-4">Salve o token e o CEP de origem antes de calcular. Deixe as medidas em branco para usar o pacote padrão.</p>
            <div className="grid sm:grid-cols-5 gap-3 items-end">
              <div className="sm:col-span-2"><Fld label="CEP destino"><input value={destCep} onChange={(e) => setDestCep(e.target.value)} className={inputCls} placeholder="00000-000" /></Fld></div>
              <Fld label="Peso (kg)"><input type="number" step="0.1" value={pkg.weight} onChange={(e) => setPkg((p) => ({ ...p, weight: e.target.value }))} className={inputCls} /></Fld>
              <Fld label="Comp."><input type="number" value={pkg.length} onChange={(e) => setPkg((p) => ({ ...p, length: e.target.value }))} className={inputCls} /></Fld>
              <button onClick={calc} disabled={calcing} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{calcing ? 'Calculando…' : 'Calcular'}</button>
            </div>
            {quotes && (
              <div className="mt-4 space-y-2">
                {quotes.length === 0 ? <p className="text-admin-muted/40 text-sm">Nenhuma opção retornada.</p> : quotes.map((q) => (
                  <div key={q.id} className="glass-soft rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0"><p className="text-admin-text text-sm">{q.company} · {q.service}</p>{q.delivery_time != null && <p className="text-admin-muted/40 text-xs mt-0.5">prazo {q.delivery_time} dia(s)</p>}</div>
                    <p className="text-admin-gold text-sm shrink-0">{q.price != null ? brl(q.price) : '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
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
        { key: 'shipping', label: 'Frete', render: () => <ShippingTab notify={notify} /> },
        { key: 'settings', label: 'Configurações', render: () => <SettingsTab notify={notify} /> },
      ]}
    />
  )
}
