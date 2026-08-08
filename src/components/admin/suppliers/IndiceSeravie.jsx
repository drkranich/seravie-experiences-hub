import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'

// Índice Seravie — score 0–100 do fornecedor calculado no banco (função
// public.indice_seravie). Componente busca e exibe; variação `compact` para
// cards do diretório e `full` para o perfil (com breakdown).

const cacheMap = new Map()

export function useIndiceSeravie(supplierId) {
  const [data, setData] = useState(supplierId && cacheMap.get(supplierId) || null)
  useEffect(() => {
    if (!supplierId) return
    if (cacheMap.has(supplierId)) { setData(cacheMap.get(supplierId)); return }
    let alive = true
    supabase.rpc('indice_seravie', { sup_id: supplierId }).then(({ data: rows }) => {
      const row = Array.isArray(rows) ? rows[0] : rows
      if (alive && row) { cacheMap.set(supplierId, row); setData(row) }
    })
    return () => { alive = false }
  }, [supplierId])
  return data
}

const tier = (score) => score >= 80 ? { label: 'Excelência', c: 'text-admin-sage', ring: 'ring-admin-sage/40', bg: 'bg-admin-sage/10' }
  : score >= 60 ? { label: 'Consolidado', c: 'text-admin-champ', ring: 'ring-admin-champ/40', bg: 'bg-admin-champ/10' }
    : score >= 40 ? { label: 'Em ascensão', c: 'text-admin-gold', ring: 'ring-admin-gold/40', bg: 'bg-admin-gold/10' }
      : { label: 'Inicial', c: 'text-admin-muted/60', ring: 'ring-white/10', bg: 'bg-white/[0.04]' }

export function IndiceBadge({ supplierId, score: scoreProp }) {
  const data = useIndiceSeravie(scoreProp == null ? supplierId : null)
  const score = scoreProp != null ? scoreProp : data?.score
  if (score == null) return null
  const t = tier(score)
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg ring-1 ${t.ring} ${t.bg} ${t.c}`} title={`Índice Seravie: ${score}/100 · ${t.label}`}>
      <Icon name="spark" className="w-3 h-3" />Índice {score}
    </span>
  )
}

const LABELS = { avaliacoes: 'Avaliações', homologacao: 'Homologação', resposta_rfq: 'Resposta a cotações', catalogo: 'Catálogo', atividade: 'Atividade recente' }
const MAX = { avaliacoes: 35, homologacao: 20, resposta_rfq: 20, catalogo: 15, atividade: 10 }

export function IndiceCard({ supplierId }) {
  const data = useIndiceSeravie(supplierId)
  if (!data) return <div className="glass rounded-2xl h-40 animate-pulse opacity-40" />
  const t = tier(data.score)
  const bd = data.breakdown || {}
  const circ = 2 * Math.PI * 34
  const off = circ * (1 - data.score / 100)
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" strokeWidth="6" strokeLinecap="round" className={t.c} stroke="currentColor" strokeDasharray={circ} strokeDashoffset={off} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="font-serif text-xl text-admin-text">{data.score}</span><span className="text-[8px] uppercase tracking-wider text-admin-muted/40">/100</span></div>
        </div>
        <div>
          <div className="flex items-center gap-1.5"><Icon name="spark" className={`w-4 h-4 ${t.c}`} /><p className="text-admin-text text-sm font-medium">Índice Seravie</p></div>
          <p className={`text-xs mt-0.5 ${t.c}`}>{t.label}</p>
          <p className="text-admin-muted/45 text-[11px] mt-1">{data.rating_avg > 0 ? `★ ${data.rating_avg} · ${data.reviews_count} avaliações` : 'Sem avaliações ainda'}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
        {Object.keys(LABELS).map((k) => { const val = Number(bd[k]) || 0; const max = MAX[k]; return (
          <div key={k}>
            <div className="flex items-center justify-between text-[11px] mb-0.5"><span className="text-admin-muted/55">{LABELS[k]}</span><span className="text-admin-muted/40">{val}/{max}</span></div>
            <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden"><div className={`h-full ${t.c}`} style={{ width: `${(val / max) * 100}%`, backgroundColor: 'currentColor' }} /></div>
          </div>
        )})}
      </div>
    </div>
  )
}
