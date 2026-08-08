import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'
import { SUPPLIER_CATEGORIES, CATEGORY_ICON, VERIF_LEVELS } from '../../../lib/suppliersMarket'

// Seravie Match — o conector. A partir de um segmento/projeto, monta o ecossistema
// completo de parceiros compatíveis, cruzando Suppliers + Network.

const SEGMENTS = [
  { value: 'cafeteria', label: 'Cafeteria' },
  { value: 'chocolateria', label: 'Chocolateria' },
  { value: 'hotel', label: 'Hotel Boutique' },
  { value: 'floricultura', label: 'Floricultura' },
  { value: 'vinicola', label: 'Vinícola' },
  { value: 'boutique', label: 'Boutique' },
]

function Seal({ level }) { const v = VERIF_LEVELS[level] || VERIF_LEVELS.bronze; return <span className={`text-[9px] px-1.5 py-0.5 rounded ${v.style}`}>{v.label}</span> }

export function SeravieMatch({ onOpenSupplier, notify }) {
  const [segment, setSegment] = useState('cafeteria')
  const [projectName, setProjectName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const run = async () => {
    setLoading(true); setResult(null)
    try {
      const { data, error } = await supabase.functions.invoke('seravie-match', { body: { segment, project_name: projectName || undefined } })
      if (error) { notify?.('Match indisponível: ' + error.message, 'error'); setLoading(false); return }
      setResult(data)
    } catch (e) { notify?.('Erro: ' + (e.message || e), 'error') } finally { setLoading(false) }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-admin-champ/12 flex items-center justify-center"><Icon name="sparkles" className="w-5 h-5 text-admin-champ" /></div>
        <div><h1 className="font-serif text-2xl text-admin-text">Seravie Match</h1><p className="text-admin-muted/50 text-sm">Diga o que você vai criar e a IA monta o ecossistema completo de parceiros.</p></div>
      </div>

      <div className="glass rounded-2xl p-5 mt-5">
        <div className="grid sm:grid-cols-[1fr_1.4fr_auto] gap-3 items-end">
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Segmento</label><GlassSelect value={segment} onChange={setSegment} options={SEGMENTS} /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5">Nome do projeto (opcional)</label><input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Ex.: Cafeteria Aurora" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
          <button onClick={run} disabled={loading} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-5 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center gap-2 justify-center">{loading ? <Icon name="refresh" className="w-4 h-4 animate-spin" /> : <Icon name="spark" className="w-4 h-4" />}Montar ecossistema</button>
        </div>
      </div>

      {loading && <p className="text-admin-muted/40 text-sm py-10 text-center">A IA está montando seu ecossistema de parceiros…</p>}

      {result && (
        <div className="mt-6 space-y-6">
          <div className="glass-soft rounded-2xl p-5"><p className="text-admin-text/85 text-sm leading-relaxed">{result.summary}</p><p className="text-admin-muted/40 text-xs mt-2">{result.supplier_count} fornecedores · {result.member_count} profissionais</p></div>

          {Object.keys(result.suppliers_by_category || {}).length > 0 && (
            <section>
              <h2 className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Fornecedores recomendados</h2>
              <div className="space-y-4">
                {Object.entries(result.suppliers_by_category).map(([cat, list]) => (
                  <div key={cat}>
                    <p className="text-admin-muted/50 text-xs mb-2 flex items-center gap-1.5"><Icon name={CATEGORY_ICON[cat] || 'box'} className="w-3.5 h-3.5" />{SUPPLIER_CATEGORIES[cat] || cat}</p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {list.map((s) => (
                        <button key={s.id} onClick={() => onOpenSupplier?.(s)} className="glass rounded-xl p-3 flex items-center gap-3 text-left hover:ring-1 hover:ring-admin-champ/30 transition-all">
                          <div className="w-9 h-9 rounded-lg bg-white/[0.05] overflow-hidden flex items-center justify-center shrink-0">{s.logo_url ? <img src={s.logo_url} alt="" className="w-full h-full object-cover" /> : <Icon name={CATEGORY_ICON[s.category] || 'box'} className="w-4 h-4 text-admin-champ/60" />}</div>
                          <div className="min-w-0 flex-1"><p className="text-admin-text text-sm truncate">{s.name}</p><div className="flex items-center gap-1.5 mt-0.5"><Seal level={s.verification_level} />{s.rating > 0 && <span className="text-admin-gold text-[10px]">★ {Number(s.rating).toFixed(1)}</span>}</div></div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {Object.keys(result.members_by_role || {}).length > 0 && (
            <section>
              <h2 className="text-[11px] uppercase tracking-wider text-admin-champ/70 mb-3">Profissionais recomendados</h2>
              <div className="space-y-4">
                {Object.entries(result.members_by_role).map(([role, list]) => (
                  <div key={role}>
                    <p className="text-admin-muted/50 text-xs mb-2">{role}</p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {list.map((m) => (
                        <div key={m.id} className="glass rounded-xl p-3 flex items-center gap-3">
                          {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" /> : <div className="w-9 h-9 rounded-full bg-admin-champ/15 text-admin-champ flex items-center justify-center text-[11px]">{(m.name || '?').slice(0, 2).toUpperCase()}</div>}
                          <div className="min-w-0"><p className="text-admin-text text-sm truncate">{m.name}</p><p className="text-admin-muted/40 text-[11px] truncate">{m.headline || m.role_title}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {result.supplier_count === 0 && result.member_count === 0 && (
            <div className="glass rounded-2xl p-10 text-center"><Icon name="sparkles" className="w-9 h-9 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">Ainda não há parceiros suficientes cadastrados para este segmento.</p><p className="text-admin-muted/35 text-xs mt-1">Conforme o marketplace e a rede crescem, o Match fica mais rico.</p></div>
          )}
        </div>
      )}
    </div>
  )
}
