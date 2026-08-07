// pdvReport.js — gerador de relatório de vendas do PDV em PDF (via impressão).
import { brl, methodLabel } from './pdvLib'

const esc = (v) => (v == null ? '' : String(v)).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Recebe as vendas já filtradas + um resumo do filtro aplicado e abre o PDF.
export function printSalesReport(sales, { rangeLabel = '', operator = '', method = '', tenantName = 'Seravie Experiences' } = {}) {
  const paid = sales.filter((s) => s.status !== 'void')
  const voided = sales.filter((s) => s.status === 'void')
  const total = paid.reduce((s, r) => s + Number(r.total), 0)
  const ticket = paid.length ? total / paid.length : 0

  const byMethod = {}, byOp = {}, byDay = {}
  paid.forEach((r) => {
    (r.payments || []).forEach((p) => { byMethod[p.method] = (byMethod[p.method] || 0) + Number(p.amount) })
    const op = r.operator || 'Sem operador'; byOp[op] = byOp[op] || { n: 0, v: 0 }; byOp[op].n++; byOp[op].v += Number(r.total)
    const d = new Date(r.created_at).toLocaleDateString('pt-BR'); byDay[d] = (byDay[d] || 0) + Number(r.total)
  })

  const filters = [rangeLabel && `Período: ${rangeLabel}`, operator && `Operador: ${operator}`, method && `Pagamento: ${methodLabel(method)}`].filter(Boolean).join(' · ') || 'Todos os registros'
  const when = new Date().toLocaleString('pt-BR')

  const rowsHtml = paid.map((r) => `<tr>
    <td>#${esc(r.number)}</td>
    <td>${esc(new Date(r.created_at).toLocaleString('pt-BR'))}</td>
    <td>${esc(r.operator || '—')}</td>
    <td>${esc((r.items || []).map((i) => `${i.qty}× ${i.name}`).join(', '))}</td>
    <td>${esc((r.payments || []).map((p) => methodLabel(p.method)).join(', '))}</td>
    <td style="text-align:right">${brl(r.total)}</td>
  </tr>`).join('')

  const summaryBlock = (title, entries) => `
    <div class="card"><h3>${title}</h3><table class="mini">${entries.map(([k, v]) => `<tr><td>${esc(k)}</td><td style="text-align:right">${typeof v === 'number' ? brl(v) : esc(v)}</td></tr>`).join('')}</table></div>`

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de vendas · PDV</title>
  <style>
    @page { margin: 16mm 14mm; }
    * { box-sizing:border-box; }
    body { font-family:'Segoe UI',Helvetica,Arial,sans-serif; color:#1c1c1c; margin:0; padding:22px; }
    .brand { font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#b08d57; font-weight:600; }
    h1 { font-size:22px; margin:4px 0 2px; }
    .meta { font-size:11px; color:#888; margin-bottom:16px; }
    .kpis { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
    .kpi { flex:1; min-width:120px; background:#f7f4ee; border:1px solid #e6dcc4; border-radius:10px; padding:10px 12px; }
    .kpi .l { font-size:9px; text-transform:uppercase; letter-spacing:.5px; color:#a08a5e; }
    .kpi .v { font-size:19px; font-weight:600; color:#3a3226; }
    .cards { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
    .card { flex:1; min-width:180px; border:1px solid #ececec; border-radius:10px; padding:10px 12px; }
    .card h3 { font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:#6b5b3e; margin:0 0 6px; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    table.mini td { padding:3px 0; border-bottom:1px solid #f0f0f0; }
    thead th { text-align:left; background:#f4efe7; color:#6b5b3e; padding:7px 8px; border-bottom:2px solid #d8cbb2; text-transform:uppercase; font-size:9px; letter-spacing:.4px; }
    tbody td { padding:6px 8px; border-bottom:1px solid #eee; vertical-align:top; }
    tbody tr:nth-child(even){ background:#fafaf7; }
    .foot { margin-top:16px; font-size:10px; color:#aaa; }
  </style></head><body>
    <div class="brand">${esc(tenantName)} · SERAVIE CUISINE</div>
    <h1>Relatório de vendas — PDV</h1>
    <div class="meta">${esc(filters)} · Gerado em ${esc(when)}</div>
    <div class="kpis">
      <div class="kpi"><div class="l">Vendas</div><div class="v">${paid.length}</div></div>
      <div class="kpi"><div class="l">Faturamento</div><div class="v">${brl(total)}</div></div>
      <div class="kpi"><div class="l">Ticket médio</div><div class="v">${brl(ticket)}</div></div>
      <div class="kpi"><div class="l">Canceladas</div><div class="v">${voided.length}</div></div>
    </div>
    <div class="cards">
      ${summaryBlock('Por forma de pagamento', Object.entries(byMethod).map(([m, v]) => [methodLabel(m), v]))}
      ${summaryBlock('Por operador', Object.entries(byOp).sort((a, b) => b[1].v - a[1].v).map(([o, x]) => [`${o} (${x.n})`, x.v]))}
      ${summaryBlock('Por dia', Object.entries(byDay).map(([d, v]) => [d, v]))}
    </div>
    <table>
      <thead><tr><th>Nº</th><th>Data/hora</th><th>Operador</th><th>Itens</th><th>Pagamento</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px">Nenhuma venda no filtro.</td></tr>'}</tbody>
    </table>
    <div class="foot">SERAVIE EXPERIENCES — Experience Operating System · relatório gerado pelo Seravie Cuisine (PDV)</div>
    <script>window.onload=function(){window.focus();window.print()}</script>
  </body></html>`
  const w = window.open('', '_blank'); if (!w) return false
  w.document.open(); w.document.write(html); w.document.close(); return true
}
