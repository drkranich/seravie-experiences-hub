import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, Toggle, GlassSelect } from './ui'
import { ResourceTabs } from './ResourcePanel'
import { logAudit } from '../../lib/audit'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const LIMIT_FIELDS = [
  ['pdv_sales', 'Vendas PDV / mês'], ['online_orders', 'Pedidos online / mês'],
  ['units', 'Unidades / franquias'], ['users', 'Usuários'], ['products', 'Produtos'],
]
const PLAN_TYPES = { module: 'Módulo avulso', combo: 'Combo', franchise: 'Franquia' }
const emptyForm = () => ({ name: '', slug: '', description: '', plan_type: 'combo', module_slugs: [], pricing_mode: 'fixed', discount_pct: '', price_monthly: '', price_yearly: '', stripe_price_monthly: '', stripe_price_yearly: '', is_active: true, sort_order: 0, features: '', limits: {} })

// ---------- Planos & Combos ----------
function PlansTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [plans, setPlans] = useState([])
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [confirmDel, setConfirmDel] = useState(null)

  const load = async () => {
    setLoading(true)
    const [{ data: pl }, { data: mo }] = await Promise.all([
      supabase.from('plans').select('*').order('sort_order').order('price_monthly'),
      supabase.from('modules').select('slug,name,price_monthly,price_yearly,sellable').order('name'),
    ])
    setPlans(pl || []); setModules(mo || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const moduleBySlug = useMemo(() => Object.fromEntries(modules.map((m) => [m.slug, m])), [modules])
  const sumOf = (slugs, cycle = 'monthly') => (slugs || []).reduce((s, sl) => s + (Number(moduleBySlug[sl]?.[cycle === 'yearly' ? 'price_yearly' : 'price_monthly']) || 0), 0)
  // Preço efetivo previsto no form (espelha a função do banco)
  const effMonthly = useMemo(() => {
    if (form.pricing_mode === 'sum') return Math.round(sumOf(form.module_slugs) * (1 - (Number(form.discount_pct) || 0) / 100) * 100) / 100
    return Number(form.price_monthly) || 0
  }, [form, moduleBySlug])

  const openNew = () => { setEditing(null); setForm(emptyForm()); setModal(true) }
  const openEdit = (p) => {
    setEditing(p)
    setForm({ name: p.name || '', slug: p.slug || '', description: p.description || '', plan_type: p.plan_type || 'combo', module_slugs: Array.isArray(p.module_slugs) ? p.module_slugs : [], pricing_mode: p.pricing_mode || 'fixed', discount_pct: p.discount_pct ?? '', price_monthly: p.price_monthly ?? '', price_yearly: p.price_yearly ?? '', stripe_price_monthly: p.stripe_price_monthly || '', stripe_price_yearly: p.stripe_price_yearly || '', is_active: p.is_active ?? true, sort_order: p.sort_order ?? 0, features: (p.features || []).join('\n'), limits: p.limits || {} })
    setModal(true)
  }
  const setLimit = (k, v) => setForm((f) => ({ ...f, limits: { ...f.limits, [k]: v === '' ? null : Number(v) } }))
  const toggleModule = (slug) => setForm((f) => ({ ...f, module_slugs: f.module_slugs.includes(slug) ? f.module_slugs.filter((s) => s !== slug) : [...f.module_slugs, slug] }))

  const save = async () => {
    if (!form.name.trim()) return notify('Nome obrigatório', 'error')
    const isSum = form.pricing_mode === 'sum'
    const payload = {
      name: form.name, slug: form.slug || slugify(form.name), description: form.description,
      plan_type: form.plan_type, module_slugs: form.module_slugs, pricing_mode: form.pricing_mode, discount_pct: Number(form.discount_pct) || 0,
      price_monthly: isSum ? Math.round(sumOf(form.module_slugs) * (1 - (Number(form.discount_pct) || 0) / 100) * 100) / 100 : (Number(form.price_monthly) || 0),
      price_yearly: isSum ? Math.round(sumOf(form.module_slugs, 'yearly') * (1 - (Number(form.discount_pct) || 0) / 100) * 100) / 100 : (Number(form.price_yearly) || 0),
      stripe_price_monthly: form.stripe_price_monthly || null, stripe_price_yearly: form.stripe_price_yearly || null,
      is_active: !!form.is_active, sort_order: Number(form.sort_order) || 0,
      features: form.features.split('\n').map((s) => s.trim()).filter(Boolean), limits: form.limits,
    }
    let error, savedId
    if (editing) { const r = await supabase.from('plans').update(payload).eq('id', editing.id); error = r.error; savedId = editing.id }
    else { const r = await supabase.from('plans').insert(payload).select('id').single(); error = r.error; savedId = r.data?.id }
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    logAudit({ action: editing ? 'update' : 'create', resource_type: 'plans', resource_id: savedId, new_data: payload }, tenantId)
    notify(editing ? 'Plano atualizado' : 'Plano criado', 'success'); setModal(false); load()
  }
  const remove = async (p) => {
    const { error } = await supabase.from('plans').delete().eq('id', p.id); setConfirmDel(null)
    if (error) return notify('Erro ao excluir', 'error')
    logAudit({ action: 'delete', resource_type: 'plans', resource_id: p.id, old_data: p }, tenantId)
    notify('Plano excluído', 'success'); load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <p className="text-admin-muted/50 text-sm">{plans.length} planos · módulos avulsos, combos e franquias</p>
        <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm"><Icon name="plus" className="w-4 h-4" />Novo plano</button>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-5 flex flex-col group">
              <div className="flex items-start justify-between mb-2">
                <div><p className="text-admin-text font-medium">{p.name}</p><p className="text-admin-muted/40 text-xs">{PLAN_TYPES[p.plan_type] || p.plan_type} · {p.slug}</p></div>
                <span className={`text-[9px] px-2 py-0.5 rounded-lg ${p.is_active ? 'bg-admin-sage/10 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/50'}`}>{p.is_active ? 'ativo' : 'inativo'}</span>
              </div>
              <p className="text-admin-champ text-2xl font-medium">{brl(p.price_monthly)}<span className="text-admin-muted/40 text-xs font-normal"> /mês</span></p>
              {p.price_yearly > 0 && <p className="text-admin-muted/50 text-xs">{brl(p.price_yearly)} /ano</p>}
              {p.pricing_mode === 'sum' && <p className="text-admin-sage/60 text-[10px] mt-0.5">soma dos módulos{p.discount_pct > 0 ? ` − ${p.discount_pct}%` : ''}</p>}
              {(p.module_slugs || []).length > 0 && <p className="text-admin-muted/40 text-[11px] mt-2 flex-1">{(p.module_slugs || []).length} módulo(s): {(p.module_slugs || []).map((s) => moduleBySlug[s]?.name || s).slice(0, 4).join(', ')}{(p.module_slugs || []).length > 4 ? '…' : ''}</p>}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.05] text-[10px] text-admin-muted/40">
                {p.stripe_price_monthly ? <span className="text-admin-sage/70">Stripe ✓</span> : <span>Stripe —</span>}
                <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ hover:bg-white/[0.05]"><Icon name="pen" className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setConfirmDel(p)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-rose hover:bg-white/[0.05]"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar plano' : 'Novo plano'}</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Nome *</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: editing ? f.slug : slugify(e.target.value) }))} className={inputCls} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Tipo</label><GlassSelect value={form.plan_type} onChange={(v) => setForm((f) => ({ ...f, plan_type: v }))} options={Object.entries(PLAN_TYPES).map(([value, label]) => ({ value, label }))} /></div>
              <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Descrição</label><input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} /></div>
            </div>

            {/* Módulos incluídos */}
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mt-5 mb-2">Módulos incluídos</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto glass-soft rounded-xl p-3">
              {modules.map((m) => (
                <label key={m.slug} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg cursor-pointer ${form.module_slugs.includes(m.slug) ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted/70 hover:bg-white/[0.04]'}`}>
                  <input type="checkbox" checked={form.module_slugs.includes(m.slug)} onChange={() => toggleModule(m.slug)} className="accent-admin-champ" />
                  <span className="truncate">{m.name}</span>
                  {m.price_monthly > 0 && <span className="ml-auto text-[10px] text-admin-muted/40">{brl(m.price_monthly)}</span>}
                </label>
              ))}
            </div>

            {/* Precificação */}
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mt-5 mb-2">Precificação</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Modo</label><GlassSelect value={form.pricing_mode} onChange={(v) => setForm((f) => ({ ...f, pricing_mode: v }))} options={[{ value: 'fixed', label: 'Preço fixo' }, { value: 'sum', label: 'Soma dos módulos' }]} /></div>
              {form.pricing_mode === 'sum' ? (
                <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Desconto sobre a soma (%)</label><input type="number" value={form.discount_pct} onChange={(e) => setForm((f) => ({ ...f, discount_pct: e.target.value }))} className={inputCls} placeholder="0" /></div>
              ) : (
                <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Preço mensal (R$)</label><input type="number" value={form.price_monthly} onChange={(e) => setForm((f) => ({ ...f, price_monthly: e.target.value }))} className={inputCls} /></div>
              )}
              {form.pricing_mode === 'fixed' && <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Preço anual (R$)</label><input type="number" value={form.price_yearly} onChange={(e) => setForm((f) => ({ ...f, price_yearly: e.target.value }))} className={inputCls} /></div>}
            </div>
            {form.pricing_mode === 'sum' && (
              <div className="glass-soft rounded-xl px-4 py-2.5 mt-3 flex items-center justify-between text-sm">
                <span className="text-admin-muted/60">Soma dos módulos: {brl(sumOf(form.module_slugs))}{form.discount_pct > 0 ? ` − ${form.discount_pct}%` : ''}</span>
                <span className="text-admin-champ font-medium">= {brl(effMonthly)}/mês</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Stripe Price (mensal)</label><input value={form.stripe_price_monthly} onChange={(e) => setForm((f) => ({ ...f, stripe_price_monthly: e.target.value }))} className={inputCls} placeholder="price_..." /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Stripe Price (anual)</label><input value={form.stripe_price_yearly} onChange={(e) => setForm((f) => ({ ...f, stripe_price_yearly: e.target.value }))} className={inputCls} placeholder="price_..." /></div>
            </div>

            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mt-5 mb-2">Limites de uso <span className="text-admin-muted/40 normal-case tracking-normal">(vazio = ilimitado)</span></p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {LIMIT_FIELDS.map(([k, l]) => (
                <div key={k}><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{l}</label><input type="number" value={form.limits[k] ?? ''} onChange={(e) => setLimit(k, e.target.value)} className={inputCls} placeholder="∞" /></div>
              ))}
            </div>

            <div className="mt-4"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Recursos (um por linha)</label><textarea value={form.features} onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))} rows={2} className={`${inputCls} resize-none`} /></div>
            <div className="flex items-center justify-between mt-4">
              <label className="flex items-center gap-3"><Toggle checked={!!form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} /><span className="text-sm text-admin-muted">Plano ativo</span></label>
              <div className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-wider text-admin-muted/60">Ordem</span><input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} className="w-16 glass-input rounded-lg px-2 py-1.5 text-sm text-admin-text outline-none" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">{editing ? 'Salvar' : 'Criar plano'}</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-serif text-xl text-admin-text mb-2">Excluir plano</h3>
            <p className="text-admin-muted/70 text-sm mb-6">Remover o plano “{confirmDel.name}”? Tenants nele ficarão sem plano associado.</p>
            <div className="flex gap-3"><button onClick={() => remove(confirmDel)} className="flex-1 bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose py-2.5 rounded-xl text-sm">Excluir</button><button onClick={() => setConfirmDel(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Preços por módulo (avulso) ----------
function ModulePricingTab({ notify }) {
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); const { data } = await supabase.from('modules').select('*').order('category').order('name'); setModules(data || []); setLoading(false) }
  useEffect(() => { load() }, [])
  const setField = (id, patch) => setModules((ms) => ms.map((m) => m.id === id ? { ...m, ...patch } : m))
  const saveOne = async (m) => {
    const { error } = await supabase.from('modules').update({ price_monthly: Number(m.price_monthly) || 0, price_yearly: Number(m.price_yearly) || 0, sellable: m.sellable !== false, stripe_price_monthly: m.stripe_price_monthly || null }).eq('id', m.id)
    if (error) return notify('Erro ao salvar', 'error')
    notify(`${m.name} atualizado`, 'success')
  }
  if (loading) return <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p>
  return (
    <div>
      <div className="glass-soft rounded-xl px-4 py-3 mb-4 text-xs text-admin-muted/60 leading-relaxed">Defina o preço mensal/anual de cada módulo vendido avulso. Esses valores alimentam os combos no modo "soma dos módulos" e a montagem self-service do cliente.</div>
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-admin-muted/50 text-[11px] uppercase tracking-wider border-b border-white/[0.06]">
            <th className="text-left px-4 py-3">Módulo</th><th className="px-3 py-3">Vendável</th><th className="px-3 py-3">Mensal (R$)</th><th className="px-3 py-3">Anual (R$)</th><th className="px-3 py-3">Stripe Price</th><th className="px-3 py-3"></th></tr></thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m.id} className="border-b border-white/[0.03]">
                <td className="px-4 py-2.5 text-admin-text/90">{m.name}<span className="text-admin-muted/30 text-[10px] block">{m.category || '—'}</span></td>
                <td className="px-3 py-2.5 text-center"><input type="checkbox" checked={m.sellable !== false} onChange={(e) => setField(m.id, { sellable: e.target.checked })} className="accent-admin-champ" /></td>
                <td className="px-3 py-2.5"><input type="number" value={m.price_monthly ?? ''} onChange={(e) => setField(m.id, { price_monthly: e.target.value })} className="w-24 glass-input rounded-lg px-2 py-1.5 text-sm text-admin-text outline-none text-right" /></td>
                <td className="px-3 py-2.5"><input type="number" value={m.price_yearly ?? ''} onChange={(e) => setField(m.id, { price_yearly: e.target.value })} className="w-24 glass-input rounded-lg px-2 py-1.5 text-sm text-admin-text outline-none text-right" /></td>
                <td className="px-3 py-2.5"><input value={m.stripe_price_monthly || ''} onChange={(e) => setField(m.id, { stripe_price_monthly: e.target.value })} className="w-32 glass-input rounded-lg px-2 py-1.5 text-xs text-admin-text outline-none" placeholder="price_..." /></td>
                <td className="px-3 py-2.5 text-right"><button onClick={() => saveOne(m)} className="text-[11px] px-3 py-1.5 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">Salvar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function PlansAdmin({ notify }) {
  const { isSuperAdmin } = useTenant()
  if (isSuperAdmin && !isSuperAdmin()) return (
    <div className="glass rounded-2xl p-12 text-center"><Icon name="gear" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">Área restrita ao administrador da plataforma.</p></div>
  )
  return (
    <ResourceTabs title="Planos da Plataforma" subtitle="módulos avulsos, combos, franquias e cobrança"
      tabs={[
        { key: 'plans', label: 'Planos & Combos', render: () => <PlansTab notify={notify} /> },
        { key: 'modules', label: 'Preços por Módulo', render: () => <ModulePricingTab notify={notify} /> },
      ]}
    />
  )
}
