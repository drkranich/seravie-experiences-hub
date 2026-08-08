import { useMemo } from 'react'
import { Icon } from '../ui'
import { SUPPLIER_CATEGORIES, CATEGORY_ICON, VERIF_LEVELS } from '../../../lib/suppliersMarket'

// Comparador — até 5 fornecedores lado a lado. Destaca o melhor por critério.

const num = (v) => (v == null || v === '' ? null : Number(v))
// extrai "dias" de textos como "30 dias", "15 a 20 dias" (usa o primeiro número)
const days = (t) => { const m = String(t || '').match(/\d+/); return m ? Number(m[0]) : null }

// linhas de comparação: como ler o valor, formatar, e qual direção é "melhor"
const ROWS = [
  { key: 'category', label: 'Categoria', get: (s) => SUPPLIER_CATEGORIES[s.category] || s.category || '—', fmt: (v) => v },
  { key: 'rating', label: 'Avaliação', get: (s) => num(s.rating), fmt: (v) => (v ? `${v.toFixed(1)} ★` : '—'), best: 'max' },
  { key: 'reviews_count', label: 'Nº de avaliações', get: (s) => num(s.reviews_count), fmt: (v) => (v ?? '—'), best: 'max' },
  { key: 'verification', label: 'Homologação', get: (s) => VERIF_LEVELS[s.verification_level]?.rank || 0, fmt: (v, s) => VERIF_LEVELS[s.verification_level]?.label || '—', best: 'max' },
  { key: 'years_market', label: 'Anos de mercado', get: (s) => num(s.years_market), fmt: (v) => (v ? `${v} anos` : '—'), best: 'max' },
  { key: 'projects_count', label: 'Projetos realizados', get: (s) => num(s.projects_count), fmt: (v) => (v ?? '—'), best: 'max' },
  { key: 'lead_time', label: 'Prazo médio', get: (s) => days(s.lead_time), fmt: (v, s) => s.lead_time || '—', best: 'min' },
  { key: 'min_order', label: 'Pedido mínimo', get: (s) => s.min_order, fmt: (v) => v || '—' },
  { key: 'production_type', label: 'Produção', get: (s) => ({ artesanal: 'Artesanal', industrial: 'Industrial', both: 'Artesanal + Industrial' }[s.production_type] || '—'), fmt: (v) => v },
  { key: 'customization', label: 'Personalização', get: (s) => !!s.customization, fmt: (v) => (v ? 'Sim' : 'Não'), best: 'bool' },
  { key: 'export', label: 'Exporta', get: (s) => !!s.export, fmt: (v) => (v ? 'Sim' : 'Não'), best: 'bool' },
  { key: 'states', label: 'Regiões atendidas', get: (s) => (Array.isArray(s.states) ? s.states.length : 0), fmt: (v, s) => (Array.isArray(s.states) && s.states.length ? s.states.join(', ') : '—'), best: 'max' },
]

export function Comparator({ suppliers, selected, onToggle, onOpen, onClear, onRfq }) {
  const chosen = suppliers.filter((s) => selected.includes(s.id)).slice(0, 5)

  // calcula, por linha, qual(is) fornecedor(es) tem o melhor valor
  const bestByRow = useMemo(() => {
    const map = {}
    for (const r of ROWS) {
      if (!r.best) continue
      const vals = chosen.map((s) => r.get(s))
      let best = null
      if (r.best === 'max') best = Math.max(...vals.filter((v) => typeof v === 'number'))
      else if (r.best === 'min') { const nums = vals.filter((v) => typeof v === 'number'); best = nums.length ? Math.min(...nums) : null }
      else if (r.best === 'bool') best = vals.some((v) => v === true) ? true : null
      map[r.key] = best
    }
    return map
  }, [chosen])

  if (chosen.length === 0) {
    return (
      <div>
        <Header count={0} onClear={onClear} onRfq={onRfq} />
        <div className="glass rounded-2xl p-12 text-center">
          <Icon name="layers" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" />
          <p className="text-admin-muted/60 text-sm">Nenhum fornecedor selecionado para comparar.</p>
          <p className="text-admin-muted/35 text-xs mt-1">Em Descobrir, toque em “Comparar” nos cards (até 5).</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header count={chosen.length} onClear={onClear} onRfq={() => onRfq(chosen.map((s) => s.id))} />
      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <th className="text-left p-4 w-40 sticky left-0 bg-admin-side/40 backdrop-blur-md z-10"></th>
              {chosen.map((s) => (
                <th key={s.id} className="p-4 text-center min-w-[160px]">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-xl bg-white/[0.05] overflow-hidden flex items-center justify-center">
                      {s.logo_url ? <img src={s.logo_url} alt="" className="w-full h-full object-cover" /> : <Icon name={CATEGORY_ICON[s.category] || 'box'} className="w-6 h-6 text-admin-champ/60" />}
                    </div>
                    <button onClick={() => onOpen(s)} className="text-admin-text font-medium hover:text-admin-champ transition-colors text-sm leading-tight">{s.name}</button>
                    <button onClick={() => onToggle(s.id)} className="text-[10px] text-admin-muted/40 hover:text-admin-rose flex items-center gap-1"><Icon name="x" className="w-3 h-3" />remover</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key} className="border-b border-white/[0.04]">
                <td className="p-4 text-admin-muted/50 text-xs uppercase tracking-wider sticky left-0 bg-admin-side/40 backdrop-blur-md z-10">{r.label}</td>
                {chosen.map((s) => {
                  const raw = r.get(s)
                  const isBest = r.best && bestByRow[r.key] != null && raw === bestByRow[r.key] && (r.best !== 'bool' || raw === true)
                  return (
                    <td key={s.id} className={`p-4 text-center ${isBest ? 'text-admin-champ font-medium' : 'text-admin-text/80'}`}>
                      <span className="inline-flex items-center gap-1">{r.fmt(raw, s)}{isBest && <Icon name="check" className="w-3.5 h-3.5 text-admin-sage" />}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <td className="p-4 sticky left-0 bg-admin-side/40 backdrop-blur-md z-10"></td>
              {chosen.map((s) => (
                <td key={s.id} className="p-4 text-center">
                  <button onClick={() => onOpen(s)} className="text-xs px-3 py-1.5 rounded-lg bg-admin-champ/12 text-admin-champ hover:bg-admin-champ/20 transition-colors">Ver perfil</button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-admin-muted/35 text-[11px] mt-3 flex items-center gap-1.5"><Icon name="check" className="w-3.5 h-3.5 text-admin-sage" /> destaca o melhor valor de cada critério.</p>
    </div>
  )
}

function Header({ count, onClear, onRfq }) {
  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h1 className="font-serif text-2xl text-admin-text">Comparador</h1>
        <p className="text-admin-muted/50 text-sm mt-1">Compare até 5 fornecedores lado a lado.{count ? ` ${count} selecionado${count === 1 ? '' : 's'}.` : ''}</p>
      </div>
      {count > 0 && (
        <div className="flex items-center gap-2">
          <button onClick={onClear} className="text-xs px-3 py-2 rounded-xl glass-input text-admin-muted/70 hover:text-admin-text transition-colors">Limpar</button>
          <button onClick={onRfq} className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ transition-colors"><Icon name="mail" className="w-4 h-4" />Pedir cotação a todos</button>
        </div>
      )}
    </div>
  )
}
