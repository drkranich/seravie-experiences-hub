import { Icon } from '../ui'
import { GRAPH_KIND, buildGraph, copilotBrief } from '../../../lib/relationships'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
const COL = {
  champ: { stroke: '#DCCBA7', bg: 'bg-admin-champ/12', text: 'text-admin-champ', ring: 'ring-admin-champ/30' },
  sage: { stroke: '#55634D', bg: 'bg-admin-sage/12', text: 'text-admin-sage', ring: 'ring-admin-sage/30' },
  gold: { stroke: '#B89C61', bg: 'bg-admin-gold/12', text: 'text-admin-gold', ring: 'ring-admin-gold/30' },
  copper: { stroke: '#C1835B', bg: 'bg-admin-copper/12', text: 'text-admin-copper', ring: 'ring-admin-copper/30' },
  rose: { stroke: '#B7745E', bg: 'bg-admin-rose/12', text: 'text-admin-rose', ring: 'ring-admin-rose/30' },
}
const ICON = { order: 'cart', deal: 'chart', quote: 'tag', project: 'layers', document: 'book', ticket: 'check', person: 'user', loyalty: 'gift' }

// Experience Graph — grafo radial da entidade e suas conexões no ecossistema.
export function RelationshipGraph({ contact, data }) {
  const { center, cats } = buildGraph(contact, data)
  if (cats.length === 0) return (
    <div className="glass rounded-2xl p-10 text-center"><Icon name="spark" className="w-8 h-8 text-admin-champ/25 mx-auto mb-2" /><p className="text-admin-muted/40 text-sm">Ainda sem conexões para desenhar o grafo.</p></div>
  )

  // layout radial
  const W = 640, H = 380, cx = W / 2, cy = H / 2, R = 135
  const nodes = cats.map((c, i) => {
    const ang = (i / cats.length) * Math.PI * 2 - Math.PI / 2
    return { ...c, x: cx + Math.cos(ang) * R, y: cy + Math.sin(ang) * R }
  })

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2 px-1"><Icon name="spark" className="w-4 h-4 text-admin-champ/60" /><p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Experience Graph</p></div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 480 }}>
          {/* arestas */}
          {nodes.map((n) => {
            const col = COL[GRAPH_KIND[n.kind]?.color] || COL.champ
            return <line key={'l' + n.id} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={col.stroke} strokeOpacity="0.35" strokeWidth="2" />
          })}
          {/* nó central */}
          <circle cx={cx} cy={cy} r="46" fill="rgba(220,203,167,0.10)" stroke="#DCCBA7" strokeOpacity="0.5" strokeWidth="2" />
          <text x={cx} y={cy - 2} textAnchor="middle" fill="#EEE" fontSize="13" fontFamily="Georgia, serif">{(center.label || '').slice(0, 14)}</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="#999" fontSize="9">entidade</text>
          {/* nós categoria */}
          {nodes.map((n) => {
            const col = COL[GRAPH_KIND[n.kind]?.color] || COL.champ
            return (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r="34" fill={col.stroke} fillOpacity="0.14" stroke={col.stroke} strokeOpacity="0.5" strokeWidth="1.5" />
                <text x={n.x} y={n.y - 4} textAnchor="middle" fill={col.stroke} fontSize="16" fontFamily="Georgia, serif">{n.count}</text>
                <text x={n.x} y={n.y + 10} textAnchor="middle" fill="#bbb" fontSize="8">{n.label}</text>
                {n.value > 0 && <text x={n.x} y={n.y + 48} textAnchor="middle" fill="#888" fontSize="8">{brl(n.value)}</text>}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// IA Copilot — resumo, últimos assuntos, próximos passos, oportunidades e riscos.
export function CopilotPanel({ contact, data, summary }) {
  const b = copilotBrief(contact, data, summary)
  const Block = ({ icon, title, items, tone }) => {
    const c = COL[tone] || COL.champ
    return (
      <div className="glass-soft rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2"><Icon name={icon} className={`w-3.5 h-3.5 ${c.text}`} /><p className="text-[10px] uppercase tracking-wider text-admin-muted/50">{title}</p></div>
        <ul className="space-y-1.5">
          {items.map((it, i) => <li key={i} className="text-admin-muted/70 text-xs leading-relaxed flex gap-1.5"><span className={c.text}>•</span><span>{it}</span></li>)}
        </ul>
      </div>
    )
  }
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3"><Icon name="spark" className="w-4 h-4 text-admin-champ/70" /><p className="text-[11px] tracking-wider uppercase text-admin-champ/70">IA Copilot deste cliente</p></div>
      <p className="text-admin-text/90 text-sm leading-relaxed mb-4">{b.resumo}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {b.ultimos.length > 0 && <Block icon="clock" title="Últimos assuntos" items={b.ultimos} tone="champ" />}
        <Block icon="check" title="Próximos passos" items={b.passos} tone="sage" />
        <Block icon="chart" title="Oportunidades" items={b.oportunidades} tone="gold" />
        <Block icon="spark" title="Riscos" items={b.riscos} tone="rose" />
      </div>
    </div>
  )
}
