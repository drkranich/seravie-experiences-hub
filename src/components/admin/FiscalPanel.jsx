import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { GlassSelect } from './ui'
import { ResourceTabs } from './ResourcePanel'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5'
const ST = { authorized: ['Autorizada', 'text-admin-sage'], pending: ['Pendente', 'text-admin-champ'], error: ['Erro', 'text-admin-rose'], rejected: ['Rejeitada', 'text-admin-rose'], cancelled: ['Cancelada', 'text-admin-muted'] }

// ---------- Documentos emitidos ----------
function DocsTab() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const load = async () => { const { data } = await supabase.from('fiscal_documents').select('*').order('created_at', { ascending: false }).limit(500); setRows(data || []); setLoading(false) }
  useEffect(() => { load() }, [])
  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>
  return (
    <div>
      {rows.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center"><p className="text-admin-muted/50 text-sm">Nenhum documento fiscal emitido.</p><p className="text-admin-muted/30 text-xs mt-1">Configure o gateway na aba "Configuração" e emita a partir do PDV.</p></div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-admin-muted/50 text-[11px] uppercase tracking-wider border-b border-white/[0.06]">
              <th className="text-left px-4 py-3">Tipo</th><th className="text-left px-4 py-3">Número</th><th className="text-left px-4 py-3">Valor</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Data</th><th className="px-4 py-3"></th></tr></thead>
            <tbody>
              {rows.map((r) => { const [sl, sc] = ST[r.status] || [r.status, 'text-admin-muted']; return (
                <tr key={r.id} className="border-b border-white/[0.03]">
                  <td className="px-4 py-3 text-admin-text/90 uppercase text-xs">{r.doc_type}</td>
                  <td className="px-4 py-3 text-admin-muted/70">{r.number || '—'}{r.series ? `/${r.series}` : ''}</td>
                  <td className="px-4 py-3 text-admin-champ">{brl(r.amount)}</td>
                  <td className={`px-4 py-3 ${sc}`}>{sl}{r.reject_reason ? <span className="text-admin-muted/40 text-[11px] block">{r.reject_reason}</span> : ''}</td>
                  <td className="px-4 py-3 text-admin-muted/50 text-xs">{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-right">{r.danfe_url && <a href={r.danfe_url} target="_blank" rel="noreferrer" className="text-admin-champ text-xs hover:underline">DANFE</a>}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------- Configuração do gateway ----------
function ConfigTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [form, setForm] = useState(null)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('fiscal_settings').select('*').eq('tenant_id', tenantId).maybeSingle()
      setForm(data || { provider: 'plugnotas', environment: 'homologacao', nfce_series: '1', enabled: false })
    })()
  }, [tenantId])
  const save = async () => {
    const payload = { ...form, tenant_id: tenantId, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('fiscal_settings').upsert(payload, { onConflict: 'tenant_id' })
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    notify('Configuração fiscal salva', 'success')
  }
  if (!form) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando…</p>
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  return (
    <div className="max-w-2xl">
      <div className="glass rounded-2xl p-3 mb-4 text-[12px] text-admin-muted/70 leading-relaxed">
        A emissão automática usa um gateway fiscal (PlugNotas, Focus NFe ou Nuvem Fiscal). Preencha os dados do emitente aqui e cadastre o segredo <code className="text-admin-champ">FISCAL_API_KEY</code> nas Edge Functions do Supabase. Enquanto não estiver configurado, o PDV registra a venda e deixa o documento como <span className="text-admin-champ">pendente</span>.
      </div>
      <div className="glass rounded-2xl p-6 grid sm:grid-cols-2 gap-4">
        <div><label className={lbl}>Provedor</label><GlassSelect value={form.provider} onChange={(v) => set('provider', v)} options={[{ value: 'plugnotas', label: 'PlugNotas' }, { value: 'focusnfe', label: 'Focus NFe' }, { value: 'nuvemfiscal', label: 'Nuvem Fiscal' }, { value: 'manual', label: 'Manual (sem gateway)' }]} /></div>
        <div><label className={lbl}>Ambiente</label><GlassSelect value={form.environment} onChange={(v) => set('environment', v)} options={[{ value: 'homologacao', label: 'Homologação (teste)' }, { value: 'producao', label: 'Produção' }]} /></div>
        <div><label className={lbl}>CNPJ</label><input value={form.cnpj || ''} onChange={(e) => set('cnpj', e.target.value)} className={inputCls} /></div>
        <div><label className={lbl}>Inscrição Estadual</label><input value={form.ie || ''} onChange={(e) => set('ie', e.target.value)} className={inputCls} /></div>
        <div className="sm:col-span-2"><label className={lbl}>Razão Social</label><input value={form.legal_name || ''} onChange={(e) => set('legal_name', e.target.value)} className={inputCls} /></div>
        <div className="sm:col-span-2"><label className={lbl}>Nome Fantasia</label><input value={form.trade_name || ''} onChange={(e) => set('trade_name', e.target.value)} className={inputCls} /></div>
        <div><label className={lbl}>Regime tributário</label><GlassSelect value={form.tax_regime || ''} onChange={(v) => set('tax_regime', v)} options={[{ value: 'simples', label: 'Simples Nacional' }, { value: 'presumido', label: 'Lucro Presumido' }, { value: 'real', label: 'Lucro Real' }]} /></div>
        <div><label className={lbl}>Série NFC-e</label><input value={form.nfce_series || '1'} onChange={(e) => set('nfce_series', e.target.value)} className={inputCls} /></div>
        <div><label className={lbl}>NCM padrão</label><input value={form.default_ncm || ''} onChange={(e) => set('default_ncm', e.target.value)} className={inputCls} /></div>
        <div><label className={lbl}>CFOP padrão</label><input value={form.default_cfop || ''} onChange={(e) => set('default_cfop', e.target.value)} className={inputCls} /></div>
        <label className="sm:col-span-2 flex items-center gap-2 text-sm text-admin-muted/70"><input type="checkbox" checked={!!form.enabled} onChange={(e) => set('enabled', e.target.checked)} className="accent-admin-champ" />Emissão fiscal ativa (exige gateway + FISCAL_API_KEY configurados)</label>
      </div>
      <button onClick={save} className="mt-4 bg-admin-champ/15 text-admin-champ px-6 py-2.5 rounded-xl text-sm hover:bg-admin-champ/25">Salvar configuração</button>
    </div>
  )
}

export function FiscalPanel({ notify }) {
  return (
    <ResourceTabs title="Emissão Fiscal" subtitle="NFC-e / NF-e / SAT — documentos e configuração do gateway"
      tabs={[
        { key: 'docs', label: 'Documentos', render: () => <DocsTab /> },
        { key: 'config', label: 'Configuração', render: () => <ConfigTab notify={notify} /> },
      ]}
    />
  )
}
