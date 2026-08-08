import { Icon } from '../ui'
import { brl } from '../../../lib/suppliersMarket'

// Comprovante de compra — mostrado após o checkout. Um comprovante por
// fornecedor, com dados do fornecedor, itens, frete, comissão e totais.
// Botão "Imprimir / Salvar PDF" usa a impressão do navegador (window.print).

export function OrderReceipt({ orders, settings, onClose }) {
  const list = Array.isArray(orders) ? orders : [orders]
  const fmt = (d) => { try { return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

  const doPrint = () => {
    const html = list.map((o) => receiptHTML(o)).join('<div style="page-break-after:always"></div>')
    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Comprovante de compra</title>
      <style>
        body{font-family:Georgia,'Times New Roman',serif;color:#1c1c1c;margin:0;padding:32px;background:#fff}
        .r{max-width:620px;margin:0 auto 40px}
        .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #b08d57;padding-bottom:12px;margin-bottom:16px}
        .brand{font-size:20px;color:#b08d57;font-weight:bold}
        .muted{color:#777;font-size:12px}
        table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
        th{text-align:left;color:#999;font-weight:normal;font-size:11px;text-transform:uppercase;border-bottom:1px solid #ddd;padding:6px 4px}
        td{padding:6px 4px;border-bottom:1px solid #f0f0f0}
        .tot{display:flex;justify-content:space-between;font-size:13px;padding:3px 0}
        .grand{font-size:16px;font-weight:bold;color:#b08d57;border-top:2px solid #b08d57;padding-top:8px;margin-top:6px}
        .sec{font-size:11px;text-transform:uppercase;color:#b08d57;letter-spacing:.05em;margin:16px 0 4px}
        .fee{color:#999;font-size:11px}
      </style></head><body>${html}</body></html>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300)
  }

  function receiptHTML(o) {
    const snap = o.supplier_snapshot || {}
    const items = (o.items || []).map((it) => `<tr><td>${it.name}</td><td style="text-align:center">${it.qty}</td><td style="text-align:right">${brl(it.unit_price)}</td><td style="text-align:right">${brl((Number(it.qty) || 0) * (Number(it.unit_price) || 0))}</td></tr>`).join('')
    return `<div class="r">
      <div class="hd"><div><div class="brand">Seravie Experiences</div><div class="muted">Comprovante de compra</div></div><div style="text-align:right"><div style="font-weight:bold">${o.code || ''}</div><div class="muted">${fmt(o.created_at || Date.now())}</div></div></div>
      <div class="sec">Fornecedor</div>
      <div style="font-size:14px;font-weight:bold">${o.supplier_name || snap.name || 'Fornecedor'}</div>
      <div class="muted">${[snap.address, snap.city, snap.state].filter(Boolean).join(' · ')}${snap.cep ? ' · CEP ' + snap.cep : ''}</div>
      <div class="muted">${[snap.whatsapp || snap.phone, snap.email].filter(Boolean).join(' · ')}${snap.lead_time ? ' · Prazo: ' + snap.lead_time : ''}</div>
      <div class="sec">Comprador / Entrega</div>
      <div style="font-size:13px">${o.buyer_name || ''}</div>
      <div class="muted">${o.delivery_address || ''}${o.buyer_contact ? ' · ' + o.buyer_contact : ''}</div>
      <div class="muted">Pagamento: ${o.payment_method || '—'}</div>
      <table><thead><tr><th>Item</th><th style="text-align:center">Qtd</th><th style="text-align:right">Unit.</th><th style="text-align:right">Total</th></tr></thead><tbody>${items}</tbody></table>
      <div class="tot"><span>Subtotal</span><span>${brl(o.subtotal)}</span></div>
      ${o.shipping ? `<div class="tot"><span>Frete</span><span>${brl(o.shipping)}</span></div>` : ''}
      <div class="tot grand"><span>Total</span><span>${brl(o.total)}</span></div>
      ${o.commission_percent ? `<div class="tot fee"><span>Comissão Seravie (${o.commission_percent}%) — retida do fornecedor</span><span>${brl(o.commission_amount)}</span></div>` : ''}
      <div class="muted" style="margin-top:20px;text-align:center">Gerado pela plataforma Seravie Experiences · ${fmt(Date.now())}</div>
    </div>`
  }

  const grand = list.reduce((s, o) => s + (Number(o.total) || 0), 0)

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 pb-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-full bg-admin-sage/15 flex items-center justify-center"><Icon name="check" className="w-5 h-5 text-admin-sage" /></div><div><h2 className="font-serif text-xl text-admin-text">Compra concluída</h2><p className="text-admin-muted/50 text-xs">{list.length} pedido(s) enviado(s) · {brl(grand)}</p></div></div>
          <button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {list.map((o) => { const snap = o.supplier_snapshot || {}; return (
            <div key={o.id} className="glass-soft rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2"><span className="text-admin-champ/70 text-xs">{o.code}</span><span className="text-[10px] px-2 py-0.5 rounded-lg bg-admin-champ/15 text-admin-champ">Enviado</span></div>
              <p className="text-admin-text text-sm font-medium">{o.supplier_name}</p>
              {snap && <p className="text-admin-muted/45 text-[11px]">{[snap.whatsapp || snap.phone, snap.email].filter(Boolean).join(' · ')}{snap.lead_time ? ` · prazo ${snap.lead_time}` : ''}</p>}
              <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1 text-sm">
                <div className="flex justify-between text-admin-muted/55"><span>Subtotal</span><span>{brl(o.subtotal)}</span></div>
                {o.shipping ? <div className="flex justify-between text-admin-muted/55"><span>Frete</span><span>{brl(o.shipping)}</span></div> : null}
                <div className="flex justify-between text-admin-text"><span>Total</span><span className="text-admin-champ">{brl(o.total)}</span></div>
                {o.commission_percent ? <div className="flex justify-between text-admin-muted/35 text-[11px]"><span>Comissão ({o.commission_percent}%)</span><span>{brl(o.commission_amount)}</span></div> : null}
              </div>
            </div>
          )})}
        </div>
        <div className="p-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
          <p className="text-admin-muted/40 text-[11px]">Acompanhe em Compras.</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Fechar</button>
            <button onClick={doPrint} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ flex items-center gap-2"><Icon name="download" className="w-4 h-4" />Comprovante (PDF)</button>
          </div>
        </div>
      </div>
    </div>
  )
}
