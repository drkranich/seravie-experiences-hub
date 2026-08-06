import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { PhoneFrame, FormPreview } from './FlowPreview'
import { FlowImageField } from './FlowImageField'

const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5'
const formUrl = (slug) => `${window.location.origin}/#form/${slug}`

// Catálogo de blocos essenciais (Onda 1)
const BLOCK_TYPES = [
  { type: 'title', label: 'Título', icon: 'layout', static: true },
  { type: 'text', label: 'Texto', icon: 'book', static: true },
  { type: 'image', label: 'Imagem', icon: 'image', static: true },
  { type: 'button', label: 'Botão / Link', icon: 'link', static: true },
  { type: 'short_text', label: 'Texto curto', icon: 'pen' },
  { type: 'long_text', label: 'Texto longo', icon: 'pen' },
  { type: 'email', label: 'E-mail', icon: 'mail' },
  { type: 'phone', label: 'Telefone', icon: 'user' },
  { type: 'number', label: 'Número', icon: 'chart' },
  { type: 'choice', label: 'Múltipla escolha', icon: 'check' },
  { type: 'nps', label: 'NPS (0–10)', icon: 'star' },
  { type: 'rating', label: 'Estrelas', icon: 'star' },
  { type: 'upload', label: 'Upload (foto/arquivo)', icon: 'upload' },
]
const TYPE_LABEL = Object.fromEntries(BLOCK_TYPES.map((b) => [b.type, b.label]))
const isStatic = (t) => ['title', 'text', 'image', 'button'].includes(t)

