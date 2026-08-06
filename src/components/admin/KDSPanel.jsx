import { useState, useEffect } from 'react'
import { Icon, GlassSelect } from './ui'
import { getPreset } from '../../lib/flowEngine'
import { KdsDashboard } from './kds/KdsDashboard'
import { KdsBoard } from './kds/KdsBoard'
import { KdsStations } from './kds/KdsStations'
import { KdsKitchenMap } from './kds/KdsKitchenMap'
import { KdsAnalytics } from './kds/KdsAnalytics'
import { KdsAssistant } from './kds/KdsAssistant'
import { KdsHistory } from './kds/KdsHistory'
import { KdsTeam } from './kds/KdsTeam'

// Relógio grande do modo TV.
function TvClock() {
  const [t, setT] = useState(() => new Date())
  useEffect(() => { const iv = setInterval(() => setT(new Date()), 1000); return () => clearInterval(iv) }, [])
  return <span className="tabular-nums text-admin-champ text-2xl font-serif">{String(t.getHours()).padStart(2, '0')}:{String(t.getMinutes()).padStart(2, '0')}<span className="text-admin-muted/40 text-lg">:{String(t.getSeconds()).padStart(2, '0')}</span></span>
}

// Modo TV / Produção — tela cheia sem sidebar/menus. Só filas, timers e relógio.
function TvMode({ kind, soundOn, onExit }) {
  const [counts, setCounts] = useState({ active: 0, late: 0, total: 0 })
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
        <div className="flex items-center gap-5">
          <TvClock />
          <button onClick={onExit} className="flex items-center gap-2 text-admin-muted/70 hover:text-admin-text text-sm border border-white/10 rounded-xl px-3 py-2"><Icon name="x" className="w-4 h-4" />Sair</button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <KdsBoard kind={kind} tv soundOn={soundOn} onCounts={setCounts} />
      </div>
    </div>
  )
}

export function KDSPanel({ notify }) {
  const [tab, setTab] = useState('dashboard')
  const [tv, setTv] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [counts, setCounts] = useState({ active: 0, late: 0, total: 0 })
  const kind = 'kitchen'
  const preset = getPreset(kind)

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: 'chart' },
    { key: 'production', label: 'Produção', icon: 'flame' },
    { key: 'map', label: 'Mapa da Cozinha', icon: 'map' },
    { key: 'stations', label: 'Estações', icon: 'layers' },
    { key: 'team', label: 'Equipe', icon: 'users' },
    { key: 'assistant', label: 'IA', icon: 'sparkles' },
    { key: 'analytics', label: 'Analytics', icon: 'chart' },
    { key: 'history', label: 'Histórico', icon: 'clock' },
  ]

  if (tv) return <TvMode kind={kind} soundOn={soundOn} onExit={() => setTv(false)} />

  return (
    <div>
      {/* Cabeçalho do módulo */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">KDS · Kitchen Flow</h1>
          <p className="text-admin-muted/60 text-sm mt-1">produção em tempo real · movido pelo Experience Flow Engine</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSoundOn((s) => !s)} title={soundOn ? 'Sons ligados' : 'Sons desligados'} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${soundOn ? 'border-admin-champ/25 text-admin-champ' : 'border-white/10 text-admin-muted/50'}`}>
            <Icon name="bell" className="w-4 h-4" />{soundOn ? 'Som' : 'Mudo'}
          </button>
          <button onClick={() => setTv(true)} className="flex items-center gap-2 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors">
            <Icon name="tv" className="w-4 h-4" />Modo Produção
          </button>
        </div>
      </div>

      {/* Abas do módulo */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${tab === t.key ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>
            <Icon name={t.icon} className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <KdsDashboard kind={kind} />}
      {tab === 'production' && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <p className="text-admin-muted/50 text-sm">{counts.active} {preset.unitPlural} ativos{counts.late > 0 ? ` · ${counts.late} atrasados` : ''}</p>
            <p className="text-admin-muted/40 text-xs">arraste os cartões entre as colunas</p>
          </div>
          <KdsBoard kind={kind} soundOn={soundOn} onCounts={setCounts} />
        </div>
      )}
      {tab === 'map' && <KdsKitchenMap kind={kind} />}
      {tab === 'stations' && <KdsStations notify={notify} kind={kind} />}
      {tab === 'team' && <KdsTeam kind={kind} />}
      {tab === 'assistant' && <KdsAssistant kind={kind} />}
      {tab === 'analytics' && <KdsAnalytics kind={kind} />}
      {tab === 'history' && <KdsHistory kind={kind} />}
    </div>
  )
}
