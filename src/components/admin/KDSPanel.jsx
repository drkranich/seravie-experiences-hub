import { useState, useEffect, useRef } from 'react'
import { Icon, GlassSelect } from './ui'
import { getPreset } from '../../lib/flowEngine'
import { DEFAULT_SOUND, SOUND_EVENTS, playSound } from '../../lib/kdsSound'
import { KdsDashboard } from './kds/KdsDashboard'
import { KdsBoard } from './kds/KdsBoard'
import { KdsStations } from './kds/KdsStations'
import { KdsKitchenMap } from './kds/KdsKitchenMap'
import { KdsAnalytics } from './kds/KdsAnalytics'
import { KdsAssistant } from './kds/KdsAssistant'
import { KdsHistory } from './kds/KdsHistory'
import { KdsTeam } from './kds/KdsTeam'
import { KdsMenu } from './kds/KdsMenu'
import { KdsQueues } from './kds/KdsQueues'
import { KdsPDV } from './kds/KdsPDV'

// Painel de configuração de sons por evento (popover).
function SoundPanel({ sound, setSound, onClose }) {
  const upd = (patch) => setSound((s) => ({ ...s, ...patch }))
  const updEvent = (k, v) => setSound((s) => ({ ...s, events: { ...s.events, [k]: v } }))
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-end p-4" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-5 w-72 mt-16 mr-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><p className="text-admin-text font-medium text-sm">Sons</p><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-4 h-4" /></button></div>
        <label className="flex items-center justify-between mb-3"><span className="text-sm text-admin-muted">Sons ligados</span><input type="checkbox" checked={sound.enabled} onChange={(e) => upd({ enabled: e.target.checked })} className="accent-admin-champ w-4 h-4" /></label>
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1.5">Volume</p>
          <input type="range" min="0" max="1" step="0.1" value={sound.volume} onChange={(e) => upd({ volume: Number(e.target.value) })} className="w-full accent-admin-champ" />
        </div>
        <div className="space-y-2 border-t border-white/[0.06] pt-3">
          {SOUND_EVENTS.map((ev) => (
            <div key={ev.key} className="flex items-center justify-between">
              <span className="text-sm text-admin-muted">{ev.label}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => playSound(ev.key, sound)} className="text-admin-champ/70 hover:text-admin-champ" title="Testar"><Icon name="play" className="w-3.5 h-3.5" /></button>
                <input type="checkbox" checked={sound.events[ev.key] !== false} onChange={(e) => updEvent(ev.key, e.target.checked)} disabled={!sound.enabled} className="accent-admin-champ w-4 h-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Relógio grande do modo TV.
function TvClock() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => { const iv = setInterval(() => setT(new Date()), 1000); return () => clearInterval(iv) }, [])
  return <span className="tabular-nums text-admin-champ text-2xl font-serif">{String(t.getHours()).padStart(2, '0')}:{String(t.getMinutes()).padStart(2, '0')}<span className="text-admin-muted/40 text-lg">:{String(t.getSeconds()).padStart(2, '0')}</span></span>
}

// Modo TV / Produção — tela cheia sem sidebar/menus. Só filas, timers e relógio.
// Mantém um atalho discreto para criar pedido (útil em balcão/quiosque touch).
function TvMode({ kind, sound, onExit, notify }) {
  const [counts, setCounts] = useState({ active: 0, late: 0, total: 0 })
  const newRef = useRef(null)
  const preset = getPreset(kind)
  return (
    <div className="fixed inset-0 z-[100] bg-admin-bg overflow-hidden flex flex-col p-4"
      style={{ backgroundImage: 'radial-gradient(60% 40% at 80% 0%, rgba(220,203,167,0.06), transparent 60%)' }}>
      <div className="flex items-center justify-between mb-4 px-2 shrink-0">
        <div className="flex items-center gap-3">
          <Icon name="flame" className="w-6 h-6 text-admin-champ" />
          <h1 className="font-serif text-2xl text-admin-text">{preset.label} · Produção</h1>
          <span className="text-admin-muted/50 text-sm">{counts.active} ativos{counts.late > 0 ? ` · ${counts.late} atrasados` : ''}</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => newRef.current && newRef.current()} className="flex items-center gap-2 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ text-sm rounded-xl px-3 py-2"><Icon name="plus" className="w-4 h-4" />Novo pedido</button>
          <TvClock />
          <button onClick={onExit} className="flex items-center gap-2 text-admin-muted/70 hover:text-admin-text text-sm border border-white/10 rounded-xl px-3 py-2"><Icon name="x" className="w-4 h-4" />Sair</button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <KdsBoard kind={kind} tv sound={sound} onCounts={setCounts} notify={notify} registerNew={(fn) => { newRef.current = fn }} />
      </div>
    </div>
  )
}