export function FlowStudio({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // form aberto no construtor

  const load = async () => { setLoading(true); const { data } = await supabase.from('flow_forms').select('*').order('created_at', { ascending: false }); setForms(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const createForm = async () => {
    const { data, error } = await supabase.from('flow_forms').insert({ tenant_id: tenantId, title: 'Nova experiência', created_by: profile?.user_id }).select('*').single()
    if (error) return notify('Erro ao criar: ' + error.message, 'error')
    load(); setEditing(data)
  }
  const removeForm = async (f) => { if (!confirm(`Excluir "${f.title}"?`)) return; await supabase.from('flow_forms').delete().eq('id', f.id); load() }

  const [aiOpen, setAiOpen] = useState(false)
  const [aiGoal, setAiGoal] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const createWithAI = async () => {
    if (!aiGoal.trim()) return
    setAiBusy(true)
    const { data, error } = await supabase.functions.invoke('flow-ai', { body: { action: 'generate_form', goal: aiGoal } })
    if (error || data?.error || !data?.form) { setAiBusy(false); return notify(data?.error === 'ai_not_configured' ? 'Configure a chave de IA nas Edge Functions para gerar com IA.' : 'Não consegui gerar. Tente descrever de outra forma.', 'info') }
    const spec = data.form
    const { data: nf, error: fe } = await supabase.from('flow_forms').insert({ tenant_id: tenantId, title: spec.title || 'Experiência (IA)', submit_message: spec.submit_message || undefined, created_by: profile?.user_id }).select('*').single()
    if (fe || !nf) { setAiBusy(false); return notify('Erro ao criar o formulário', 'error') }
    const blocks = (spec.blocks || []).slice(0, 12).map((b, i) => ({
      tenant_id: tenantId, form_id: nf.id, type: b.type || 'short_text', label: b.label || 'Pergunta',
      help: b.help || null, required: !!b.required, options: Array.isArray(b.options) ? b.options : [], sort_order: i,
    }))
    if (blocks.length) await supabase.from('flow_form_blocks').insert(blocks)
    setAiBusy(false); setAiOpen(false); setAiGoal(''); notify('Formulário gerado pela IA!', 'success'); setEditing(nf)
  }

  if (editing) return <FormBuilder form={editing} notify={notify} onBack={() => { setEditing(null); load() }} />

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <p className="text-admin-muted/50 text-sm">{forms.length} experiências · formulários cinematográficos</p>
        <div className="flex gap-2">
          <button onClick={() => setAiOpen(true)} className="flex items-center gap-2 bg-admin-gold/10 hover:bg-admin-gold/20 text-admin-gold px-4 py-2 rounded-xl text-sm"><Icon name="spark" className="w-4 h-4" />Criar com IA</button>
          <button onClick={createForm} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Nova experiência</button>
        </div>
      </div>

      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setAiOpen(false)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-2xl text-admin-text mb-2">Criar experiência com IA</h2>
            <p className="text-admin-muted/50 text-sm mb-4">Descreva o objetivo e a IA monta o formulário inteiro.</p>
            <textarea value={aiGoal} onChange={(e) => setAiGoal(e.target.value)} rows={3} placeholder="Ex: diagnóstico para captar clientes de arquitetura de interiores" className={`${inputCls} resize-none`} />
            <div className="flex gap-3 mt-4">
              <button onClick={createWithAI} disabled={aiBusy || !aiGoal.trim()} className="flex-1 bg-admin-gold/15 text-admin-gold py-2.5 rounded-xl text-sm hover:bg-admin-gold/25 disabled:opacity-40">{aiBusy ? 'Gerando…' : 'Gerar formulário'}</button>
              <button onClick={() => setAiOpen(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p> : forms.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><p className="text-admin-muted/50 text-sm">Nenhuma experiência ainda.</p><p className="text-admin-muted/30 text-xs mt-1">Crie um formulário cinematográfico — o cliente responde numa jornada tela cheia, estilo Reels.</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((f) => (
            <div key={f.id} className="glass rounded-2xl p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="text-admin-text font-medium truncate">{f.title}</p><p className="text-admin-muted/40 text-[11px]">{f.response_count} resposta(s)</p></div>
                <span className={`text-[9px] px-2 py-0.5 rounded-lg ${f.status === 'published' ? 'bg-admin-sage/10 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/50'}`}>{f.status === 'published' ? 'publicado' : 'rascunho'}</span>
              </div>
              <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                <button onClick={() => setEditing(f)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">Editar</button>
                {f.status === 'published' && <a href={formUrl(f.slug)} target="_blank" rel="noreferrer" className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Abrir</a>}
                <button onClick={() => removeForm(f)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-admin-muted/60 hover:text-admin-rose ml-auto">Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Construtor de um formulário ----------
function FormBuilder({ form, notify, onBack }) {
  const { profile } = useTenant()
  const [f, setF] = useState(form)
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null) // bloco selecionado para editar
  const [addOpen, setAddOpen] = useState(false)
  const [tab, setTab] = useState('build') // build | responses
  const [previewOpen, setPreviewOpen] = useState(false)
  const [responses, setResponses] = useState([])
  const loadResponses = async () => { const { data } = await supabase.from('flow_responses').select('*').eq('form_id', form.id).order('created_at', { ascending: false }).limit(1000); setResponses(data || []) }
  useEffect(() => { if (tab === 'responses') loadResponses() }, [tab])

  const exportCSV = () => {
    const qBlocks = blocks.filter((b) => !isStatic(b.type))
    const header = ['Data', ...qBlocks.map((b) => (b.label || TYPE_LABEL[b.type] || b.type))]
    const rows = responses.map((r) => [new Date(r.created_at).toLocaleString('pt-BR'), ...qBlocks.map((b) => { const v = r.answers?.[b.id]; return Array.isArray(v) ? v.join('; ') : (v ?? '') })])
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`
    const csv = [header, ...rows].map((row) => row.map(esc).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${f.title.replace(/\s+/g, '-').toLowerCase()}-respostas.csv`; a.click()
  }

  const loadBlocks = async () => { setLoading(true); const { data } = await supabase.from('flow_form_blocks').select('*').eq('form_id', form.id).order('sort_order'); setBlocks(data || []); setLoading(false) }
  useEffect(() => { loadBlocks() }, [form.id])

  const saveForm = async (patch) => {
    const next = { ...f, ...patch }; setF(next)
    await supabase.from('flow_forms').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', form.id)
  }
  const publish = async () => {
    if (!blocks.length) return notify('Adicione ao menos um bloco antes de publicar', 'error')
    await saveForm({ status: f.status === 'published' ? 'draft' : 'published' })
    notify(f.status === 'published' ? 'Despublicado' : 'Publicado! Link pronto para compartilhar.', 'success')
  }
  const addBlock = async (type) => {
    const { data, error } = await supabase.from('flow_form_blocks').insert({
      tenant_id: profile?.tenant_id, form_id: form.id, type,
      label: isStatic(type) ? (type === 'title' ? 'Título da cena' : type === 'text' ? 'Texto' : type === 'image' ? 'Imagem' : 'Botão') : 'Nova pergunta',
      sort_order: blocks.length, options: type === 'choice' ? [{ label: 'Opção 1' }, { label: 'Opção 2' }] : [],
    }).select('*').single()
    setAddOpen(false)
    if (error) return notify('Erro ao adicionar', 'error')
    loadBlocks(); setSel(data)
  }
  const saveBlock = async (patch) => {
    const next = { ...sel, ...patch }; setSel(next)
    await supabase.from('flow_form_blocks').update(patch).eq('id', sel.id)
    setBlocks((bs) => bs.map((b) => b.id === sel.id ? next : b))
  }
  const [aiBusy, setAiBusy] = useState(false)
  const runAI = async (action) => {
    if (!sel?.label) return
    setAiBusy(true)
    const { data, error } = await supabase.functions.invoke('flow-ai', { body: { action, text: sel.label } })
    setAiBusy(false)
    if (error || data?.error) return notify(data?.error === 'ai_not_configured' ? 'Configure a chave de IA nas Edge Functions para usar este recurso.' : 'Falha na IA. Tente novamente.', 'info')
    if (data?.text) saveBlock({ label: data.text })
  }
  const removeBlock = async (b) => { await supabase.from('flow_form_blocks').delete().eq('id', b.id); if (sel?.id === b.id) setSel(null); loadBlocks() }
  const move = async (b, delta) => {
    const i = blocks.findIndex((x) => x.id === b.id); const j = i + delta
    if (j < 0 || j >= blocks.length) return
    const reordered = [...blocks]; const [item] = reordered.splice(i, 1); reordered.splice(j, 0, item)
    setBlocks(reordered)
    await Promise.all(reordered.map((x, k) => supabase.from('flow_form_blocks').update({ sort_order: k }).eq('id', x.id)))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <button onClick={onBack} className="text-[11px] tracking-wider uppercase text-admin-muted/60 hover:text-admin-champ">← Experiências</button>
        <div className="flex items-center gap-1 mr-auto ml-4">
          <button onClick={() => setTab('build')} className={`text-xs px-3 py-1.5 rounded-lg ${tab === 'build' ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted/60'}`}>Construtor</button>
          <button onClick={() => setTab('responses')} className={`text-xs px-3 py-1.5 rounded-lg ${tab === 'responses' ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted/60'}`}>Respostas ({f.response_count})</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPreviewOpen(true)} className="text-xs px-3 py-2 rounded-xl bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Pré-visualizar</button>
          {f.status === 'published' && <a href={formUrl(f.slug)} target="_blank" rel="noreferrer" className="text-xs px-3 py-2 rounded-xl bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Ver ao vivo</a>}
          <button onClick={() => { navigator.clipboard?.writeText(formUrl(f.slug)); notify('Link copiado', 'success') }} className="text-xs px-3 py-2 rounded-xl bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Copiar link</button>
          <button onClick={publish} className={`text-xs px-4 py-2 rounded-xl ${f.status === 'published' ? 'bg-admin-gold/15 text-admin-gold' : 'bg-admin-sage/15 text-admin-sage'}`}>{f.status === 'published' ? 'Despublicar' : 'Publicar'}</button>
        </div>
      </div>

      {tab === 'responses' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-admin-muted/50 text-sm">{responses.length} resposta(s)</p>
            {responses.length > 0 && <button onClick={exportCSV} className="text-xs px-4 py-2 rounded-xl bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">Exportar CSV</button>}
          </div>
          {responses.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center"><p className="text-admin-muted/50 text-sm">Ainda sem respostas.</p><p className="text-admin-muted/30 text-xs mt-1">Publique e compartilhe o link para começar a receber.</p></div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-admin-muted/50 text-[11px] uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 whitespace-nowrap">Data</th>
                  {blocks.filter((b) => !isStatic(b.type)).map((b) => <th key={b.id} className="text-left px-4 py-3 whitespace-nowrap">{b.label || TYPE_LABEL[b.type]}</th>)}
                </tr></thead>
                <tbody>
                  {responses.map((r) => (
                    <tr key={r.id} className="border-b border-white/[0.03]">
                      <td className="px-4 py-2.5 text-admin-muted/60 whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                      {blocks.filter((b) => !isStatic(b.type)).map((b) => { const v = r.answers?.[b.id]; const isUrl = typeof v === 'string' && /^https?:\/\//.test(v); return <td key={b.id} className="px-4 py-2.5 text-admin-text/90">{isUrl ? <a href={v} target="_blank" rel="noreferrer" className="text-admin-champ hover:underline">{b.type === 'upload' ? 'Ver arquivo ↗' : v}</a> : Array.isArray(v) ? v.join(', ') : (v ?? '—')}</td> })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'build' && <>
      {/* cabeçalho do form */}
      <div className="glass rounded-2xl p-5 mb-4 grid sm:grid-cols-2 gap-3">
        <div><label className={lbl}>Título da experiência</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} onBlur={(e) => saveForm({ title: e.target.value })} className={inputCls} /></div>
        <div><FlowImageField label="Imagem de capa" value={f.cover_url || ''} onChange={(url) => { setF({ ...f, cover_url: url }); saveForm({ cover_url: url || null }) }} /></div>
        <div className="sm:col-span-2"><label className={lbl}>Mensagem final</label><input value={f.submit_message || ''} onChange={(e) => setF({ ...f, submit_message: e.target.value })} onBlur={(e) => saveForm({ submit_message: e.target.value })} className={inputCls} /></div>
        {/* Spine: geração automática de lead no pipeline */}
        <label className="flex items-center gap-2 text-sm text-admin-muted/70 sm:col-span-2 pt-1 border-t border-white/[0.05] mt-1"><input type="checkbox" checked={f.creates_lead !== false} onChange={(e) => { setF({ ...f, creates_lead: e.target.checked }); saveForm({ creates_lead: e.target.checked }) }} className="accent-admin-champ" />Gerar negócio no CRM automaticamente a cada resposta</label>
        {f.creates_lead !== false && <div className="sm:col-span-2"><label className={lbl}>Etapa inicial no pipeline</label><GlassSelect value={f.lead_stage || 'new'} onChange={(v) => { setF({ ...f, lead_stage: v }); saveForm({ lead_stage: v }) }} options={[{ value: 'new', label: 'Novo Lead' }, { value: 'qualified', label: 'Qualificado' }, { value: 'proposal', label: 'Proposta' }]} /></div>}
      </div>

      <div className="grid lg:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] gap-4">
        {/* lista de blocos */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3"><p className="text-[11px] uppercase tracking-wider text-admin-champ/70">Cenas ({blocks.length})</p><button onClick={() => setAddOpen(true)} className="text-xs px-3 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">+ Bloco</button></div>
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : blocks.length === 0 ? (
            <p className="text-admin-muted/30 text-xs text-center py-8">Nenhuma cena. Adicione o primeiro bloco.</p>
          ) : (
            <div className="space-y-2">
              {blocks.map((b, i) => (
                <div key={b.id} onClick={() => setSel(b)} className={`rounded-xl border p-3 cursor-pointer transition-colors ${sel?.id === b.id ? 'border-admin-champ/50 bg-admin-champ/[0.06]' : 'border-white/[0.06] hover:bg-white/[0.03]'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-admin-muted/30 text-[10px] w-4">{i + 1}</span>
                    <span className="text-admin-text text-sm truncate flex-1">{b.label || TYPE_LABEL[b.type]}</span>
                    <span className="text-[9px] text-admin-muted/40 px-1.5 py-0.5 rounded bg-white/[0.05]">{TYPE_LABEL[b.type] || b.type}</span>
                    <button onClick={(e) => { e.stopPropagation(); move(b, -1) }} className="text-admin-muted/40 hover:text-admin-champ text-xs">▲</button>
                    <button onClick={(e) => { e.stopPropagation(); move(b, 1) }} className="text-admin-muted/40 hover:text-admin-champ text-xs">▼</button>
                    <button onClick={(e) => { e.stopPropagation(); removeBlock(b) }} className="text-admin-muted/40 hover:text-admin-rose text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* editor do bloco selecionado */}
        <div className="glass rounded-2xl p-4">
          {!sel ? <p className="text-admin-muted/30 text-sm text-center py-16">Selecione uma cena para editar.</p> : (
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-wider text-admin-champ/70">Editar cena · {TYPE_LABEL[sel.type]}</p>
              <div><label className={lbl}>{sel.type === 'title' ? 'Título' : 'Pergunta / rótulo'}</label><input value={sel.label || ''} onChange={(e) => setSel({ ...sel, label: e.target.value })} onBlur={(e) => saveBlock({ label: e.target.value })} className={inputCls} /></div>
              {/* IA — refinar o texto da pergunta */}
              <div className="flex flex-wrap gap-1.5">
                {[['improve', '✨ Melhorar'], ['persuasive', 'Persuasivo'], ['friendly', 'Amigável'], ['formal', 'Formal'], ['shorter', 'Encurtar'], ['fix', 'Corrigir']].map(([a, l]) => (
                  <button key={a} onClick={() => runAI(a)} disabled={aiBusy || !sel.label} className="text-[10px] px-2.5 py-1 rounded-lg bg-admin-champ/10 text-admin-champ/80 hover:bg-admin-champ/20 disabled:opacity-40">{aiBusy ? '…' : l}</button>
                ))}
              </div>
              {!isStatic(sel.type) && <div><label className={lbl}>Texto de ajuda (acima da pergunta)</label><input value={sel.help || ''} onChange={(e) => setSel({ ...sel, help: e.target.value })} onBlur={(e) => saveBlock({ help: e.target.value })} className={inputCls} /></div>}
              {['short_text', 'long_text', 'email', 'phone', 'number'].includes(sel.type) && <div><label className={lbl}>Placeholder</label><input value={sel.placeholder || ''} onChange={(e) => setSel({ ...sel, placeholder: e.target.value })} onBlur={(e) => saveBlock({ placeholder: e.target.value })} className={inputCls} /></div>}
              {sel.type === 'text' && <div><label className={lbl}>Corpo do texto</label><textarea value={sel.config?.body || ''} onChange={(e) => setSel({ ...sel, config: { ...sel.config, body: e.target.value } })} onBlur={(e) => saveBlock({ config: { ...sel.config, body: e.target.value } })} rows={3} className={`${inputCls} resize-none`} /></div>}
              {(sel.type === 'image') && <FlowImageField label="Imagem" value={sel.config?.media_url || ''} onChange={(url) => { const cfg = { ...sel.config, media_url: url }; setSel({ ...sel, config: cfg }); saveBlock({ config: cfg }) }} />}
              {sel.type === 'upload' && (
                <div className="space-y-2">
                  <label className={lbl}>O que o cliente deve enviar</label>
                  <GlassSelect value={sel.config?.accept || 'image'} onChange={(v) => { const cfg = { ...sel.config, accept: v }; setSel({ ...sel, config: cfg }); saveBlock({ config: cfg }) }}
                    options={[{ value: 'image', label: 'Apenas imagens (fotos)' }, { value: 'any', label: 'Qualquer arquivo (documentos, PDF…)' }]} />
                  <p className="text-admin-muted/30 text-[10px]">O cliente verá um botão para enviar {sel.config?.accept === 'any' ? 'um arquivo' : 'uma foto'} ao responder. O link do arquivo fica salvo na resposta.</p>
                </div>
              )}
              {sel.type === 'button' && <><div><label className={lbl}>Texto do botão</label><input value={sel.config?.button_label || ''} onChange={(e) => setSel({ ...sel, config: { ...sel.config, button_label: e.target.value } })} onBlur={(e) => saveBlock({ config: { ...sel.config, button_label: e.target.value } })} className={inputCls} /></div><div><label className={lbl}>Link (URL)</label><input value={sel.config?.url || ''} onChange={(e) => setSel({ ...sel, config: { ...sel.config, url: e.target.value } })} onBlur={(e) => saveBlock({ config: { ...sel.config, url: e.target.value } })} className={inputCls} /></div></>}
              {sel.type === 'rating' && <div><label className={lbl}>Máximo de estrelas</label><input type="number" value={sel.config?.max || 5} onChange={(e) => setSel({ ...sel, config: { ...sel.config, max: e.target.value } })} onBlur={(e) => saveBlock({ config: { ...sel.config, max: Number(e.target.value) || 5 } })} className={inputCls} /></div>}
              {sel.type === 'choice' && (
                <div>
                  <label className={lbl}>Opções</label>
                  <div className="space-y-2">
                    {(sel.options || []).map((o, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={o.label ?? o} onChange={(e) => { const opts = [...sel.options]; opts[i] = { label: e.target.value }; setSel({ ...sel, options: opts }) }} onBlur={() => saveBlock({ options: sel.options })} className={inputCls} />
                        <button onClick={() => { const opts = sel.options.filter((_, j) => j !== i); saveBlock({ options: opts }) }} className="text-admin-muted/40 hover:text-admin-rose px-2">✕</button>
                      </div>
                    ))}
                    <button onClick={() => saveBlock({ options: [...(sel.options || []), { label: `Opção ${(sel.options || []).length + 1}` }] })} className="text-xs text-admin-champ hover:underline">+ opção</button>
                  </div>
                </div>
              )}
              {!isStatic(sel.type) && <label className="flex items-center gap-2 text-sm text-admin-muted/70 pt-1"><input type="checkbox" checked={!!sel.required} onChange={(e) => saveBlock({ required: e.target.checked })} className="accent-admin-champ" />Resposta obrigatória</label>}
              {/* Spine: mapear esta resposta para um campo do lead/negócio */}
              {!isStatic(sel.type) && (
                <div className="pt-2 border-t border-white/[0.05]">
                  <label className={lbl}>Vincular ao CRM (opcional)</label>
                  <GlassSelect value={sel.maps_to || ''} onChange={(v) => { setSel({ ...sel, maps_to: v || null }); saveBlock({ maps_to: v || null }) }}
                    options={[
                      { value: '', label: '— só guardar a resposta —' },
                      { value: 'contact_name', label: 'Nome do contato' },
                      { value: 'contact_email', label: 'E-mail do contato' },
                      { value: 'contact_phone', label: 'Telefone do contato' },
                      { value: 'contact_document', label: 'CPF / CNPJ' },
                      { value: 'company', label: 'Empresa' },
                      { value: 'segment', label: 'Segmento' },
                      { value: 'deal_title', label: 'Título do negócio' },
                      { value: 'deal_value', label: 'Valor do negócio' },
                      { value: 'budget', label: 'Orçamento disponível' },
                      { value: 'notes', label: 'Observações' },
                    ]} />
                  <p className="text-admin-muted/30 text-[10px] mt-1">O que o cliente responder aqui preenche este campo no negócio criado.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* preview lateral ao vivo (telas grandes) */}
        <div className="hidden xl:block">
          <PhoneFrame label="Preview ao vivo">
            <FormPreview key={blocks.map((b) => b.id + (b.label || '')).join('|')} form={f} blocks={blocks} />
          </PhoneFrame>
        </div>
      </div>
      </>}

      {/* preview tela cheia */}
      {previewOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-center">
            <PhoneFrame><FormPreview key={'full' + blocks.length} form={f} blocks={blocks} /></PhoneFrame>
            <button onClick={() => setPreviewOpen(false)} className="mt-4 text-xs px-5 py-2 rounded-xl bg-white/[0.08] text-admin-muted/80 hover:text-admin-champ">Fechar</button>
          </div>
        </div>
      )}

      {/* modal adicionar bloco */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setAddOpen(false)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-2xl text-admin-text mb-4">Adicionar bloco</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {BLOCK_TYPES.map((bt) => (
                <button key={bt.type} onClick={() => addBlock(bt.type)} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/[0.06] hover:bg-white/[0.04] hover:border-admin-champ/30 transition-colors">
                  <Icon name={bt.icon} className="w-5 h-5 text-admin-champ" />
                  <span className="text-admin-text text-xs">{bt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
