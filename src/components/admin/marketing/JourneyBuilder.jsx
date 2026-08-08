import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'
import {
  NODE_TYPES, ADDABLE_NODES, CHANNELS, WAIT_UNITS, CONDITION_FIELDS, REWARD_TYPES,
  TRIGGER_OPTIONS, makeNode, nodeById, outPorts, validateJourney, nodeSummary,
} from '../../../lib/journeys'

const NODE_W = 190
const NODE_H = 76

// paleta de cores por token (literais p/ Tailwind purge)
const COLOR = {
  champ: { bg: 'bg-admin-champ/12', br: 'border-admin-champ/35', text: 'text-admin-champ', stroke: '#DCCBA7' },
  gold: { bg: 'bg-admin-gold/12', br: 'border-admin-gold/35', text: 'text-admin-gold', stroke: '#B89C61' },
  sage: { bg: 'bg-admin-sage/12', br: 'border-admin-sage/35', text: 'text-admin-sage', stroke: '#55634D' },
  copper: { bg: 'bg-admin-copper/12', br: 'border-admin-copper/35', text: 'text-admin-copper', stroke: '#C1835B' },
  rose: { bg: 'bg-admin-rose/12', br: 'border-admin-rose/35', text: 'text-admin-rose', stroke: '#B7745E' },
}

