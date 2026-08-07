import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Icon, GlassSelect } from './ui'

// Padrões físicos da franquia: por nível (metragem/layout/identidade/equipamentos/kit)
// + kit da vertical principal escolhida. Usado pelo admin e como consulta do franqueado.
// mode="admin"  → mostra todos os níveis + edição de metragem.
// mode="tenant" → franqueado escolhe nível + vertical e vê o playbook da sua loja.

function Chips({ items, icon = 'check', tone = 'sage' }) {
  const list = Array.isArray(items) ? items : []
  if (list.length === 0) return null
  const color = { sage: 'text-admin-sage', champ: 'text-admin-champ', gold: 'text-admin-gold', copper: 'text-admin-copper' }[tone]
  return (
    <ul className="space-y-1">
      {list.map((it, i) => (
        <li key={i} className="flex items-start gap-1.5 text-admin-muted/75 text-xs"><Icon name={icon} className={`w-3 h-3 ${color} mt-0.5 shrink-0`} />{it}</li>
      ))}
    </ul>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-admin-champ/70 mb-1.5">{title}</p>
      {children}
    </div>
  )
}

function LevelCard({ std, kit, editable, onArea, onSave, saving }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-admin-text font-medium text-lg">{std.level_name}</p>
          <p className="text-admin-muted/50 text-xs">{std.format_name}</p>
        </div>
        <div className="text-right">
          {editable ? (
            <div className="flex items-center gap-1 justify-end">
              <input type="number" value={std.area_min_m2 ?? ''} onChange={(e) => onArea('area_min_m2', e.target.value)} className="w-14 glass-input rounded-lg px-1.5 py-1 text-sm text-admin-text outline-none text-right" />
              <span className="text-admin-muted/40 text-xs">–</span>
              <input type="number" value={std.area_max_m2 ?? ''} onChange={(e) => onArea('area_max_m2', e.target.value)} className="w-14 glass-input rounded-lg px-1.5 py-1 text-sm text-admin-text outline-none text-right" />
              <span className="text-admin-muted/40 text-xs">m²</span>
            </div>
          ) : (
            <p className="text-admin-champ text-xl font-medium">{std.area_min_m2}–{std.area_max_m2} <span className="text-admin-muted/40 text-xs">m²</span></p>
          )}
          <p className="text-admin-muted/40 text-[10px] mt-0.5">{std.max_verticals} vertical principal</p>
        </div>
      </div>

      <div className="space-y-3 mt-4">
        <Section title="Layout do espaço"><Chips items={std.layout} icon="grid" tone="champ" /></Section>
        <Section title="Identidade & mobiliário"><Chips items={std.identity} icon="star" tone="gold" /></Section>
        <Section title="Equipamentos & tecnologia"><Chips items={std.equipment} icon="check" tone="sage" /></Section>
        <Section title="Kit inicial (base)"><Chips items={std.starter_kit} icon="gift" tone="copper" /></Section>
        {kit && (
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-admin-champ/70 mb-1.5">Vertical: {kit.vertical_name}</p>
            {kit.layout_focus && <p className="text-admin-muted/60 text-xs italic mb-2">{kit.layout_focus}</p>}
            <div className="grid sm:grid-cols-2 gap-3">
              <Section title="Produtos assinatura"><Chips items={kit.signature_products} icon="spark" tone="gold" /></Section>
              <Section title="Estoque inicial"><Chips items={kit.starter_stock} icon="box" tone="sage" /></Section>
            </div>
          </div>
        )}
        {std.notes && <p className="text-admin-muted/50 text-[11px] italic mt-2">{std.notes}</p>}
      </div>

      {editable && (
        <button onClick={onSave} disabled={saving} className="mt-4 w-full py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-40">
          {saving ? 'Salvando…' : 'Salvar metragem'}
        </button>
      )}
    </div>
  )
}

