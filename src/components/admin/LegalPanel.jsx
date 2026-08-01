import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { ResourceTabs } from './ResourcePanel'
import { LEGAL_TYPES } from './LegalGate'
import { logAudit } from '../../lib/audit'

const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'

const TEMPLATES = {
  terms: `1. Objeto\nA plataforma Seravie atua exclusivamente como ambiente de conexão entre usuários (clientes, fornecedores, consultores e parceiros). A Seravie não fabrica, não vende, não transporta e não representa fornecedores ou clientes.\n\n2. Negociação\nToda negociação ocorre diretamente entre as partes. A Seravie apenas facilita o encontro entre elas.\n\n3. Cobrança\nA Seravie não processa pagamentos entre usuários, exceto a cobrança pela utilização das suas plataformas.\n\n4. Cadastro e veracidade\nO usuário declara que as informações fornecidas são verdadeiras e se responsabiliza por elas.\n\n5. Verificação de identidade\nA Seravie pode exigir verificação por biometria facial dinâmica (liveness) e validação documental.`,
  privacy: `1. Dados coletados\nColetamos os dados fornecidos no cadastro e no uso da plataforma, além de metadados técnicos (IP, data, hora, dispositivo).\n\n2. Finalidade\nOs dados são usados para operar o ecossistema, conectar as partes e cumprir obrigações legais.\n\n3. Compartilhamento\nDados de perfil publicados no diretório ficam visíveis a outros usuários do ecossistema. Não vendemos dados pessoais.\n\n4. Direitos do titular (LGPD)\nO usuário pode solicitar acesso, correção, portabilidade e exclusão dos seus dados.`,
  responsibility: `1. Responsabilidade das partes\nCada usuário é integralmente responsável pelos produtos, serviços, propostas e negociações que realiza.\n\n2. Isenção da Seravie\nA Seravie não se responsabiliza pela qualidade, entrega, prazo ou pagamento de negociações realizadas entre usuários.\n\n3. Conduta\nO usuário compromete-se a agir com boa-fé, profissionalismo e respeito às leis aplicáveis.\n\n4. Aceite\nO aceite deste documento é registrado com IP, data, hora, versão e assinatura eletrônica.`,
}

function DocumentsTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ doc_type: 'terms', title: '', version: 'v1', content: '', effective_date: '' })

  const load = async () => { setLoading(true); const { data } = await supabase.from('legal_documents').select('*').order('doc_type').order('created_at', { ascending: false }); setRows(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const openNew = (type) => {
    const t = type || 'terms'
    const existing = rows.filter((r) => r.doc_type === t)
    const nextV = `v${existing.length + 1}`
    setForm({ doc_type: t, title: LEGAL_TYPES[t], version: nextV, content: TEMPLATES[t] || '', effective_date: '' })
    setModal(true)
  }

  const publish = async () => {
    if (!form.title.trim()) return notify('Informe o título', 'error')
    const payload = { tenant_id: tenantId, doc_type: form.doc_type, title: form.title, version: form.version, content: form.content, effective_date: form.effective_date || null, is_current: true, status: 'published' }
    const { data, error } = await supabase.from('legal_documents').insert(payload).select('id').single()
    if (error) return notify('Erro ao publicar: ' + error.message, 'error')
    // marca versões anteriores do mesmo tipo como não-vigentes
    await supabase.from('legal_documents').update({ is_current: false }).eq('doc_type', form.doc_type).neq('id', data.id)
    logAudit({ action: 'create', resource_type: 'legal_documents', resource_id: data.id, new_data: payload }, tenantId)
    setModal(false); notify('Documento publicado e definido como versão vigente', 'success'); load()
  }

  const byType = Object.keys(LEGAL_TYPES).map((t) => ({ type: t, docs: rows.filter((r) => r.doc_type === t) }))

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>

  return (
    <div className="max-w-3xl">
      <p className="text-admin-muted/50 text-sm mb-4">Documentos exigidos no cadastro de clientes e fornecedores. Publicar uma nova versão substitui a anterior como vigente — quem já aceitou precisará aceitar de novo.</p>
      <div className="space-y-4">
        {byType.map(({ type, docs }) => {
          const current = docs.find((d) => d.is_current)
          return (
            <div key={type} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <div><p className="text-admin-text font-medium">{LEGAL_TYPES[type]}</p><p className="text-admin-muted/40 text-[11px]">{current ? `Versão vigente: ${current.version}` : 'Nenhuma versão publicada'}</p></div>
                <button onClick={() => openNew(type)} className="text-xs px-3 py-1.5 rounded-lg bg-admin-champ/10 text-admin-champ">{current ? 'Nova versão' : 'Publicar'}</button>
              </div>
              {docs.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {docs.map((d) => <span key={d.id} className={`text-[10px] px-2 py-0.5 rounded-lg ${d.is_current ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/50'}`}>{d.version}{d.is_current ? ' · vigente' : ''}</span>)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">Publicar documento</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Tipo</label><GlassSelect value={form.doc_type} onChange={(v) => setForm((s) => ({ ...s, doc_type: v, title: LEGAL_TYPES[v], content: s.content || TEMPLATES[v] }))} options={Object.entries(LEGAL_TYPES).map(([value, label]) => ({ value, label }))} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Versão</label><input value={form.version} onChange={(e) => setForm((s) => ({ ...s, version: e.target.value }))} className={inputCls} /></div>
              <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Título</label><input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} className={inputCls} /></div>
              <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Conteúdo</label><textarea value={form.content} onChange={(e) => setForm((s) => ({ ...s, content: e.target.value }))} rows={10} className={`${inputCls} resize-none font-mono text-xs leading-relaxed`} /></div>
            </div>
            <div className="flex gap-3"><button onClick={publish} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">Publicar como vigente</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function LedgerTab() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { (async () => { setLoading(true); const { data } = await supabase.from('legal_acceptances').select('*').order('accepted_at', { ascending: false }).limit(200); setRows(data || []); setLoading(false) })() }, [])
  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>
  return (
    <div>
      <p className="text-admin-muted/50 text-sm mb-4">Trilha de aceites — registro imutável de auditoria. {rows.length} registros.</p>
      {rows.length === 0 ? <div className="glass rounded-2xl p-10 text-center text-admin-muted/50 text-sm">Nenhum aceite registrado ainda.</div> : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1.3fr_0.7fr_1fr_1fr_1.2fr] gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wider text-admin-muted/40 border-b border-white/[0.05]">
            <span>Documento</span><span>Versão</span><span>Assinatura</span><span>IP</span><span>Data/hora</span>
          </div>
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[1.3fr_0.7fr_1fr_1fr_1.2fr] gap-2 px-4 py-2.5 text-xs text-admin-muted/70 border-b border-white/[0.03]">
              <span className="text-admin-text">{LEGAL_TYPES[r.doc_type] || r.doc_type}</span>
              <span>{r.doc_version}</span>
              <span className="truncate">{r.signature_name || '—'}</span>
              <span>{r.ip || '—'}</span>
              <span>{new Date(r.accepted_at).toLocaleString('pt-BR')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function LegalPanel({ notify }) {
  return (
    <ResourceTabs title="Termos & Conformidade" subtitle="documentos legais versionáveis e trilha de aceites do ecossistema"
      tabs={[
        { key: 'docs', label: 'Documentos', render: () => <DocumentsTab notify={notify} /> },
        { key: 'ledger', label: 'Aceites Registrados', render: () => <LedgerTab /> },
      ]}
    />
  )
}
