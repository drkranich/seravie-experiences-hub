// Rótulos amigáveis para cabeçalhos de coluna (chave técnica -> título).
const HEADER_LABELS = {
  nome: 'Nome', email: 'E-mail', telefone: 'Telefone', tipo: 'Tipo', status: 'Status',
  ltv: 'LTV', data: 'Data', categoria: 'Categoria', descricao: 'Descrição', valor: 'Valor',
  forma: 'Forma', sku: 'SKU', codigo_barras: 'Cód. barras', preco: 'Preço', custo: 'Custo',
  estoque: 'Estoque',
}
const label = (k) => HEADER_LABELS[k] || (k.charAt(0).toUpperCase() + k.slice(1))
const escHtml = (v) => (v == null ? '' : String(v)).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// Exporta uma lista de objetos como CSV (UTF-8 com BOM, compatível com Excel).
export function exportCsv(filename, rows) {
  if (!rows || !rows.length) return false
  const headers = Object.keys(rows[0])
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(';'), ...rows.map((r) => headers.map((h) => esc(r[h])).join(';'))].join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

// Exporta uma lista de objetos como PDF via impressão do navegador (sem dependências).
// Abre uma janela com uma tabela estilizada e dispara o diálogo de impressão (Salvar como PDF).
export function exportPdf(title, rows, subtitle) {
  if (!rows || !rows.length) return false
  const headers = Object.keys(rows[0])
  const thead = headers.map((h) => `<th>${escHtml(label(h))}</th>`).join('')
  const tbody = rows
    .map((r) => `<tr>${headers.map((h) => `<td>${escHtml(r[h])}</td>`).join('')}</tr>`)
    .join('')
  const when = new Date().toLocaleString('pt-BR')
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escHtml(title)}</title>
<style>
  @page { margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #1c1c1c; margin: 0; padding: 24px; }
  .brand { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #b08d57; font-weight: 600; }
  h1 { font-size: 22px; margin: 4px 0 2px; font-weight: 600; }
  .meta { font-size: 11px; color: #888; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { text-align: left; background: #f4efe7; color: #6b5b3e; padding: 8px 10px; border-bottom: 2px solid #d8cbb2; text-transform: uppercase; letter-spacing: .5px; font-size: 10px; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #ececec; }
  tbody tr:nth-child(even) { background: #fafaf7; }
  .foot { margin-top: 16px; font-size: 10px; color: #aaa; }
</style></head>
<body>
  <div class="brand">SERAVIE EXPERIENCES</div>
  <h1>${escHtml(title)}</h1>
  <div class="meta">${subtitle ? escHtml(subtitle) + ' · ' : ''}${rows.length} registro(s) · Gerado em ${escHtml(when)}</div>
  <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
  <div class="foot">SERAVIE EXPERIENCES — Experience Operating System</div>
  <script>window.onload = function () { window.focus(); window.print(); }</script>
</body></html>`
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  return true
}
