// pdvLib.js — utilitários do PDV do KDS (dinheiro, formas de pagamento, recibo).
import { supabase } from '../../../../lib/supabase'

export const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const num = (v) => { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? (Number(v) || 0) : (String(v).includes(',') ? n : Number(v) || 0) }
export const money = (n) => Math.round((Number(n) || 0) * 100) / 100

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Dinheiro', icon: 'cart' },
  { value: 'credit', label: 'Crédito', icon: 'tag' },
  { value: 'debit', label: 'Débito', icon: 'tag' },
  { value: 'pix', label: 'PIX', icon: 'bolt' },
  { value: 'voucher', label: 'Voucher', icon: 'gift' },
]
export const methodLabel = (m) => (PAYMENT_METHODS.find((x) => x.value === m)?.label || m)

// Recibo imprimível (mesma identidade dos relatórios Seravie).
export function printReceipt(sale, tenantName = 'Seravie Experiences') {
  const esc = (v) => (v == null ? '' : String(v)).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const when = new Date(sale.created_at || Date.now()).toLocaleString('pt-BR')
  const lines = (sale.items || []).map((it) => `<tr><td>${it.qty || 1}×</td><td>${esc(it.name)}</td><td style="text-align:right">${brl((it.price || 0) * (it.qty || 1))}</td></tr>`).join('')
  const pays = (sale.payments || []).map((p) => `<tr><td colspan="2">${esc(methodLabel(p.method))}</td><td style="text-align:right">${brl(p.amount)}</td></tr>`).join('')
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comprovante ${esc(sale.number || '')}</title>
  <style>
    @page { margin: 8mm; size: 80mm auto; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color:#111; width: 72mm; margin:0 auto; padding: 6px; font-size: 12px; }
    .brand { text-align:center; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#b08d57; font-weight:600; }
    h1 { text-align:center; font-size:15px; margin:4px 0; }
    .meta { text-align:center; font-size:10px; color:#666; margin-bottom:8px; }
    table { width:100%; border-collapse:collapse; }
    td { padding:2px 0; vertical-align:top; }
    .tot td { border-top:1px dashed #bbb; padding-top:4px; font-weight:600; }
    .foot { text-align:center; font-size:9px; color:#999; margin-top:10px; }
  </style></head><body>
    <div class="brand">${esc(tenantName)}</div>
    <h1>Comprovante de venda</h1>
    <div class="meta">Nº ${esc(sale.number || '—')} · ${esc(when)}${sale.operator ? ' · ' + esc(sale.operator) : ''}${sale.table_label ? ' · ' + esc(sale.table_label) : ''}</div>
    <table>${lines}</table>
    <table style="margin-top:6px">
      <tr><td colspan="2">Subtotal</td><td style="text-align:right">${brl(sale.subtotal)}</td></tr>
      ${sale.discount ? `<tr><td colspan="2">Desconto</td><td style="text-align:right">- ${brl(sale.discount)}</td></tr>` : ''}
      ${sale.tip ? `<tr><td colspan="2">Gorjeta</td><td style="text-align:right">${brl(sale.tip)}</td></tr>` : ''}
      <tr class="tot"><td colspan="2">TOTAL</td><td style="text-align:right">${brl(sale.total)}</td></tr>
      ${pays}
      ${sale.change ? `<tr><td colspan="2">Troco</td><td style="text-align:right">${brl(sale.change)}</td></tr>` : ''}
    </table>
    <div class="foot">Obrigado pela preferência · SERAVIE EXPERIENCES</div>
    <script>window.onload=function(){window.focus();window.print()}</script>
  </body></html>`
  const w = window.open('', '_blank'); if (!w) return false
  w.document.open(); w.document.write(html); w.document.close(); return true
}

// Cria a venda: grava kds_sales, movimenta o caixa, (opcional) abre ticket na cozinha
// e baixa estoque do cardápio. Retorna a venda criada (com número).
export async function commitSale({ tenantId, session, cart, discount, tip, payments, sendToKitchen, operator, customer, tableLabel, kind = 'kitchen' }) {
  const items = cart.map((c) => ({ menu_id: c.id, name: c.name, qty: c.qty, price: money(c.price), notes: c.notes || undefined }))
  const subtotal = money(items.reduce((s, it) => s + it.price * it.qty, 0))
  const total = money(subtotal - money(discount) + money(tip))
  const paid = money(payments.reduce((s, p) => s + money(p.amount), 0))
  const change = money(Math.max(0, paid - total))

  const { data: numRow } = await supabase.rpc('kds_next_sale_number', { p_tenant: tenantId })
  const number = numRow || null

  let ticketId = null
  if (sendToKitchen) {
    const { data: tk } = await supabase.from('kds_tickets').insert({
      tenant_id: tenantId, source: 'pdv', channel: 'pdv', reference: number ? `#${number}` : null,
      table_label: tableLabel || null, customer_name: customer || null, assignee: operator || null,
      items: items.map((it) => ({ name: it.name, qty: it.qty, notes: it.notes })),
      status: 'queued', priority: 0, sla_seconds: 900, order_total: total, kind, stage_updated_at: new Date().toISOString(),
    }).select('id').single()
    ticketId = tk?.id || null
  }

  const { data: sale, error } = await supabase.from('kds_sales').insert({
    tenant_id: tenantId, session_id: session?.id || null, ticket_id: ticketId, number, operator: operator || null,
    customer_name: customer || null, table_label: tableLabel || null, items, subtotal, discount: money(discount),
    tip: money(tip), total, payments, paid, change, send_to_kitchen: !!sendToKitchen, status: 'paid', kind,
  }).select('*').single()
  if (error) return { error: error.message }

  // movimenta o caixa (cada forma de pagamento vira uma entrada)
  if (session?.id) {
    for (const p of payments) {
      await supabase.from('cash_movements').insert({
        tenant_id: tenantId, session_id: session.id, type: 'sale', amount: money(p.amount),
        payment_method: p.method, description: `Venda ${number ? '#' + number : ''}`, reference_id: sale.id,
      })
    }
  }

  // baixa de estoque no cardápio (quando controlado)
  for (const c of cart) {
    if (c.stock != null) {
      const next = Math.max(0, c.stock - c.qty)
      await supabase.from('kds_menu').update({ stock: next }).eq('id', c.id)
    }
  }

  return { sale }
}