// Construtor visual de jornada. `journey` traz {id,name,steps,...}. onBack volta à lista.
export function JourneyBuilder({ journey, coupons = [], tenantId, notify, onBack, onSaved }) {
  const [name, setName] = useState(journey.name || 'Nova jornada')
  const [nodes, setNodes] = useState(() => Array.isArray(journey.steps) && journey.steps.length ? journey.steps.map(normNode) : [makeNode('trigger', 60, 200, 0)])
  const [selected, setSelected] = useState(null)     // id do nó selecionado
  const [linking, setLinking] = useState(null)       // {from, port} quando ligando portas
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [seq, setSeq] = useState(100)                 // gerador de ids incremental
  const [busy, setBusy] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const canvasRef = useRef(null)
  const drag = useRef(null)                           // {id, dx, dy} arrastando nó
  const panning = useRef(null)                        // {x,y} arrastando fundo

  const couponCode = (id) => coupons.find((c) => c.id === id)?.code
  const sel = selected ? nodeById(nodes, selected) : null

  // ---- arrastar nós / pan ----
  const onMouseMove = useCallback((e) => {
    if (drag.current) {
      const { id, dx, dy } = drag.current
      setNodes((ns) => ns.map((n) => n.id === id ? { ...n, x: (e.clientX - dx - pan.x), y: (e.clientY - dy - pan.y) } : n))
    } else if (panning.current) {
      setPan({ x: e.clientX - panning.current.x, y: e.clientY - panning.current.y })
    }
  }, [pan])
  const onMouseUp = useCallback(() => { drag.current = null; panning.current = null }, [])
  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [onMouseMove, onMouseUp])

  const startDragNode = (e, n) => {
    if (linking) return
    e.stopPropagation()
    drag.current = { id: n.id, dx: e.clientX - n.x - pan.x, dy: e.clientY - n.y - pan.y }
    setSelected(n.id)
  }
  const startPan = (e) => { if (e.target === canvasRef.current || e.target.dataset.bg) { panning.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; setSelected(null) } }

  // ---- adicionar / remover nós ----
  const addNode = (type) => {
    const id = seq
    setSeq((s) => s + 1)
    const nn = makeNode(type, 200 - pan.x + Math.min(nodes.length * 20, 200), 340 - pan.y, id)
    setNodes((ns) => [...ns, nn])
    setSelected(nn.id)
    setShowPalette(false)
  }
  const removeNode = (id) => {
    setNodes((ns) => ns.filter((n) => n.id !== id).map((n) => ({
      ...n,
      next: n.next === id ? null : n.next,
      yes: n.yes === id ? null : n.yes,
      no: n.no === id ? null : n.no,
    })))
    setSelected(null)
  }

  // ---- ligar portas ----
  const clickPort = (e, fromId, port) => {
    e.stopPropagation()
    setLinking({ from: fromId, port })
  }
  const clickNodeAsTarget = (e, targetId) => {
    if (!linking) return
    e.stopPropagation()
    if (linking.from === targetId) { setLinking(null); return }
    setNodes((ns) => ns.map((n) => n.id === linking.from ? { ...n, [linking.port]: targetId } : n))
    setLinking(null)
  }
  const clearPort = (fromId, port) => setNodes((ns) => ns.map((n) => n.id === fromId ? { ...n, [port]: null } : n))

  const updateConfig = (patch) => setNodes((ns) => ns.map((n) => n.id === selected ? { ...n, config: { ...n.config, ...patch } } : n))

  // ---- salvar ----
  const save = async () => {
    const warns = validateJourney(nodes)
    setBusy(true)
    try {
      const trigger = nodes.find((n) => n.type === 'trigger')
      const payload = { name: name.trim() || 'Jornada', steps: nodes, trigger_event: trigger?.config?.event || null, updated_at: new Date().toISOString() }
      let error
      if (journey.id) { const r = await supabase.from('marketing_journeys').update(payload).eq('id', journey.id); error = r.error }
      else { const r = await supabase.from('marketing_journeys').insert({ ...payload, tenant_id: tenantId, status: 'draft' }); error = r.error }
      if (error) throw error
      notify(warns.length ? `Salvo (com ${warns.length} aviso${warns.length > 1 ? 's' : ''})` : 'Jornada salva', warns.length ? 'info' : 'success')
      onSaved && onSaved()
    } catch (e) { notify('Erro ao salvar: ' + (e.message || e), 'error') } finally { setBusy(false) }
  }

  const warns = validateJourney(nodes)

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[32rem]">
      {/* Barra superior */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <button onClick={onBack} className="text-admin-muted hover:text-admin-text flex items-center gap-1.5 text-sm"><Icon name="up" className="w-4 h-4 -rotate-90" />Voltar</button>
        <input value={name} onChange={(e) => setName(e.target.value)} className="glass-input rounded-xl px-4 py-2 text-sm text-admin-text outline-none flex-1 min-w-[12rem] max-w-md" placeholder="Nome da jornada" />
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setShowPalette((s) => !s)} className="flex items-center gap-1.5 text-sm bg-white/[0.05] hover:bg-white/[0.08] text-admin-text px-3 py-2 rounded-xl transition-colors"><Icon name="plus" className="w-4 h-4" />Adicionar passo</button>
          <button disabled={busy} onClick={save} className="flex items-center gap-1.5 text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl transition-colors disabled:opacity-50"><Icon name="check" className="w-4 h-4" />{busy ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>

      {warns.length > 0 && (
        <div className="glass-soft rounded-lg px-3 py-2 mb-3 flex items-center gap-2 bg-admin-gold/[0.05] border border-admin-gold/20">
          <Icon name="spark" className="w-3.5 h-3.5 text-admin-gold/80 shrink-0" />
          <p className="text-admin-gold/80 text-xs">{warns[0]}{warns.length > 1 ? ` (+${warns.length - 1})` : ''}</p>
        </div>
      )}

      <div className="flex-1 flex gap-3 min-h-0">
        {/* CANVAS */}
        <div className="relative flex-1 glass-soft rounded-2xl overflow-hidden">
          {linking && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-admin-champ/15 text-admin-champ text-xs px-3 py-1.5 rounded-lg border border-admin-champ/30">
              Clique no passo de destino · <button onClick={() => setLinking(null)} className="underline">cancelar</button>
            </div>
          )}
          <div
            ref={canvasRef}
            data-bg="1"
            onMouseDown={startPan}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px', backgroundPosition: `${pan.x}px ${pan.y}px` }}
          >
            {/* conexões (SVG) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="rgba(220,203,167,0.6)" /></marker>
              </defs>
              {nodes.flatMap((n) => outPorts(n).filter((p) => p.target).map((p) => {
                const to = nodeById(nodes, p.target)
                if (!to) return null
                const x1 = n.x + pan.x + NODE_W, y1 = n.y + pan.y + NODE_H / 2
                const x2 = to.x + pan.x, y2 = to.y + pan.y + NODE_H / 2
                const mx = (x1 + x2) / 2
                const col = n.type === 'condition' ? (p.key === 'yes' ? '#55634D' : '#B7745E') : 'rgba(220,203,167,0.5)'
                return (
                  <g key={n.id + p.key}>
                    <path d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`} fill="none" stroke={col} strokeWidth="2" markerEnd="url(#arrow)" />
                    {n.type === 'condition' && <text x={x1 + 8} y={y1 - 4} fill={col} fontSize="10">{p.label}</text>}
                  </g>
                )
              }))}
            </svg>

            {/* nós */}
            {nodes.map((n) => {
              const meta = NODE_TYPES[n.type]
              const col = COLOR[meta.color]
              const isSel = selected === n.id
              const isLinkTarget = linking && linking.from !== n.id
              return (
                <div
                  key={n.id}
                  onMouseDown={(e) => startDragNode(e, n)}
                  onClick={(e) => { if (linking) clickNodeAsTarget(e, n.id); else { e.stopPropagation(); setSelected(n.id) } }}
                  className={`absolute rounded-xl border ${col.bg} ${isSel ? 'border-admin-champ ring-1 ring-admin-champ/40' : col.br} ${isLinkTarget ? 'ring-2 ring-admin-champ/50 cursor-pointer' : 'cursor-grab'} transition-shadow`}
                  style={{ left: n.x + pan.x, top: n.y + pan.y, width: NODE_W, height: NODE_H }}
                >
                  <div className="flex items-center gap-2 px-3 pt-2">
                    <Icon name={meta.icon} className={`w-4 h-4 ${col.text}`} />
                    <span className={`text-xs font-medium ${col.text}`}>{meta.label}</span>
                    {n.type !== 'trigger' && <button onClick={(e) => { e.stopPropagation(); removeNode(n.id) }} className="ml-auto text-admin-muted/40 hover:text-admin-rose"><Icon name="x" className="w-3 h-3" /></button>}
                  </div>
                  <p className="px-3 pt-1 text-[11px] text-admin-muted/70 truncate">{nodeSummary(n, { couponCode: couponCode(n.config?.couponId) })}</p>

                  {/* portas de saída */}
                  <div className="absolute -right-2 top-0 h-full flex flex-col justify-center gap-1">
                    {outPorts(n).map((p, i) => (
                      <button
                        key={p.key}
                        title={p.label ? `Ligar ramo "${p.label}"` : 'Ligar ao próximo'}
                        onClick={(e) => p.target ? clearPort(n.id, p.key) : clickPort(e, n.id, p.key)}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-[7px] ${p.target ? 'bg-admin-champ border-admin-champ text-admin-bg' : 'bg-admin-side border-admin-champ/50 hover:border-admin-champ'}`}
                        style={{ marginTop: outPorts(n).length > 1 ? (i === 0 ? '-4px' : '4px') : 0 }}
                      >{n.type === 'condition' ? (p.key === 'yes' ? 'S' : 'N') : ''}</button>
                    ))}
                  </div>
                  {/* porta de entrada (visual) */}
                  {n.type !== 'trigger' && <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-admin-side border-2 border-admin-muted/30" />}
                </div>
              )
            })}
          </div>

          {/* Paleta flutuante */}
          {showPalette && (
            <div className="absolute top-14 right-3 z-30 glass-pop rounded-xl p-2 w-52 space-y-1">
              <p className="text-[9px] uppercase tracking-wider text-admin-muted/40 px-2 py-1">Adicionar passo</p>
              {ADDABLE_NODES.map((n) => {
                const col = COLOR[n.color]
                return (
                  <button key={n.type} onClick={() => addNode(n.type)} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.05] transition-colors text-left">
                    <div className={`w-7 h-7 rounded-lg ${col.bg} flex items-center justify-center shrink-0`}><Icon name={n.icon} className={`w-3.5 h-3.5 ${col.text}`} /></div>
                    <div className="min-w-0"><p className="text-admin-text text-xs">{n.label}</p><p className="text-admin-muted/40 text-[10px] truncate">{n.desc}</p></div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* PAINEL DE EDIÇÃO */}
        <div className="w-72 glass-soft rounded-2xl p-4 overflow-y-auto shrink-0">
          {!sel ? (
            <div className="text-center py-10">
              <Icon name="layers" className="w-8 h-8 text-admin-champ/25 mx-auto mb-2" />
              <p className="text-admin-muted/50 text-xs leading-relaxed">Selecione um passo para editar, ou arraste os cards no canvas. Use as bolinhas à direita de cada card para conectar.</p>
            </div>
          ) : (
            <NodeEditor node={sel} coupons={coupons} onChange={updateConfig} />
          )}
        </div>
      </div>
    </div>
  )
}

// normaliza um step vindo do banco (garante campos)
function normNode(n) {
  return { id: n.id, type: n.type, x: Number(n.x) || 0, y: Number(n.y) || 0, config: n.config || {}, next: n.next ?? null, yes: n.yes ?? null, no: n.no ?? null }
}

function NodeEditor({ node, coupons, onChange }) {
  const meta = NODE_TYPES[node.type]
  const c = node.config || {}
  const Label = ({ children }) => <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{children}</label>
  return (
    <div>
      <div className="flex items-center gap-2 mb-4"><Icon name={meta.icon} className={`w-4 h-4 ${COLOR[meta.color].text}`} /><p className="text-admin-text text-sm font-medium">{meta.label}</p></div>
      <div className="space-y-4">
        {node.type === 'trigger' && (
          <div><Label>Evento que inicia</Label><GlassSelect value={c.event} onChange={(v) => onChange({ event: v })} options={TRIGGER_OPTIONS} /></div>
        )}
        {node.type === 'wait' && (
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Quantidade</Label><input type="number" min="0" value={c.amount} onChange={(e) => onChange({ amount: Number(e.target.value) })} className="w-full glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" /></div>
            <div><Label>Unidade</Label><GlassSelect value={c.unit} onChange={(v) => onChange({ unit: v })} options={WAIT_UNITS} /></div>
          </div>
        )}
        {node.type === 'message' && (
          <>
            <div><Label>Canal</Label><GlassSelect value={c.channel} onChange={(v) => onChange({ channel: v })} options={CHANNELS} /></div>
            {c.channel === 'email' && <div><Label>Assunto</Label><input value={c.subject || ''} onChange={(e) => onChange({ subject: e.target.value })} className="w-full glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" /></div>}
            <div><Label>Mensagem</Label><textarea value={c.message || ''} onChange={(e) => onChange({ message: e.target.value })} rows={5} className="w-full glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none resize-none" placeholder="Use {nome} para personalizar." /></div>
          </>
        )}
        {node.type === 'condition' && (
          <>
            <div><Label>Se o contato…</Label><GlassSelect value={c.field} onChange={(v) => onChange({ field: v })} options={CONDITION_FIELDS} /></div>
            {c.field === 'ltv_gt' && <div><Label>LTV maior que (R$)</Label><input type="number" value={c.value || ''} onChange={(e) => onChange({ value: e.target.value })} className="w-full glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" /></div>}
            <p className="text-admin-muted/40 text-[11px] leading-relaxed">Conecte a saída <span className="text-admin-sage">S</span> (sim) e <span className="text-admin-rose">N</span> (não) a passos diferentes.</p>
          </>
        )}
        {node.type === 'reward' && (
          <>
            <div><Label>Tipo</Label><GlassSelect value={c.reward} onChange={(v) => onChange({ reward: v })} options={REWARD_TYPES} /></div>
            {c.reward === 'coupon'
              ? <div><Label>Cupom</Label><GlassSelect value={c.couponId || ''} onChange={(v) => onChange({ couponId: v })} options={[{ value: '', label: 'Selecione…' }, ...coupons.filter((x) => x.is_active).map((x) => ({ value: x.id, label: x.code }))]} /></div>
              : <div><Label>Pontos a creditar</Label><input type="number" value={c.points || 0} onChange={(e) => onChange({ points: Number(e.target.value) })} className="w-full glass-input rounded-xl px-3 py-2 text-sm text-admin-text outline-none" /></div>}
          </>
        )}
      </div>
    </div>
  )
}
