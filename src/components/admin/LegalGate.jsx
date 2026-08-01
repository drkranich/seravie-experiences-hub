import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Icon } from './ui'

export const LEGAL_TYPES = {
  terms: 'Termos de Uso',
  privacy: 'Política de Privacidade',
  responsibility: 'Declaração de Responsabilidade',
}

/**
 * useLegalGate — verifica quais documentos vigentes o usuário ainda não aceitou.
 * Retorna { pending, docs, loading, recheck }.
 */
export function useLegalGate(docTypes = ['terms', 'privacy', 'responsibility']) {
  const { user } = useAuth()
  const [docs, setDocs] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  const check = async () => {
    setLoading(true)
    const { data: dd } = await supabase.from('legal_documents').select('*').in('doc_type', docTypes).eq('is_current', true).eq('status', 'published')
    const current = dd || []
    setDocs(current)
    if (!user || current.length === 0) { setPending([]); setLoading(false); return }
    const { data: acc } = await supabase.from('legal_acceptances').select('doc_type, doc_version').eq('user_id', user.id)
    const accepted = new Set((acc || []).map((a) => `${a.doc_type}@${a.doc_version}`))
    setPending(current.filter((d) => !accepted.has(`${d.doc_type}@${d.version}`)))
    setLoading(false)
  }
  useEffect(() => { check() }, [user?.id])
  return { pending, docs, loading, recheck: check }
}

/**
 * LegalGate — modal de aceite eletrônico. Recebe os documentos a aceitar e,
 * ao confirmar, chama a função legal-accept (que grava IP, user-agent, versão e assinatura).
 */
export function LegalGate({ docs = [], onAccept, onClose, notify }) {
  const [signature, setSignature] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [view, setView] = useState(null)
  const [busy, setBusy] = useState(false)

  const accept = async () => {
    if (!signature.trim()) return notify?.('Digite seu nome completo como assinatura eletrônica', 'error')
    if (!agreed) return notify?.('Marque que leu e concorda com os documentos', 'error')
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('legal-accept', {
      body: { signature_name: signature, documents: docs.map((d) => ({ doc_type: d.doc_type, doc_version: d.version })) },
    })
    setBusy(false)
    if (error || data?.error) return notify?.('Falha ao registrar o aceite: ' + (data?.error || error?.message), 'error')
    notify?.('Aceite registrado com sucesso', 'success')
    onAccept?.()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-7">
        {view ? (
          <div>
            <div className="flex items-center justify-between mb-4"><h2 className="font-serif text-xl text-admin-text">{view.title}</h2><button onClick={() => setView(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <p className="text-admin-muted/40 text-[11px] mb-3">Versão {view.version}{view.effective_date ? ` · vigente desde ${new Date(view.effective_date).toLocaleDateString('pt-BR')}` : ''}</p>
            <div className="text-admin-muted/70 text-sm whitespace-pre-wrap leading-relaxed">{view.content || 'Conteúdo do documento não informado.'}</div>
            <button onClick={() => setView(null)} className="mt-5 w-full bg-white/[0.05] text-admin-muted/80 py-2.5 rounded-xl text-sm">Voltar</button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2"><h2 className="font-serif text-2xl text-admin-text">Aceite eletrônico</h2>{onClose && <button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>}</div>
            <p className="text-admin-muted/50 text-sm mb-5">Para continuar, é necessário ler e aceitar os documentos abaixo. Registramos data, hora, versão do documento, IP e sua assinatura eletrônica.</p>
            <div className="space-y-2 mb-5">
              {docs.map((d) => (
                <button key={d.id} onClick={() => setView(d)} className="w-full flex items-center justify-between glass-soft rounded-xl px-4 py-3 text-left hover:bg-white/[0.04] transition-colors">
                  <div><p className="text-admin-text text-sm">{d.title}</p><p className="text-admin-muted/40 text-[11px]">{LEGAL_TYPES[d.doc_type] || d.doc_type} · versão {d.version}</p></div>
                  <span className="text-admin-champ text-xs flex items-center gap-1">Ler <Icon name="link" className="w-3.5 h-3.5" /></span>
                </button>
              ))}
            </div>
            <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="accent-admin-champ mt-0.5" />
              <span className="text-admin-muted/70 text-sm">Declaro que li e concordo com todos os documentos acima, e que as informações que forneço são verdadeiras.</span>
            </label>
            <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Assinatura eletrônica (seu nome completo)</label>
            <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Nome completo" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none mb-5" />
            <div className="flex gap-3">
              <button onClick={accept} disabled={busy} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{busy ? 'Registrando…' : 'Li e aceito'}</button>
              {onClose && <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Agora não</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
