// Etiquetas & impressão — sem dependências externas.
// - barcodeSvg(): gera CODE128 (B) como SVG (cobre SKU/EAN alfanumérico).
// - printProductLabels(): folha de etiquetas de produto (nome, preço, SKU, código de barras).
// - printThermalReceipt(): cupom em layout térmico 58/80mm.
// Tudo imprime via janela do navegador (Salvar como PDF ou mandar para a impressora térmica).

const escHtml = (v) => (v == null ? '' : String(v)).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const brl = (n) => `R$ ${(Number(n) || 0).toFixed(2).replace('.', ',')}`

// ---------- CODE128-B ----------
// Tabela de larguras dos 107 padrões do Code128 (cada string = larguras de barras/espaços).
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]
const START_B = 104, STOP = 106

// Gera SVG do código de barras CODE128-B para o texto dado.
export function barcodeSvg(text, { height = 44, moduleWidth = 1.6, showText = true } = {}) {
  const value = String(text || '').replace(/[^\x20-\x7F]/g, '') || ' '
  const codes = [START_B]
  let checksum = START_B
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i) - 32 // Code B: ASCII 32..127 -> 0..95
    const c = code < 0 || code > 95 ? 0 : code
    codes.push(c); checksum += c * (i + 1)
  }
  codes.push(checksum % 103)
  codes.push(STOP)

  let x = 0
  const rects = []
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code]
    for (let i = 0; i < pattern.length; i++) {
      const w = parseInt(pattern[i], 10) * moduleWidth
      if (i % 2 === 0) rects.push(`<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}" />`) // barra (par = preto)
      x += w
    }
  }
  const totalW = x
  const textH = showText ? 14 : 0
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW.toFixed(1)}" height="${height + textH}" viewBox="0 0 ${totalW.toFixed(1)} ${height + textH}">
    <g fill="#000">${rects.join('')}</g>
    ${showText ? `<text x="${(totalW / 2).toFixed(1)}" y="${height + 11}" font-family="monospace" font-size="11" text-anchor="middle" fill="#000">${escHtml(value)}</text>` : ''}
  </svg>`
}

// abre uma janela e imprime o HTML
function printHtml(html) {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open(); w.document.write(html); w.document.close()
  return true
}

// ---------- MODELOS DE ETIQUETA (inspirado em fluxos de logística) ----------
// Cada modelo define tamanho, densidade (grade/individual) e o que mostra.
// page: 'a4' (grade em folha A4) | 'roll' (etiquetadora térmica, uma unidade por página).
export const LABEL_TEMPLATES = [
  { key: 'auto', group: 'Recomendado', name: 'Automático por uso', dim: '100 × 150 mm · individual', desc: 'Etiqueta completa para envio e etiqueta SKU para produtos na mesma impressão.', page: 'roll', w: 100, h: 150, cols: 1, showPrice: true, showName: true, bcHeight: 60, recommended: true },
  { key: 'a4_mixed', group: 'Lote', name: 'Folha econômica mista A4', dim: '86 × 54 mm · folha A4', desc: 'Distribui várias etiquetas por folha para economizar papel em separação, conferência e expedição.', page: 'a4', w: 86, h: 54, cols: 2, showPrice: true, showName: true, bcHeight: 40 },
  { key: 'sku_50x30', group: 'Produto', name: 'SKU estoque 50 × 30 mm', dim: '50 × 30 mm · individual', desc: 'Etiqueta compacta para colar em produtos, caixas internas e prateleiras.', page: 'roll', w: 50, h: 30, cols: 1, showPrice: false, showName: true, bcHeight: 26 },
  { key: 'sku_a4_3x8', group: 'Produto', name: 'SKU em folha A4 3×8', dim: '63 × 33 mm · folha A4', desc: 'Até 24 etiquetas compactas por folha para SKU, validade, lote e controle interno.', page: 'a4', w: 63, h: 33, cols: 3, showPrice: false, showName: true, bcHeight: 26 },
  { key: 'bc_60x40', group: 'Produto', name: 'Código de barras 60 × 40 mm', dim: '60 × 40 mm · individual', desc: 'Código de barras legível com nome curto e SKU.', page: 'roll', w: 60, h: 40, cols: 1, showPrice: true, showName: true, bcHeight: 34 },
  { key: 'bc_100x50', group: 'Produto', name: 'Código de barras grande 100 × 50 mm', dim: '100 × 50 mm · individual', desc: 'Modelo maior para caixas, kits, lotes e volumes de estoque.', page: 'roll', w: 100, h: 50, cols: 1, showPrice: true, showName: true, bcHeight: 44 },
  { key: 'bc_a4_2x7', group: 'Produto', name: 'Código de barras A4 2×7', dim: '95 × 38 mm · folha A4', desc: 'Até 14 etiquetas médias por folha, com leitura confortável para caixas e kits.', page: 'a4', w: 95, h: 38, cols: 2, showPrice: true, showName: true, bcHeight: 32 },
  { key: 'kit_80x50', group: 'Produto', name: 'Kit, combo ou lote 80 × 50 mm', dim: '80 × 50 mm · individual', desc: 'Etiqueta intermediária para identificação de kits, combos e separação interna.', page: 'roll', w: 80, h: 50, cols: 1, showPrice: true, showName: true, bcHeight: 40 },
]
export const LABEL_TEMPLATE_MAP = Object.fromEntries(LABEL_TEMPLATES.map((t) => [t.key, t]))

// HTML de UMA etiqueta (usado tanto na prévia quanto na impressão)
export function labelCellHtml(tpl, item, brand = '') {
  const code = item.barcode || item.sku || ''
  return `<div class="lbl" style="width:${tpl.w}mm;min-height:${tpl.h}mm">
    ${brand ? `<div class="brand">${escHtml(brand)}</div>` : ''}
    ${tpl.showName ? `<div class="lname">${escHtml(item.name || '')}</div>` : ''}
    ${tpl.showPrice ? `<div class="lprice">${brl(item.price)}</div>` : ''}
    <div class="bc">${code ? barcodeSvg(code, { height: tpl.bcHeight, moduleWidth: 1.3, showText: true }) : `<span class="nocode">${escHtml(item.sku || 'sem código')}</span>`}</div>
  </div>`
}

const LABEL_CSS = (tpl) => `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; }
  .grid { display: grid; grid-template-columns: repeat(${tpl.cols}, 1fr); gap: 3mm; }
  .lbl { border: 1px solid #ddd; border-radius: 4px; padding: 4px 6px; text-align: center; page-break-inside: avoid; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .brand { font-size: 8px; letter-spacing: 1px; text-transform: uppercase; color: #888; }
  .lname { font-size: 11px; font-weight: 600; line-height: 1.1; margin: 1px 0; max-height: 2.3em; overflow: hidden; }
  .lprice { font-size: 15px; font-weight: 700; margin: 1px 0; }
  .bc { margin-top: 2px; } .bc svg { max-width: 100%; height: auto; }
  .nocode { font-size: 10px; color: #666; font-family: monospace; }`

// items: [{ name, price, sku, barcode, qty }]. templateKey aponta para LABEL_TEMPLATES.
export function printProductLabels(items, { templateKey = 'bc_60x40', brand = '' } = {}) {
  const tpl = LABEL_TEMPLATE_MAP[templateKey] || LABEL_TEMPLATE_MAP.bc_60x40
  const labels = []
  ;(items || []).forEach((it) => { const n = Math.max(1, parseInt(it.qty) || 1); for (let k = 0; k < n; k++) labels.push(it) })
  if (!labels.length) return false
  const pageSize = tpl.page === 'a4' ? 'A4' : `${tpl.w}mm ${tpl.h}mm`
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas</title>
  <style>@page { size: ${pageSize}; margin: ${tpl.page === 'a4' ? '8mm' : '1mm'}; } ${LABEL_CSS(tpl)}
    ${tpl.page === 'roll' ? '.lbl{border:none;} .grid{gap:0;} body{width:' + tpl.w + 'mm;}' : ''}
  </style></head>
  <body><div class="grid">${labels.map((it) => labelCellHtml(tpl, it, brand)).join('')}</div>
  <script>window.onload=function(){window.focus();window.print();}</script></body></html>`
  return printHtml(html)
}

// ---------- Cupom térmico 58/80mm ----------
// receipt: { number, at(Date), items:[{qty,name,subtotal}], total, discount, payments:[{label,amount}], change, customer, notes, points, fiscal }
export function printThermalReceipt(receipt, { width = 80, tenantName = 'Seravie', pmLabel = {}, footer = 'Obrigado pela preferência!' } = {}) {
  if (!receipt) return false
  const mm = width === 58 ? 58 : 80
  const rows = (receipt.items || []).map((it) => `<tr><td>${it.qty}x ${escHtml(it.name)}</td><td class="r">${brl(it.subtotal)}</td></tr>`).join('')
  const pays = (receipt.payments || []).map((p) => `<tr><td>${escHtml(p.label || pmLabel[p.method] || p.method || 'Pagamento')}</td><td class="r">${brl(p.amount)}</td></tr>`).join('')
  const when = receipt.at ? new Date(receipt.at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cupom</title>
  <style>
    @page { size: ${mm}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: ${mm}mm; margin: 0; padding: 4mm 3mm; font-family: 'Courier New', monospace; font-size: 12px; color: #000; }
    .c { text-align: center; }
    .b { font-weight: 700; }
    .big { font-size: 15px; }
    hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; font-size: 12px; }
    td.r { text-align: right; white-space: nowrap; padding-left: 6px; }
    .small { font-size: 10px; }
  </style></head>
  <body>
    <div class="c b big">${escHtml(tenantName)}</div>
    <div class="c small">Cupom de venda</div>
    <hr>
    <div class="small">Venda #${escHtml(receipt.number)} · ${escHtml(when)}</div>
    ${receipt.customer ? `<div class="small">Cliente: ${escHtml(receipt.customer)}</div>` : ''}
    <hr>
    <table>${rows}</table>
    <hr>
    ${receipt.discount > 0 ? `<table><tr><td>Desconto</td><td class="r">- ${brl(receipt.discount)}</td></tr></table>` : ''}
    <table><tr><td class="b big">TOTAL</td><td class="r b big">${brl(receipt.total)}</td></tr></table>
    <table>${pays}</table>
    ${receipt.change > 0 ? `<table><tr><td>Troco</td><td class="r">${brl(receipt.change)}</td></tr></table>` : ''}
    ${receipt.notes ? `<hr><div class="small">Obs: ${escHtml(receipt.notes)}</div>` : ''}
    ${receipt.points > 0 ? `<div class="c small">★ ${receipt.points} pontos acumulados</div>` : ''}
    ${receipt.fiscal ? `<div class="c small">${receipt.fiscal.status === 'authorized' ? 'NFC-e autorizada' : 'NFC-e pendente'}</div>` : ''}
    <hr>
    <div class="c small">${escHtml(footer)}</div>
    <script>window.onload=function(){window.focus();window.print();}</script>
  </body></html>`
  return printHtml(html)
}
