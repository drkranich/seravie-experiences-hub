import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'

// Experience DNA — o "genoma" da marca do tenant: essência, estética, valores,
// pilares sensoriais, público e cor-assinatura. Editável e visual.

const SENSES = [
  { key: 'visual', label: 'Visual', icon: 'eye' },
  { key: 'sonoro', label: 'Sonoro', icon: 'bell' },
  { key: 'olfativo', label: 'Olfativo', icon: 'leaf' },
  { key: 'tatil', label: 'Tátil', icon: 'grip' },
  { key: 'gustativo', label: 'Gustativo', icon: 'cup' },
]
const EMPTY = { essence: '', aesthetics: [], values_list: [], senses: {}, audience: '', signature_color: '#b08d57', keywords: [] }

export function ExperienceDNA({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [f, setF] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    supabase.from('experience_dna').select('*').eq('tenant_id', tenantId).maybeSingle().then(({ data }) => {
      if (data) setF({ ...EMPTY, ...data, aesthetics: data.aesthetics || [], values_list: data.values_list || [], keywords: data.keywords || [], senses: data.senses || {} })
      else setEditing(true)
      setLoading(false)
    })
  }, [tenantId])

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const setSense = (k, v) => setF((s) => ({ ...s, senses: { ...s.senses, [k]: v } }))
  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('experience_dna').upsert({
      tenant_id: tenantId, essence: f.essence || null, aesthetics: f.aesthetics, values_list: f.values_list,
      senses: f.senses, audience: f.audience || null, signature_color: f.signature_color || null, keywords: f.keywords, updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })
    setSaving(false)
    if (error) return notify?.('Erro: ' + error.message, 'error')
    notify?.('Experience DNA salvo', 'success'); setEditing(false)
  }

  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'
  const chips = (arr) => (arr || []).length ? arr.join(', ') : ''

  if (loading) return <div className="glass rounded-2xl h-64 animate-pulse opacity-40 max-w-3xl" />

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Experience DNA</h1><p className="text-admin-muted/50 text-sm mt-1">O genoma da sua marca — a essência que guia cada experiência.</p></div>
        {!editing && <button onClick={() => setEditing(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="pen" className="w-4 h-4" />Editar</button>}
      </div>

      {editing ? (
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div><label className={lbl}>Cor-assinatura</label><input type="color" value={f.signature_color || '#b08d57'} onChange={(e) => set('signature_color', e.target.value)} className="w-12 h-10 rounded-lg bg-transparent cursor-pointer" /></div>
            <div className="flex-1"><label className={lbl}>Essência / propósito</label><input value={f.essence} onChange={(e) => set('essence', e.target.value)} placeholder="Ex.: Transformar espaços em memórias afetivas" className={cls} /></div>
          </div>
          <div><label className={lbl}>Estética (palavras, separe por vírgula)</label><input value={chips(f.aesthetics)} onChange={(e) => set('aesthetics', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} placeholder="Ex.: aconchegante, natural, artesanal" className={cls} /></div>
          <div><label className={lbl}>Valores (separe por vírgula)</label><input value={chips(f.values_list)} onChange={(e) => set('values_list', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} placeholder="Ex.: autenticidade, cuidado, sustentabilidade" className={cls} /></div>
          <div>
            <label className={lbl}>Pilares sensoriais</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {SENSES.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <Icon name={s.icon} className="w-4 h-4 text-admin-champ/60 shrink-0" />
                  <span className="text-xs text-admin-muted/60 w-16 shrink-0">{s.label}</span>
                  <input value={f.senses[s.key] || ''} onChange={(e) => setSense(s.key, e.target.value)} placeholder="Descreva…" className={`${cls} py-1.5`} />
                </div>
              ))}
            </div>
          </div>
          <div><label className={lbl}>Público-alvo</label><input value={f.audience} onChange={(e) => set('audience', e.target.value)} placeholder="Quem vive a sua experiência" className={cls} /></div>
          <div><label className={lbl}>Palavras-chave</label><input value={chips(f.keywords)} onChange={(e) => set('keywords', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} className={cls} /></div>
          <div className="flex justify-end gap-2"><button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar DNA'}</button></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1" style={{ background: f.signature_color }} />
            <p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mb-1">Essência</p>
            <p className="font-serif text-xl text-admin-text">{f.essence || 'Defina a essência da sua marca.'}</p>
            {f.audience && <p className="text-admin-muted/50 text-sm mt-2">Para: {f.audience}</p>}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mb-2">Estética</p><div className="flex flex-wrap gap-1.5">{(f.aesthetics || []).length ? f.aesthetics.map((a, i) => <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] text-admin-muted/70">{a}</span>) : <span className="text-admin-muted/40 text-xs">—</span>}</div></div>
            <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mb-2">Valores</p><div className="flex flex-wrap gap-1.5">{(f.values_list || []).length ? f.values_list.map((a, i) => <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-admin-champ/10 text-admin-champ/80">{a}</span>) : <span className="text-admin-muted/40 text-xs">—</span>}</div></div>
          </div>
          <div className="glass rounded-2xl p-5">
            <p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mb-3">Pilares sensoriais</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SENSES.map((s) => (
                <div key={s.key} className="glass-soft rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1"><Icon name={s.icon} className="w-4 h-4 text-admin-champ/70" /><span className="text-sm text-admin-text">{s.label}</span></div>
                  <p className="text-admin-muted/55 text-xs">{f.senses[s.key] || '—'}</p>
                </div>
              ))}
            </div>
          </div>
          {(f.keywords || []).length > 0 && <div className="flex flex-wrap gap-1.5">{f.keywords.map((k, i) => <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] text-admin-muted/50">#{k}</span>)}</div>}
        </div>
      )}
    </div>
  )
}
