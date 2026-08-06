// employeePdf.js — ficha do colaborador em PDF (via impressão do navegador,
// sem dependências) e compartilhamento (Web Share API com fallback).
//
// A ficha usa a mesma identidade visual dos relatórios (export.js): faixa
// champagne "SERAVIE EXPERIENCES", tipografia serifada no nome e blocos
// rotulados. Abre uma janela e dispara o diálogo de impressão (Salvar como PDF).

const escHtml = (v) => (v == null ? '' : String(v))
  .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const STATUS_LABEL = { active: 'Ativo', inactive: 'Inativo', vacation: 'Férias', terminated: 'Desligado' }
const CONTRACT_LABEL = { clt: 'CLT', pj: 'PJ', estagio: 'Estágio', temporario: 'Temporário', freelancer: 'Freelancer', socio: 'Sócio' }
const GENDER_LABEL = { female: 'Feminino', male: 'Masculino', other: 'Outro' }

const brl = (n) => (n == null || n === '' ? '' : `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const fmtDate = (d) => {
  if (!d) return ''
  const [y, m, day] = String(d).slice(0, 10).split('-')
  return y && m && day ? `${day}/${m}/${y}` : String(d)
}

// Monta os blocos (seções) da ficha a partir do colaborador.
function buildSections(e) {
  const item = (label, value) => (value == null || value === '' ? '' : { label, value })
  return [
    ['Dados pessoais', [
      item('Nome completo', e.name),
      item('CPF / CNPJ', e.document),
      item('RG / Identidade', e.rg),
      item('Data de nascimento', fmtDate(e.birth_date)),
      item('Gênero', GENDER_LABEL[e.gender] || e.gender),
    ]],
    ['Função', [
      item('Cargo', e.role),
      item('Setor / Categoria', e.department),
      item('Status', STATUS_LABEL[e.status] || e.status),
      item('Acesso ao sistema', e.has_system_access ? 'Sim' : 'Não'),
    ]],
    ['Contato & Endereço', [
      item('E-mail', e.email),
      item('Telefone', e.phone),
      item('Endereço', e.address),
      item('Cidade', e.city),
      item('UF', e.state),
      item('CEP', e.postal_code),
    ]],
    ['Contato de emergência', [
      item('Nome', e.emergency_name),
      item('Telefone', e.emergency_phone),
    ]],
    ['Contrato & Pagamento', [
      item('Tipo de contrato', CONTRACT_LABEL[e.contract_type] || e.contract_type),
      item('Admissão', fmtDate(e.hire_date)),
      item('Remuneração', brl(e.salary)),
      item('Chave PIX', e.pix_key),
      item('Dados bancários', e.bank_info),
    ]],
  ].map(([title, items]) => [title, items.filter(Boolean)]).filter(([, items]) => items.length)
}

// Gera o HTML da ficha (usado tanto para imprimir quanto para o texto do share).
export function fichaHtml(e, tenantName = 'Seravie Experiences') {
  const sections = buildSections(e)
  const when = new Date().toLocaleString('pt-BR')
  const avatar = e.avatar_url
    ? `<img class="avatar" src="${escHtml(e.avatar_url)}" alt="" />`
    : `<div class="avatar avatar--ph">${escHtml((e.name || '?')[0]?.toUpperCase() || '?')}</div>`
  const blocks = sections.map(([title, items]) => `
    <section class="block">
      <h2>${escHtml(title)}</h2>
      <div class="grid">
        ${items.map((it) => `<div class="cell"><span class="k">${escHtml(it.label)}</span><span class="v">${escHtml(it.value)}</span></div>`).join('')}
      </div>
    </section>`).join('')
  const notes = e.notes ? `<section class="block"><h2>Observações</h2><p class="notes">${escHtml(e.notes)}</p></section>` : ''

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ficha — ${escHtml(e.name || 'Colaborador')}</title>
<style>
  @page { margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #1c1c1c; margin: 0; padding: 26px; }
  .brand { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #b08d57; font-weight: 600; }
  .head { display: flex; align-items: center; gap: 18px; border-bottom: 2px solid #d8cbb2; padding-bottom: 16px; margin-bottom: 20px; }
  .avatar { width: 74px; height: 74px; border-radius: 50%; object-fit: cover; border: 2px solid #e6dcc4; }
  .avatar--ph { display: flex; align-items: center; justify-content: center; background: #f4efe7; color: #b08d57; font-size: 30px; font-weight: 600; }
  h1 { font-size: 24px; margin: 2px 0 2px; font-weight: 600; }
  .sub { font-size: 12px; color: #888; }
  .block { margin-bottom: 16px; break-inside: avoid; }
  .block h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b5b3e; border-bottom: 1px solid #ececec; padding-bottom: 4px; margin: 0 0 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
  .cell { display: flex; flex-direction: column; padding: 3px 0; }
  .k { font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #a99; color: #aaa; }
  .v { font-size: 13px; color: #1c1c1c; }
  .notes { font-size: 13px; white-space: pre-wrap; color: #333; }
  .foot { margin-top: 20px; font-size: 10px; color: #aaa; border-top: 1px solid #ececec; padding-top: 10px; }
</style></head>
<body>
  <div class="brand">${escHtml(tenantName)}</div>
  <div class="head">
    ${avatar}
    <div>
      <h1>${escHtml(e.name || 'Colaborador')}</h1>
      <div class="sub">${escHtml([e.role, e.department].filter(Boolean).join(' · ') || 'Ficha do colaborador')}</div>
    </div>
  </div>
  ${blocks}
  ${notes}
  <div class="foot">Ficha gerada em ${escHtml(when)} · SERAVIE EXPERIENCES — Experience Operating System</div>
  <script>window.onload = function () { window.focus(); window.print(); }</script>
</body></html>`
}

// Abre a ficha em uma nova janela e dispara a impressão (Salvar como PDF).
export function printFicha(e, tenantName) {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open()
  w.document.write(fichaHtml(e, tenantName))
  w.document.close()
  return true
}

// Resumo em texto puro da ficha (para compartilhar / copiar).
export function fichaText(e) {
  const line = (label, value) => (value == null || value === '' ? null : `${label}: ${value}`)
  const parts = [
    `📋 Ficha — ${e.name || 'Colaborador'}`,
    line('Cargo', e.role),
    line('Setor', e.department),
    line('Status', STATUS_LABEL[e.status] || e.status),
    line('E-mail', e.email),
    line('Telefone', e.phone),
    line('CPF/CNPJ', e.document),
    line('Admissão', fmtDate(e.hire_date)),
    line('Contrato', CONTRACT_LABEL[e.contract_type] || e.contract_type),
  ].filter(Boolean)
  return parts.join('\n')
}

// Compartilha a ficha do colaborador. Usa a Web Share API quando disponível
// (celular abre WhatsApp, e-mail, etc.); senão copia o resumo para a área de
// transferência. Retorna 'shared' | 'copied' | 'error'.
export async function shareFicha(e) {
  const text = fichaText(e)
  const title = `Ficha — ${e.name || 'Colaborador'}`
  try {
    if (navigator.share) {
      await navigator.share({ title, text })
      return 'shared'
    }
  } catch (err) {
    // usuário cancelou o compartilhamento nativo: não trata como erro
    if (err && err.name === 'AbortError') return 'shared'
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return 'copied'
    }
  } catch { /* noop */ }
  return 'error'
}
