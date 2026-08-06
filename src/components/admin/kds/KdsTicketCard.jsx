import { useState, useEffect } from 'react'
import { Icon } from '../ui'
import { timerBand, fmtMMSS, tagStyle, channelMeta, elapsedSeconds } from '../../../lib/flowEngine'

// Cronômetro grande do cartão — muda de cor sozinho conforme o tempo/SLA.
// Recebe `now` (epoch ms) da tela para todos baterem no mesmo tick de 1s.
export function KdsTimer({ since, slaSec, now, big = false }) {
  const elapsed = elapsedSeconds(since, now)
  const band = timerBand(elapsed, slaSec)
  const over = slaSec && elapsed >= slaSec
  return (
    <div className={`flex items-center gap-1.5 ${band.text} ${over ? 'animate-pulse' : ''}`}>
      <Icon name="clock" className={big ? 'w-5 h-5' : 'w-3.5 h-3.5'} />
      <span className={`tabular-nums font-medium ${big ? 'text-2xl' : 'text-sm'}`}>{fmtMMSS(elapsed)}</span>
    </div>
  )
}

// Cartão premium de um pedido/ticket na tela de produção.
export function TicketCard({ t, now, stage, onAdvance, onCancel, onDragStart, tv = false }) {
  const ch = channelMeta(t.channel)
  const items = Array.isArray(t.items) ? t.items : []
  const obs = items.filter((i) => i.notes).map((i) => i.notes)
  const accent = stage?.accent || 'champ'
  const accentBorder = {
    champ: 'border-admin-champ/30', copper: 'border-admin-copper/40', gold: 'border-admin-gold/40',
    sage: 'border-admin-sage/40', rose: 'border-admin-rose/40', muted: 'border-white/10',
  }[accent] || 'border-white/10'

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={(e) => onDragStart && onDragStart(e, t)}
      className={`group relative rounded-2xl border ${accentBorder} bg-white/[0.03] backdrop-blur-sm ${tv ? 'p-4' : 'p-3.5'} transition-all hover:bg-white/[0.05] hover:-translate-y-0.5 ${onDragStart ? 'cursor-grab active:cursor-grabbing' : ''} animate-[fadeUp_0.4s_ease-out]`}
    >
      {/* topo: referência + canal + timer */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-serif ${tv ? 'text-2xl' : 'text-lg'} text-admin-text leading-none`}>{t.reference || '—'}</span>
            <span className="flex items-center gap-1 text-[10px] text-admin-muted/60 uppercase tracking-wider"><Icon name={ch.icon} className="w-3 h-3" />{ch.label}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-admin-muted/60">
            {t.table_label && t.table_label !== '—' && <span>{t.table_label}</span>}
            {t.customer_name && <span className="truncate">· {t.customer_name}</span>}
          </div>
        </div>
        <KdsTimer since={t.created_at} slaSec={t.sla_seconds} now={now} big={tv} />
      </div>

      {/* tags premium */}
      {Array.isArray(t.tags) && t.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {t.tags.map((tag) => (
            <span key={tag} className={`text-[9px] font-medium px-2 py-0.5 rounded-lg tracking-wide ${tagStyle(tag)}`}>{tag}</span>
          ))}
        </div>
      )}

      {/* itens */}
      <div className={`space-y-1 ${tv ? 'mb-3' : 'mb-2.5'}`}>
        {items.map((it, i) => (
          <div key={i} className={`flex items-baseline justify-between gap-2 ${tv ? 'text-base' : 'text-sm'}`}>
            <span className="text-admin-text/90"><span className={`text-admin-champ font-medium`}>{it.qty || 1}×</span> {it.name}</span>
          </div>
        ))}
      </div>

      {/* observações destacadas */}
      {(obs.length > 0 || t.notes) && (
        <div className="rounded-lg bg-[#D08A3E]/10 border border-[#D08A3E]/20 px-2.5 py-1.5 mb-2.5">
          <p className="text-[11px] text-[#D08A3E] leading-snug">{[t.notes, ...obs].filter(Boolean).join(' · ')}</p>
        </div>
      )}

      {/* ações (ocultas no modo TV) */}
      {!tv && (
        <div className="flex items-center gap-1.5">
          {stage && !stage.terminal && (
            <button onClick={() => onAdvance(t)} className="flex-1 text-xs py-2 rounded-xl bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25 transition-colors font-medium">
              {stage.key === 'queued' ? 'Iniciar' : stage.key === 'ready' ? 'Entregar' : 'Avançar'}
            </button>
          )}
          <button onClick={() => onCancel(t)} title="Cancelar" className="px-2.5 py-2 rounded-xl bg-white/[0.05] text-admin-muted/60 hover:text-admin-rose transition-colors"><Icon name="x" className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  )
}
