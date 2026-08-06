// Edge Function: fiscal-emit
// Emite um documento fiscal (NFC-e por padrão) para um pedido, via gateway
// fiscal (PlugNotas / Focus NFe / Nuvem Fiscal). "Pronto para plugar":
// - Se o secret FISCAL_API_KEY não estiver configurado, ou o tenant não tiver
//   fiscal_settings.enabled, responde { error:'fiscal_not_configured' } e cria
//   um fiscal_documents com status 'pending' (fallback gracioso — o app orienta).
// - Com a chave e o provedor configurados, chama o gateway e persiste o retorno.
//
// Secrets esperados (configurar no Supabase → Edge Functions → Secrets):
//   FISCAL_API_KEY   — token do gateway fiscal
//   FISCAL_BASE_URL  — (opcional) sobrescreve a URL base do provedor
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

const PROVIDER_URLS = {
  plugnotas: 'https://api.plugnotas.com.br',
  focusnfe: 'https://api.focusnfe.com.br',
  nuvemfiscal: 'https://api.nuvemfiscal.com.br',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const admin = createClient(url, service)

  // Autenticação: exige um usuário logado do tenant (o app chama autenticado).
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace('Bearer ', '')
  const { data: userData } = await admin.auth.getUser(jwt)
  const user = userData?.user
  if (!user) return json({ error: 'unauthorized' }, 401)

  let p = {}
  try { p = await req.json() } catch { /* vazio */ }
  const orderId = p.order_id || null
  const docType = ['nfce', 'nfe', 'sat'].includes(p.doc_type) ? p.doc_type : 'nfce'

  // Descobrir tenant do usuário
  const { data: mem } = await admin.from('memberships').select('tenant_id').eq('user_id', user.id).eq('status', 'active').maybeSingle()
  const tenantId = mem?.tenant_id
  if (!tenantId) return json({ error: 'no_tenant' }, 403)

  const { data: cfg } = await admin.from('fiscal_settings').select('*').eq('tenant_id', tenantId).maybeSingle()
  const apiKey = Deno.env.get('FISCAL_API_KEY')

  // Itens/valor: se veio no corpo usa; senão tenta buscar do pedido
  let items = Array.isArray(p.items) ? p.items : []
  let amount = Number(p.amount) || 0
  let customer = p.customer || {}
  if (orderId && (!items.length || !amount)) {
    const { data: ord } = await admin.from('orders').select('items,total,customer_name').eq('id', orderId).maybeSingle()
    if (ord) { items = items.length ? items : (ord.items || []); amount = amount || Number(ord.total) || 0; customer.name = customer.name || ord.customer_name }
  }

  // Fallback gracioso: sem gateway configurado → registra pendente e orienta.
  if (!apiKey || !cfg?.enabled) {
    const { data: doc } = await admin.from('fiscal_documents').insert({
      tenant_id: tenantId, order_id: orderId, doc_type: docType, status: 'pending',
      amount, customer, items, reject_reason: 'fiscal_not_configured',
    }).select('id').single()
    return json({ error: 'fiscal_not_configured', document_id: doc?.id, detail: 'Configure o gateway fiscal (provedor, CNPJ, certificado) e o segredo FISCAL_API_KEY para emitir automaticamente.' }, 200)
  }

  const base = Deno.env.get('FISCAL_BASE_URL') || PROVIDER_URLS[cfg.provider] || PROVIDER_URLS.plugnotas

  // NOTE: cada gateway tem seu próprio payload. Abaixo um esqueleto genérico;
  // ajuste o mapeamento conforme o provedor escolhido (documentação do gateway).
  try {
    const payload = {
      environment: cfg.environment,
      emitter: { cnpj: cfg.cnpj, ie: cfg.ie, legal_name: cfg.legal_name, trade_name: cfg.trade_name, address: cfg.address, tax_regime: cfg.tax_regime },
      doc_type: docType, series: cfg.nfce_series,
      customer, amount,
      items: items.map((it) => ({ name: it.name, qty: it.qty || 1, unit_price: it.unit_price || it.price || 0, ncm: it.ncm || cfg.default_ncm, cfop: it.cfop || cfg.default_cfop })),
    }
    const r = await fetch(`${base}/nfce`, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await r.json().catch(() => ({}))
    const ok = r.ok && (d.status === 'authorized' || d.access_key || d.chave)
    const { data: doc } = await admin.from('fiscal_documents').insert({
      tenant_id: tenantId, order_id: orderId, doc_type: docType,
      status: ok ? 'authorized' : 'error',
      access_key: d.access_key || d.chave || null,
      protocol: d.protocol || d.protocolo || null,
      provider_ref: d.id || d.ref || null,
      number: d.number || d.numero || null, series: cfg.nfce_series,
      amount, customer, items,
      danfe_url: d.danfe_url || d.pdf || null, xml_url: d.xml_url || d.xml || null,
      reject_reason: ok ? null : (d.message || d.erro || 'erro_gateway'),
      authorized_at: ok ? new Date().toISOString() : null,
    }).select('id, status, access_key, danfe_url').single()
    return json({ ok, document: doc })
  } catch (e) {
    const { data: doc } = await admin.from('fiscal_documents').insert({
      tenant_id: tenantId, order_id: orderId, doc_type: docType, status: 'error',
      amount, customer, items, reject_reason: String(e?.message || e),
    }).select('id').single()
    return json({ error: 'gateway_error', document_id: doc?.id, detail: String(e?.message || e) }, 502)
  }
})
