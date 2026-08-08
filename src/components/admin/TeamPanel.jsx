import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate, AddressAutocomplete } from './ui'
import { FlowImageField } from './FlowImageField'
import { AttachButton, PendingAttachments, AttachmentList } from './AttachmentField'
import { exportCsv } from '../../lib/export'
import { parseCsvLower } from '../../lib/csv'
import { printFicha, shareFicha } from '../../lib/employeePdf'

const STATUS = { active: ['Ativo', 'text-admin-sage bg-admin-sage/10'], inactive: ['Inativo', 'text-admin-muted/40 bg-white/[0.04]'], vacation: ['Férias', 'text-admin-gold bg-admin-gold/10'], terminated: ['Desligado', 'text-admin-rose bg-admin-rose/10'] }
// Setores/categorias padrão (o usuário pode digitar outro livremente)
const DEPARTMENTS = ['Atendimento', 'Vendas', 'Financeiro', 'Marketing', 'Operações', 'Produção', 'Logística', 'Suporte', 'Administrativo', 'Gerência', 'RH', 'TI']
const CONTRACT = { clt: 'CLT', pj: 'PJ', estagio: 'Estágio', temporario: 'Temporário', freelancer: 'Freelancer', socio: 'Sócio' }
const GENDER = { '': '— não informar —', female: 'Feminino', male: 'Masculino', other: 'Outro' }
const emptyForm = () => ({
  name: '', role: '', department: '', email: '', phone: '', birth_date: '', hire_date: '', status: 'active',
  avatar_url: '', document: '', rg: '', gender: '', address: '', city: '', state: '', postal_code: '',
  emergency_name: '', emergency_phone: '', contract_type: '', salary: '', pix_key: '', bank_info: '',
  registration_file: '', documents: [], has_system_access: false, notes: '',
})

// Colunas da planilha-modelo Seravie (ordem fixa)
const TEMPLATE_COLS = ['nome', 'setor', 'cargo', 'email', 'telefone', 'aniversario', 'admissao', 'status']

// Cabeçalho de seção do formulário
function Section({ title }) {
  return <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2 mt-1 pb-1 border-b border-white/[0.06]">{title}</p>
}

