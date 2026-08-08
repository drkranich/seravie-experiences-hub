import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'
import { identitySignedUrl } from '../../lib/storage'

// Revisão de verificações de identidade (super admin). Lista as solicitações,
// abre os documentos por URL assinada temporária, e aprova/reprova. Ao aprovar,
// marca o membro/fornecedor como identity_verified.

const STATUS = {
  pendente: { label: 'Pendente', s: 'bg-white/[0.06] text-admin-muted/60' },
  em_analise: { label: 'Em análise', s: 'bg-admin-gold/15 text-admin-gold' },
  aprovado: { label: 'Aprovado', s: 'bg-admin-sage/15 text-admin-sage' },
  reprovado: { label: 'Reprovado', s: 'bg-admin-rose/15 text-admin-rose' },
}

export function IdentityReview({ notify }) {
  const { isSuperAdmin } = useTenant()
  const allowed = isSuperAdmin?.()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('em_analise')
  const [open, setOpen] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('identity_verifications').select('*').order('created_at', { ascending: false }).limit(200)
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const decide = async (row, status) => {
    const note = status === 'reprovado' ? (prompt('Motivo da reprovação (opcional):') || null) : null
    const { error } = await supabase.from('identity_verifications').update({ status, reviewer_note: note, reviewed_at: new Date().toISOString() }).eq('id', row.id)
    if (error) return notify?.('Erro: ' + error.message, 'error')
    // marca verificado nos perfis do tenant
    if (status === 'aprovado') {
      await Promise.all([
        supabase.from('network_members').update({ identity_verified: true }).eq('tenant_id', row.tenant_id),
        supabase.from('suppliers').update({ identity_verified: true }).eq('tenant_id', row.tenant_id),
        supabase.from('notifications').insert({ tenant_id: row.tenant_id, domain: 'network', kind: 'system', title: 'Identidade verificada ✓', body: 'Seu perfil agora exibe o selo de verificado.', icon: 'check', link_route: 'people' }),
      ])
    } else if (status === 'reprovado') {
      await supabase.from('notifications').insert({ tenant_id: row.tenant_id, domain: 'network', kind: 'system', title: 'Verificação não aprovada', body: note || 'Reenvie os documentos.', icon: 'warning', link_route: 'verify_identity' })
    }
    setRows((r) => r.map((x) => x.id === row.id ? { ...x, status, reviewer_note: note, reviewed_at: new Date().toISOString() } : x)); setOpen(null)
    notify?.(status === 'aprovado' ? 'Verificação aprovada' : 'Verificação reprovada', 'success')
  }

  if (!allowed) return <div className="glass rounded-2xl p-12 text-center"><Icon name="ghost" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Área exclusiva do super admin.</p></div>

  const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter)

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Verificações de identidade</h1><p className="text-admin-muted/50 text-sm mt-1">Analise as solicitações e aprove ou reprove a verificação orofacial + documento.</p></div>
        <div className="w-44"><GlassSelect value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todas' }, ...Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }))]} /></div>
      </div>

      {loading ? <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-2xl h-20 animate-pulse opacity-40" />)}</div>
        : shown.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="user" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Nenhuma verificação {filter !== 'all' ? 'neste status' : ''}.</p></div>
          : <div className="space-y-3">
              {shown.map((r) => { const st = STATUS[r.status] || STATUS.pendente; return (
                <button key={r.id} onClick={() => setOpen(r)} className="w-full text-left glass rounded-2xl p-4 hover:ring-1 hover:ring-admin-champ/30 transition-all flex items-center justify-between gap-4">
                  <div><p className="text-admin-text text-sm font-medium">{r.full_name || 'Sem nome'}</p><p className="text-admin-muted/45 text-xs">{r.doc_type?.toUpperCase()} · {new Date(r.created_at).toLocaleDateString('pt-BR')}</p></div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg ${st.s}`}>{st.label}</span>
                </button>
              )})}
            </div>}

      {open && <ReviewModal row={open} onClose={() => setOpen(null)} onDecide={decide} notify={notify} />}
    </div>
  )
}

function ReviewModal({ row, onClose, onDecide, notify }) {
  const [urls, setUrls] = useState({})
  useEffect(() => {
    (async () => {
      const out = {}
      for (const [k, path] of [['selfie', row.selfie_path], ['front', row.doc_front_path], ['back', row.doc_back_path]]) {
        if (path) { const { url } = await identitySignedUrl(path, 600); if (url) out[k] = url }
      }
      setUrls(out)
    })()
  }, [row.id])

  const st = STATUS[row.status] || STATUS.pendente
  const done = row.status === 'aprovado' || row.status === 'reprovado'

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-xl text-admin-text">Revisar verificação</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="mb-3"><p className="text-admin-text text-sm">{row.full_name}</p><p className="text-admin-muted/45 text-xs">{row.doc_type?.toUpperCase()} <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-lg ${st.s}`}>{st.label}</span></p></div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['selfie', 'front', 'back'].map((k) => (
            <div key={k} className="glass-input rounded-xl overflow-hidden aspect-square flex items-center justify-center">
              {urls[k] ? <a href={urls[k]} target="_blank" rel="noreferrer"><img src={urls[k]} alt={k} className="w-full h-full object-cover" /></a> : <Icon name={k === 'selfie' ? 'eye' : 'book'} className="w-5 h-5 text-admin-muted/30" />}
            </div>
          ))}
        </div>
        <p className="text-admin-muted/40 text-[10px] mb-4"><Icon name="warning" className="w-3 h-3 inline mr-1" />URLs temporárias (10 min). Compare o rosto da selfie com o documento antes de decidir.</p>
        {!done && (
          <div className="flex justify-end gap-2">
            <button onClick={() => onDecide(row, 'reprovado')} className="px-4 py-2 rounded-xl text-sm bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose">Reprovar</button>
            <button onClick={() => onDecide(row, 'aprovado')} className="px-4 py-2 rounded-xl text-sm bg-admin-sage/15 hover:bg-admin-sage/25 text-admin-sage">Aprovar verificação</button>
          </div>
        )}
      </div>
    </div>
  )
}
