import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'
import { FlowImageField } from './FlowImageField'
import { exportCsv } from '../../lib/export'

const STATUS = { active: ['Ativo', 'text-admin-sage bg-admin-sage/10'], inactive: ['Inativo', 'text-admin-muted/40 bg-white/[0.04]'], vacation: ['Férias', 'text-admin-gold bg-admin-gold/10'], terminated: ['Desligado', 'text-admin-rose bg-admin-rose/10'] }
// Setores/categorias padrão (o usuário pode digitar outro livremente)
const DEPARTMENTS = ['Atendimento', 'Vendas', 'Financeiro', 'Marketing', 'Operações', 'Produção', 'Logística', 'Suporte', 'Administrativo', 'Gerência', 'RH', 'TI']
const emptyForm = () => ({ name: '', role: '', department: '', email: '', phone: '', birth_date: '', hire_date: '', status: 'active', registration_file: '', notes: '' })

// Colunas da planilha-modelo Seravie (ordem fixa)
const TEMPLATE_COLS = ['nome', 'setor', 'cargo', 'email', 'telefone', 'aniversario', 'admissao', 'status']

// Parser CSV (aspas + separador auto ; ou ,). Retorna objetos pela 1ª linha (cabeçalho).
function parseCsv(text) {
  const clean = text.replace(/^﻿/, '') // remove BOM
  // detecta separador pela 1ª linha
  const firstLine = clean.split(/\r?\n/)[0] || ''
  const sep = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ','
  const rows = []
  let field = '', row = [], inQ = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQ) {
      if (c === '"' && clean[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQ = false
      else field += c
    } else {
      if (c === '"') inQ = true
      else if (c === sep) { row.push(field); field = '' }
      else if (c === '\n' || c === '\r') { if (field !== '' || row.length) { row.push(field); rows.push(row); row = []; field = '' } if (c === '\r' && clean[i + 1] === '\n') i++ }
      else field += c
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  if (!rows.length) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] || '').trim()])))
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
  const fileRef = useRef(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('employees').select('*').order('name')
    setEmployees(data || [])
    // planilha geral fica em settings do tenant
    const { data: t } = await supabase.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
    setTeamSheet(t?.settings?.team_sheet_url || '')
    setLoading(false)
  }
  useEffect(() => { if (tenantId) load() }, [tenantId])

  const openNew = () => setModal({ form: emptyForm(), editingId: null })
  const openEdit = (e) => setModal({ form: { ...emptyForm(), ...e }, editingId: e.id })
  const setF = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }))

  const save = async () => {
    const f = modal.form
    if (!f.name?.trim()) return notify('Nome obrigatório', 'error')
    const payload = { name: f.name, role: f.role || null, department: f.department || null, email: f.email || null, phone: f.phone || null, birth_date: f.birth_date || null, hire_date: f.hire_date || null, status: f.status || 'active', registration_file: f.registration_file || null, notes: f.notes || null }
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
      { nome: 'Ex: Maria Silva', setor: 'Atendimento', cargo: 'Atendente', email: 'maria@empresa.com', telefone: '(11) 90000-0000', aniversario: '1990-05-20', admissao: '2024-01-10', status: 'active' },
    ])
    notify('Modelo baixado — preencha e importe', 'success')
  }
  const onImportFile = async (file) => {
    if (!file) return
    const text = await file.text()
    const rows = parseCsv(text)
    if (!rows.length) return notify('Planilha vazia ou inválida', 'error')
    setPreview(rows.slice(0, 200))
    setImportOpen(true)
  }
  const confirmImport = async () => {
    setImporting(true)
    const toInsert = preview.filter((r) => (r.nome || '').trim()).map((r) => ({
      tenant_id: tenantId, name: r.nome, department: r.setor || null, role: r.cargo || null,
      email: r.email || null, phone: r.telefone || null,
      birth_date: r.aniversario || null, hire_date: r.admissao || null,
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
                  {bday != null && <span className="px-2 py-0.5 rounded-lg bg-admin-gold/10 text-admin-gold">🎂 {bday === 0 ? 'hoje!' : `em ${bday}d`}</span>}
                </div>
                <div className="mt-2 space-y-0.5">
                  {e.email && <p className="text-admin-muted/50 text-[11px] truncate">{e.email}</p>}
                  {e.registration_file && <a href={e.registration_file} target="_blank" rel="noreferrer" className="text-admin-champ text-[11px] hover:underline inline-flex items-center gap-1">Ficha cadastral ↗</a>}
                </div>
              </div>
            )
          })
        }
      </div>

      {/* Modal cadastro/edição */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="glass-pop rounded-2xl p-7 w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{modal.editingId ? 'Editar colaborador' : 'Novo colaborador'}</h2><button onClick={() => setModal(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={lbl}>Nome *</label><input value={modal.form.name} onChange={(e) => setF('name', e.target.value)} className={inputCls} /></div>
              <div><label className={lbl}>Setor / Categoria</label><GlassSelect value={modal.form.department} onChange={(v) => setF('department', v)} options={[{ value: '', label: '— selecione —' }, ...DEPARTMENTS.map((d) => ({ value: d, label: d }))]} /></div>
              <div><label className={lbl}>Cargo</label><input value={modal.form.role} onChange={(e) => setF('role', e.target.value)} className={inputCls} placeholder="Ex: Atendente" /></div>
              <div><label className={lbl}>E-mail</label><input type="email" value={modal.form.email} onChange={(e) => setF('email', e.target.value)} className={inputCls} /></div>
              <div><label className={lbl}>Telefone</label><input value={modal.form.phone} onChange={(e) => setF('phone', e.target.value)} className={inputCls} /></div>
              <div><label className={lbl}>Data de aniversário</label><GlassDate value={modal.form.birth_date} onChange={(v) => setF('birth_date', v)} /></div>
              <div><label className={lbl}>Data de admissão</label><GlassDate value={modal.form.hire_date} onChange={(v) => setF('hire_date', v)} /></div>
              <div><label className={lbl}>Status</label><GlassSelect value={modal.form.status} onChange={(v) => setF('status', v)} options={Object.entries(STATUS).map(([value, x]) => ({ value, label: x[0] }))} /></div>
              <div className="col-span-2"><FlowImageField label="Ficha cadastral (arquivo)" value={modal.form.registration_file} onChange={(url) => setF('registration_file', url)} folder="equipe/fichas" accept="any" hint="PDF, imagem ou documento do colaborador" /></div>
              <div className="col-span-2"><label className={lbl}>Observações</label><textarea value={modal.form.notes} onChange={(e) => setF('notes', e.target.value)} rows={2} className={`${inputCls} resize-none`} /></div>
            </div>
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