export function TeamPanel({ notify }) {
  const { profile, canEdit } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('team') : true
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)      // { form, editingId }
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState([])
  const [teamSheet, setTeamSheet] = useState('') // planilha geral da equipe (arquivo único)
  const [units, setUnits] = useState([]) // unidades da rede (para vincular o colaborador)
  const [tenantName, setTenantName] = useState('Seravie Experiences')
  const fileRef = useRef(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('employees').select('*').order('name')
    setEmployees(data || [])
    const { data: us } = await supabase.from('units').select('id, name').order('name')
    setUnits(us || [])
    // planilha geral + nome ficam no tenant
    const { data: t } = await supabase.from('tenants').select('name, settings').eq('id', tenantId).maybeSingle()
    setTeamSheet(t?.settings?.team_sheet_url || '')
    if (t?.name) setTenantName(t.name)
    setLoading(false)
  }

  // Ficha do colaborador: PDF (impressão) e Compartilhar (Web Share / copiar)
  const onShare = async (e) => {
    const r = await shareFicha(e)
    if (r === 'copied') notify('Resumo da ficha copiado', 'success')
    else if (r === 'error') notify('Não foi possível compartilhar', 'error')
  }
  const onPdf = (e) => { if (!printFicha(e, tenantName)) notify('Permita pop-ups para gerar o PDF', 'error') }
  useEffect(() => { if (tenantId) load() }, [tenantId])

  const openNew = () => setModal({ form: emptyForm(), editingId: null })
  const openEdit = (e) => setModal({ form: { ...emptyForm(), ...e }, editingId: e.id })
  const setF = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }))

  const save = async () => {
    const f = modal.form
    if (!f.name?.trim()) return notify('Nome obrigatório', 'error')
    const payload = {
      name: f.name, role: f.role || null, department: f.department || null, email: f.email || null, phone: f.phone || null,
      birth_date: f.birth_date || null, hire_date: f.hire_date || null, status: f.status || 'active',
      avatar_url: f.avatar_url || null, document: f.document || null, rg: f.rg || null, gender: f.gender || null,
      address: f.address || null, city: f.city || null, state: f.state || null, postal_code: f.postal_code || null,
      emergency_name: f.emergency_name || null, emergency_phone: f.emergency_phone || null,
      contract_type: f.contract_type || null, salary: f.salary !== '' && f.salary != null ? Number(f.salary) : null,
      pix_key: f.pix_key || null, bank_info: f.bank_info || null,
      registration_file: f.registration_file || null, documents: Array.isArray(f.documents) ? f.documents : [],
      has_system_access: !!f.has_system_access, notes: f.notes || null,
      unit_id: f.unit_id || null,
    }
    const { error } = modal.editingId
      ? await supabase.from('employees').update(payload).eq('id', modal.editingId)
      : await supabase.from('employees').insert({ ...payload, tenant_id: tenantId })
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    notify(modal.editingId ? 'Colaborador atualizado' : 'Colaborador cadastrado', 'success'); setModal(null); load()
  }
  const remove = async (e) => { if (!confirm(`Remover ${e.name}?`)) return; await supabase.from('employees').delete().eq('id', e.id); notify('Removido', 'success'); load() }

  // --- Planilha-modelo ---
  const downloadTemplate = () => {
    exportCsv('modelo-equipe-seravie.csv', [
      { nome: 'Ex: Maria Silva', setor: 'Atendimento', cargo: 'Atendente', email: 'maria@empresa.com', telefone: '(11) 90000-0000', cpf: '000.000.000-00', aniversario: '1990-05-20', admissao: '2024-01-10', contrato: 'clt', status: 'active' },
    ])
    notify('Modelo baixado — preencha e importe', 'success')
  }
  const onImportFile = async (file) => {
    if (!file) return
    const text = await file.text()
    const rows = parseCsvLower(text)
    if (!rows.length) return notify('Planilha vazia ou inválida', 'error')
    setPreview(rows.slice(0, 200))
    setImportOpen(true)
  }
  const confirmImport = async () => {
    setImporting(true)
    const toInsert = preview.filter((r) => (r.nome || '').trim()).map((r) => ({
      tenant_id: tenantId, name: r.nome, department: r.setor || null, role: r.cargo || null,
      email: r.email || null, phone: r.telefone || null, document: r.cpf || r.documento || null,
      birth_date: r.aniversario || null, hire_date: r.admissao || null,
      contract_type: ['clt', 'pj', 'estagio', 'temporario', 'freelancer', 'socio'].includes((r.contrato || '').toLowerCase()) ? r.contrato.toLowerCase() : null,
      status: ['active', 'inactive', 'vacation', 'terminated'].includes((r.status || '').toLowerCase()) ? r.status.toLowerCase() : 'active',
    }))
    if (!toInsert.length) { setImporting(false); return notify('Nenhuma linha válida', 'error') }
    const { error } = await supabase.from('employees').insert(toInsert)
    setImporting(false)
    if (error) return notify('Erro ao importar: ' + error.message, 'error')
    notify(`${toInsert.length} colaborador(es) importado(s)`, 'success'); setImportOpen(false); setPreview([]); load()
  }

  // --- Planilha geral da equipe (arquivo único no tenant) ---
  const saveTeamSheet = async (url) => {
    setTeamSheet(url)
    const { data: t } = await supabase.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
    await supabase.from('tenants').update({ settings: { ...(t?.settings || {}), team_sheet_url: url } }).eq('id', tenantId)
    notify('Planilha da equipe salva', 'success')
  }

  const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5'
  const age = (bd) => { if (!bd) return null; const d = new Date(bd); const today = new Date(); const next = new Date(today.getFullYear(), d.getMonth(), d.getDate()); const days = Math.ceil((next - today) / 86400000); return days >= 0 && days <= 30 ? days : null }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="font-serif text-4xl text-admin-text">Equipe</h1><p className="text-admin-muted/60 text-sm mt-1">{employees.length} colaboradores · cadastro, setores e fichas</p></div>
        {mayEdit && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={downloadTemplate} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04]"><Icon name="upload" className="w-4 h-4" />Baixar modelo</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { onImportFile(e.target.files[0]); e.target.value = '' }} />
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04]"><Icon name="upload" className="w-4 h-4" />Importar planilha</button>
            <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Novo colaborador</button>
          </div>
        )}
      </div>

      {/* Planilha geral da equipe */}
      {mayEdit && (
        <div className="glass-soft rounded-xl px-4 py-3 mb-5 flex items-center gap-3 flex-wrap">
          <Icon name="book" className="w-4 h-4 text-admin-champ/70 shrink-0" />
          <p className="text-admin-muted/60 text-xs flex-1 min-w-[200px]">Ficha cadastral geral da equipe (planilha preenchida da Seravie). Anexe o arquivo consolidado aqui.</p>
          <div className="w-64"><FlowImageField label="" value={teamSheet} onChange={saveTeamSheet} folder="equipe" accept="any" hint="planilha/PDF da equipe toda" /></div>
        </div>
      )}

      {/* Grade de colaboradores */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading ? <p className="text-admin-muted/30 text-sm py-8 col-span-3 text-center">Carregando…</p>
          : employees.length === 0 ? <div className="glass rounded-2xl p-10 text-center col-span-3"><p className="text-admin-muted/40 text-sm">Nenhum colaborador. Cadastre manualmente ou importe a planilha.</p></div>
          : employees.map((e) => {
            const st = STATUS[e.status] || STATUS.active
            const bday = age(e.birth_date)
            return (
              <div key={e.id} className="glass rounded-xl p-4 group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-admin-champ/15 flex items-center justify-center shrink-0 overflow-hidden">{e.avatar_url ? <img src={e.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-admin-champ font-serif">{e.name[0]?.toUpperCase()}</span>}</div>
                  <div className="flex-1 min-w-0"><p className="text-admin-text text-sm font-medium truncate">{e.name}</p><p className="text-admin-muted/50 text-xs truncate">{e.role || '—'}</p></div>
                  {mayEdit && <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => openEdit(e)} className="p-1 text-admin-muted hover:text-admin-champ"><Icon name="pen" className="w-3.5 h-3.5" /></button><button onClick={() => remove(e)} className="p-1 text-admin-muted hover:text-admin-rose"><Icon name="x" className="w-3.5 h-3.5" /></button></div>}
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[10px]">
                  {e.department && <span className="px-2 py-0.5 rounded-lg bg-admin-champ/10 text-admin-champ/80">{e.department}</span>}
                  <span className={`px-2 py-0.5 rounded-lg ${st[1]}`}>{st[0]}</span>
                  {e.contract_type && <span className="px-2 py-0.5 rounded-lg bg-white/[0.05] text-admin-muted/60">{CONTRACT[e.contract_type] || e.contract_type}</span>}
                  {bday != null && <span className="px-2 py-0.5 rounded-lg bg-admin-gold/10 text-admin-gold">🎂 {bday === 0 ? 'hoje!' : `em ${bday}d`}</span>}
                  {e.has_system_access && <span className="px-2 py-0.5 rounded-lg bg-admin-sage/10 text-admin-sage" title="Tem acesso ao sistema">🔑 acesso</span>}
                </div>
                <div className="mt-2 space-y-0.5">
                  {e.email && <p className="text-admin-muted/50 text-[11px] truncate">{e.email}</p>}
                  <div className="flex gap-3 flex-wrap items-center">
                    {e.registration_file && <a href={e.registration_file} target="_blank" rel="noreferrer" className="text-admin-champ text-[11px] hover:underline">Ficha ↗</a>}
                    {Array.isArray(e.documents) && e.documents.length > 0 && <span className="text-admin-muted/40 text-[11px]">{e.documents.length} doc(s)</span>}
                  </div>
                </div>
                {/* Ações da ficha: PDF + Compartilhar */}
                <div className="flex gap-1.5 mt-3 pt-3 border-t border-white/[0.05]">
                  <button onClick={() => onPdf(e)} className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ transition-colors" title="Gerar ficha em PDF"><Icon name="download" className="w-3.5 h-3.5" />Ficha PDF</button>
                  <button onClick={() => onShare(e)} className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ transition-colors" title="Compartilhar ficha"><Icon name="share" className="w-3.5 h-3.5" />Compartilhar</button>
                </div>
              </div>
            )
          })
        }
      </div>

      {/* Modal cadastro/edição */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="glass-pop rounded-2xl p-7 w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{modal.editingId ? 'Editar colaborador' : 'Novo colaborador'}</h2><button onClick={() => setModal(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>

            {/* foto + nome */}
            <div className="flex gap-4 items-start mb-4">
              <div className="w-28 shrink-0"><FlowImageField label="Foto" value={modal.form.avatar_url} onChange={(url) => setF('avatar_url', url)} folder="equipe/fotos" accept="image" compact /></div>
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className={lbl}>Nome completo *</label><input value={modal.form.name} onChange={(e) => setF('name', e.target.value)} className={inputCls} /></div>
                <div><label className={lbl}>Setor / Categoria</label><GlassSelect value={modal.form.department} onChange={(v) => setF('department', v)} options={[{ value: '', label: '— selecione —' }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))]} /></div>
                <div><label className={lbl}>Cargo</label><input value={modal.form.role} onChange={(e) => setF('role', e.target.value)} className={inputCls} placeholder="Ex: Atendente" /></div>
                {units.length > 0 && (
                  <div className="col-span-2"><label className={lbl}>Unidade (loja)</label><GlassSelect value={modal.form.unit_id || ''} onChange={(v) => setF('unit_id', v)} options={[{ value: '', label: 'Toda a rede / sem unidade' }, ...units.map((u) => ({ value: u.id, label: u.name }))]} /></div>
                )}
              </div>
            </div>

            <Section title="Dados pessoais" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div><label className={lbl}>CPF / CNPJ</label><input value={modal.form.document} onChange={(e) => setF('document', e.target.value)} className={inputCls} /></div>
              <div><label className={lbl}>RG / Identidade</label><input value={modal.form.rg} onChange={(e) => setF('rg', e.target.value)} className={inputCls} /></div>
              <div><label className={lbl}>Data de aniversário</label><GlassDate value={modal.form.birth_date} onChange={(v) => setF('birth_date', v)} /></div>
              <div><label className={lbl}>Gênero</label><GlassSelect value={modal.form.gender} onChange={(v) => setF('gender', v)} options={Object.entries(GENDER).map(([value, label]) => ({ value, label }))} /></div>
            </div>

            <Section title="Contato & Endereço" />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className={lbl}>E-mail</label><input type="email" value={modal.form.email} onChange={(e) => setF('email', e.target.value)} className={inputCls} /></div>
              <div><label className={lbl}>Telefone</label><input value={modal.form.phone} onChange={(e) => setF('phone', e.target.value)} className={inputCls} /></div>
            </div>
            <div className="mb-4">
              <AddressAutocomplete
                value={{ cep: modal.form.postal_code, address: modal.form.address, city: modal.form.city, state: modal.form.state, neighborhood: modal.form.neighborhood, address_number: modal.form.address_number }}
                onChange={(a) => { setF('postal_code', a.cep || ''); setF('address', a.address || ''); setF('city', a.city || ''); setF('state', a.state || ''); setF('neighborhood', a.neighborhood || ''); setF('address_number', a.address_number || '') }}
                notify={notify}
              />
            </div>

            <Section title="Contato de emergência" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div><label className={lbl}>Nome</label><input value={modal.form.emergency_name} onChange={(e) => setF('emergency_name', e.target.value)} className={inputCls} /></div>
              <div><label className={lbl}>Telefone</label><input value={modal.form.emergency_phone} onChange={(e) => setF('emergency_phone', e.target.value)} className={inputCls} /></div>
            </div>

            <Section title="Contrato & Pagamento" />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div><label className={lbl}>Tipo de contrato</label><GlassSelect value={modal.form.contract_type} onChange={(v) => setF('contract_type', v)} options={[{ value: '', label: '— selecione —' }, ...Object.entries(CONTRACT).map(([value, label]) => ({ value, label }))]} /></div>
              <div><label className={lbl}>Data de admissão</label><GlassDate value={modal.form.hire_date} onChange={(v) => setF('hire_date', v)} /></div>
              <div><label className={lbl}>Remuneração (R$)</label><input type="number" value={modal.form.salary} onChange={(e) => setF('salary', e.target.value)} className={inputCls} placeholder="opcional" /></div>
              <div><label className={lbl}>Status</label><GlassSelect value={modal.form.status} onChange={(v) => setF('status', v)} options={Object.entries(STATUS).map(([value, x]) => ({ value, label: x[0] }))} /></div>
              <div><label className={lbl}>Chave PIX</label><input value={modal.form.pix_key} onChange={(e) => setF('pix_key', e.target.value)} className={inputCls} /></div>
              <div><label className={lbl}>Dados bancários</label><input value={modal.form.bank_info} onChange={(e) => setF('bank_info', e.target.value)} className={inputCls} placeholder="Banco · Ag · Conta" /></div>
            </div>

            <Section title="Documentos & Ficha" />
            <div className="space-y-3 mb-4">
              <FlowImageField label="Ficha cadastral (principal)" value={modal.form.registration_file} onChange={(url) => setF('registration_file', url)} folder="equipe/fichas" accept="any" hint="PDF, imagem ou documento" />
              <div>
                <label className={lbl}>Documentos adicionais (RG, CPF, contrato…)</label>
                <PendingAttachments items={modal.form.documents} onRemove={(i) => setF('documents', modal.form.documents.filter((_, j) => j !== i))} />
                <AttachButton onAdd={(a) => setF('documents', [...(modal.form.documents || []), a])} folder="equipe/docs" notify={notify} />
              </div>
            </div>

            <Section title="Acesso ao sistema" />
            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input type="checkbox" checked={!!modal.form.has_system_access} onChange={(e) => setF('has_system_access', e.target.checked)} className="w-4 h-4 accent-admin-champ" />
              <span className="text-sm text-admin-muted/80">Este colaborador terá acesso ao sistema<span className="block text-[10px] text-admin-muted/40">O convite de login é enviado em Usuários & Acessos, pelo e-mail informado.</span></span>
            </label>

            <div><label className={lbl}>Observações</label><textarea value={modal.form.notes} onChange={(e) => setF('notes', e.target.value)} rows={2} className={`${inputCls} resize-none`} /></div>

            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">{modal.editingId ? 'Salvar' : 'Cadastrar'}</button><button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}

      {/* Modal preview de importação */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setImportOpen(false)}>
          <div className="glass-pop rounded-2xl p-7 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-2xl text-admin-text">Importar equipe</h2><button onClick={() => setImportOpen(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <p className="text-admin-muted/60 text-sm mb-4">{preview.length} linha(s) lida(s). Confira antes de importar:</p>
            <div className="glass rounded-xl overflow-hidden overflow-x-auto mb-5">
              <table className="w-full text-xs">
                <thead><tr className="text-admin-muted/50 uppercase tracking-wider border-b border-white/[0.06]">{['Nome', 'Setor', 'Cargo', 'E-mail', 'Aniversário'].map((h) => <th key={h} className="text-left px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>{preview.slice(0, 30).map((r, i) => <tr key={i} className="border-b border-white/[0.03]"><td className="px-3 py-2 text-admin-text">{r.nome || '—'}</td><td className="px-3 py-2 text-admin-muted/70">{r.setor || '—'}</td><td className="px-3 py-2 text-admin-muted/70">{r.cargo || '—'}</td><td className="px-3 py-2 text-admin-muted/70">{r.email || '—'}</td><td className="px-3 py-2 text-admin-muted/70">{r.aniversario || '—'}</td></tr>)}</tbody>
              </table>
            </div>
            {preview.length > 30 && <p className="text-admin-muted/40 text-xs mb-3">…e mais {preview.length - 30} linha(s).</p>}
            <div className="flex gap-3"><button onClick={confirmImport} disabled={importing} className="flex-1 bg-admin-sage/15 hover:bg-admin-sage/25 text-admin-sage py-2.5 rounded-xl text-sm disabled:opacity-50">{importing ? 'Importando…' : `Importar ${preview.length} colaborador(es)`}</button><button onClick={() => setImportOpen(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