export function FranchiseStandards({ mode = 'admin', notify }) {
  const [stds, setStds] = useState([])
  const [kits, setKits] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  // seleção do franqueado (fallback manual) + contrato amarrado
  const [level, setLevel] = useState('')
  const [vertical, setVertical] = useState('')
  const [contract, setContract] = useState(null)

  useEffect(() => {
    (async () => {
      const reqs = [
        supabase.from('franchise_space_standards').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('franchise_vertical_kits').select('*').eq('is_active', true).order('vertical_name'),
      ]
      // no modo franqueado, busca o contrato ativo do tenant (RLS já filtra por tenant)
      if (mode === 'tenant') reqs.push(supabase.from('franchise_contracts').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle())
      const [{ data: s }, { data: k }, ct] = await Promise.all(reqs)
      setStds(s || []); setKits(k || [])
      const c = ct?.data || null
      setContract(c)
      // se o contrato define nível/vertical, usa-os; senão cai no primeiro (fallback)
      if (c?.offering_slug) setLevel(c.offering_slug); else if (s && s.length) setLevel(s[0].offering_slug)
      if (c?.vertical_slug) setVertical(c.vertical_slug); else if (k && k.length) setVertical(k[0].vertical_slug)
      setLoading(false)
    })()
  }, [mode])

  const kitBySlug = useMemo(() => Object.fromEntries(kits.map((k) => [k.vertical_slug, k])), [kits])
  const setArea = (id, field, val) => setStds((xs) => xs.map((s) => s.id === id ? { ...s, [field]: val } : s))
  const saveArea = async (s) => {
    setSaving(s.id)
    const { error } = await supabase.from('franchise_space_standards').update({ area_min_m2: Number(s.area_min_m2) || 0, area_max_m2: Number(s.area_max_m2) || 0 }).eq('id', s.id)
    setSaving(null)
    if (error) return notify?.('Erro ao salvar', 'error')
    notify?.(`${s.level_name}: metragem atualizada`, 'success')
  }

  if (loading) return <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando padrões…</p>

  if (mode === 'tenant') {
    const std = stds.find((s) => s.offering_slug === level)
    const kit = kitBySlug[vertical]
    // contrato amarrado: nível + vertical vêm do contrato do franqueado
    const linked = contract && contract.offering_slug
    return (
      <div>
        {linked ? (
          <div className="glass rounded-2xl p-5 mb-5 flex items-start gap-4 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-admin-champ/15 flex items-center justify-center shrink-0"><Icon name="building" className="w-5 h-5 text-admin-champ" /></div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-admin-text font-medium">{contract.unit_name || contract.franchisee_name || 'Sua franquia Seravie'}</p>
              <p className="text-admin-muted/50 text-xs mt-0.5">
                {std ? `${std.level_name} · ${std.format_name}` : contract.offering_slug}
                {kit ? ` · ${kit.vertical_name}` : ''}
                {contract.royalty_pct > 0 ? ` · royalty ${Number(contract.royalty_pct)}%` : ''}
              </p>
              <p className="text-admin-sage/70 text-[11px] mt-1">Padrão vinculado ao seu contrato de franquia.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="glass-soft rounded-xl px-4 py-3 mb-5 text-xs text-admin-muted/60 leading-relaxed">
              {contract
                ? 'Seu contrato ainda não tem o nível/vertical definidos pela franqueadora. Enquanto isso, consulte os padrões abaixo escolhendo o formato desejado.'
                : 'Consulte o padrão físico da franquia Seravie. Escolha o nível e a vertical principal para ver a metragem, o layout, o mobiliário, os equipamentos e o kit de produtos originais que a Seravie entrega na implantação. A metragem é respeitada como via de regra.'}
            </div>
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="w-64">
                <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Nível da franquia</label>
                <GlassSelect value={level} onChange={setLevel} options={stds.map((s) => ({ value: s.offering_slug, label: `${s.level_name} · ${s.format_name}` }))} />
              </div>
              <div className="w-64">
                <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Vertical principal</label>
                <GlassSelect value={vertical} onChange={setVertical} options={kits.map((k) => ({ value: k.vertical_slug, label: k.vertical_name }))} />
              </div>
            </div>
          </>
        )}
        <div className="max-w-xl">
          {std ? <LevelCard std={std} kit={kit} editable={false} /> : <p className="text-admin-muted/40 text-sm">Padrão não encontrado.</p>}
        </div>
      </div>
    )
  }

  // admin: todos os níveis lado a lado + seletor de vertical para pré-visualizar o kit
  const kit = kitBySlug[vertical]
  return (
    <div>
      <div className="glass-soft rounded-xl px-4 py-3 mb-5 text-xs text-admin-muted/60 leading-relaxed">
        Padrões físicos obrigatórios por nível de franquia. Edite a metragem direto nos cards (demais itens no banco). Escolha uma vertical para pré-visualizar o kit de produtos originais aplicado a cada nível.
      </div>
      <div className="mb-5 w-64">
        <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Pré-visualizar vertical</label>
        <GlassSelect value={vertical} onChange={setVertical} options={kits.map((k) => ({ value: k.vertical_slug, label: k.vertical_name }))} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        {stds.map((s) => (
          <LevelCard key={s.id} std={s} kit={kit} editable onArea={(f, v) => setArea(s.id, f, v)} onSave={() => saveArea(s)} saving={saving === s.id} />
        ))}
      </div>
    </div>
  )
}