export function KDSPanel({ notify }) {
  const [tab, setTab] = useState('dashboard')
  const [tv, setTv] = useState(false)
  const [touch, setTouch] = useState(false)
  const [sound, setSound] = useState(DEFAULT_SOUND)
  const [soundPanel, setSoundPanel] = useState(false)
  const [counts, setCounts] = useState({ active: 0, late: 0, total: 0 })
  const newTicketRef = useRef(null) // função que abre o editor de novo pedido no board
  const kind = 'kitchen'
  const preset = getPreset(kind)

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: 'chart' },
    { key: 'pdv', label: 'PDV', icon: 'cart' },
    { key: 'production', label: 'Produção', icon: 'flame' },
    { key: 'queues', label: 'Filas', icon: 'layers' },
    { key: 'map', label: 'Mapa da Cozinha', icon: 'map' },
    { key: 'stations', label: 'Estações', icon: 'grid' },
    { key: 'menu', label: 'Cardápios', icon: 'book' },
    { key: 'team', label: 'Equipe', icon: 'users' },
    { key: 'assistant', label: 'IA', icon: 'sparkles' },
    { key: 'analytics', label: 'Analytics', icon: 'chart' },
    { key: 'history', label: 'Histórico', icon: 'clock' },
  ]

  if (tv) return <TvMode kind={kind} sound={sound} onExit={() => setTv(false)} notify={notify} />

  return (
    <div>
      {/* Cabeçalho do módulo */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">KDS · Kitchen Flow</h1>
          <p className="text-admin-muted/60 text-sm mt-1">produção em tempo real · movido pelo Experience Flow Engine</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setTouch((v) => !v)} title="Modo touch (botões grandes)" className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${touch ? 'border-admin-champ/25 text-admin-champ bg-admin-champ/10' : 'border-white/10 text-admin-muted/50'}`}>
            <Icon name="grip" className="w-4 h-4" />Touch
          </button>
          <button onClick={() => setSoundPanel(true)} title="Configurar sons" className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${sound.enabled ? 'border-admin-champ/25 text-admin-champ' : 'border-white/10 text-admin-muted/50'}`}>
            <Icon name="bell" className="w-4 h-4" />{sound.enabled ? 'Som' : 'Mudo'}
          </button>
          <button onClick={() => setTv(true)} className="flex items-center gap-2 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors">
            <Icon name="tv" className="w-4 h-4" />Modo Produção
          </button>
        </div>
      </div>
      {soundPanel && <SoundPanel sound={sound} setSound={setSound} onClose={() => setSoundPanel(false)} />}

      {/* Abas do módulo */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${tab === t.key ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>
            <Icon name={t.icon} className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <KdsDashboard kind={kind} />}
      {tab === 'pdv' && <KdsPDV kind={kind} notify={notify} />}
      {tab === 'production' && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="text-admin-muted/50 text-sm">{counts.active} {preset.unitPlural} ativos{counts.late > 0 ? ` · ${counts.late} atrasados` : ''}</p>
            <div className="flex items-center gap-3">
              <p className="text-admin-muted/40 text-xs hidden sm:block">{touch ? 'modo touch · botões grandes' : 'arraste os cartões entre as colunas'}</p>
              <button onClick={() => newTicketRef.current && newTicketRef.current()} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Novo pedido</button>
            </div>
          </div>
          <KdsBoard kind={kind} sound={sound} touch={touch} onCounts={setCounts} notify={notify} registerNew={(fn) => { newTicketRef.current = fn }} />
        </div>
      )}
      {tab === 'queues' && <KdsQueues kind={kind} />}
      {tab === 'map' && <KdsKitchenMap kind={kind} />}
      {tab === 'stations' && <KdsStations notify={notify} kind={kind} />}
      {tab === 'menu' && <KdsMenu kind={kind} notify={notify} />}
      {tab === 'team' && <KdsTeam kind={kind} notify={notify} />}
      {tab === 'assistant' && <KdsAssistant kind={kind} />}
      {tab === 'analytics' && <KdsAnalytics kind={kind} />}
      {tab === 'history' && <KdsHistory kind={kind} />}
    </div>
  )
}
