import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, Toggle } from './ui'
import { logAudit } from '../../lib/audit'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const LIMIT_FIELDS = [
  ['pdv_sales', 'Vendas PDV / mês'], ['online_orders', 'Pedidos online / mês'],
  ['units', 'Unidades / franquias'], ['users', 'Usuários'], ['products', 'Produtos'],
]
const emptyForm = () => ({ name: '', slug: '', description: '', price_monthly: '', price_yearly: '', stripe_price_monthly: '', stripe_price_yearly: '', is_active: true, sort_order: 0, features: '', limits: {} })

export function PlansAdmin({ notify }) {
  const { profile, isSuperAdmin } = useTenant()
  const tenantId = profile?.tenant_id
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [confirmDel, setConfirmDel] = useState(null)

  const load = async () => { setLoading(true); const { data } = await supabase.from('plans').select('*').order('sort_order').order('price_monthly'); setPlans(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(emptyForm()); setModal(true) }
  const openEdit = (p) => {
    setEditing(p)
    setForm({ name: p.name || '', slug: p.slug || '', description: p.description || '', price_monthly: p.price_monthly ?? '', price_yearly: p.price_yearly ?? '', stripe_price_monthly: p.stripe_price_monthly || '', stripe_price_yearly: p.stripe_price_yearly || '', is_active: p.is_active ?? true, sort_order: p.sort_order ?? 0, features: (p.features || []).join('\n'), limits: p.limits || {} })
    setModal(true)
  }
  const setLimit = (k, v) => setForm((f) => ({ ...f, limits: { ...f.limits, [k]: v === '' ? null : Number(v) } }))

  const save = async () => {
    if (!form.name.trim()) return notify('Nome obrigatório', 'error')
    const payload = {
      name: form.name, slug: form.slug || slugify(form.name), description: form.description,
      price_monthly: Number(form.price_monthly) || 0, price_yearly: Number(form.price_yearly) || 0,
      stripe_price_monthly: form.stripe_price_monthly || null, stripe_price_yearly: form.stripe_price_yearly || null,
      is_active: !!form.is_active, sort_order: Number(form.sort_order) || 0,
      features: form.features.split('\n').map((s) => s.trim()).filter(Boolean), limits: form.limits,
    }
    let error, savedId
    if (editing) { const r = await supabase.from('plans').update(payload).eq('id', editing.id); error = r.error; savedId = editing.id }
    else { const r = await supabase.from('plans').insert(payload).select('id').single(); error = r.error; savedId = r.data?.id }
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    logAudit({ action: editing ? 'update' : 'create', resource_type: 'plans', resource_id: savedId, old_data: editing || null, new_data: payload }, tenantId)
    notify(editing ? 'Plano atualizado' : 'Plano criado', 'success'); setModal(false); load()
  }
  const remove = async (p) => {
    const { error } = await supabase.from('plans').delete().eq('id', p.id)
    setConfirmDel(null)
    if (error) return notify('Erro ao excluir', 'error')
    logAudit({ action: 'delete', resource_type: 'plans', resource_id: p.id, old_data: p }, tenantId)
    notify('Plano excluído', 'success'); load()
  }

  if (isSuperAdmin && !isSuperAdmin()) return (
    <div className="glass rounded-2xl p-12 text-center"><Icon name="gear" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">Área restrita ao administrador da plataforma.</p></div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">Planos da Plataforma</h1><p className="text-admin-muted/60 text-sm mt-1">{plans.length} planos · cobrança e limites de uso</p></div>
        <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Novo plano</button>
      </div>

      <div className="glass-soft rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
        <Icon name="star" className="w-4 h-4 text-admin-champ/70 mt-0.5 shrink-0" />
        <p className="text-admin-muted/60 text-xs leading-relaxed">Cada plano guarda os <span className="text-admin-champ/80">Price IDs do Stripe</span> (mensal/anual) e os <span className="text-admin-champ/80">limites de uso</span> (PDV, pedidos online, unidades, usuários, produtos). A cobrança recorrente ao vivo (checkout + webhooks) é a próxima etapa; aqui você já define o catálogo de planos.</p>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-5 flex flex-col group">
              <div className="flex items-start justify-between mb-2">
                <div><p className="text-admin-text font-medium">{p.name}</p><p className="text-admin-muted/40 text-xs">{p.slug}</p></div>
                <span className={`text-[9px] px-2 py-0.5 rounded-lg ${p.is_active ? 'bg-admin-sage/10 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/50'}`}>{p.is_active ? 'ativo' : 'inativo'}</span>
              </div>
              <p className="text-admin-champ text-2xl font-medium">{brl(p.price_monthly)}<span className="text-admin-muted/40 text-xs font-normal"> /mês</span></p>
              {p.price_yearly > 0 && <p className="text-admin-muted/50 text-xs">{brl(p.price_yearly)} /ano</p>}
              {p.description && <p className="text-admin-muted/50 text-xs mt-2 flex-1">{p.description}</p>}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {LIMIT_FIELDS.filter(([k]) => p.limits?.[k] != null).map(([k, l]) => <span key={k} className="text-[10px] text-admin-muted/50 bg-white/[0.03] rounded px-1.5 py-0.5">{l.split(' ')[0]}: {p.limits[k]}</span>)}
                {(!p.limits || Object.keys(p.limits).length === 0) && <span className="text-[10px] text-admin-sage/70">ilimitado</span>}
              </div>
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
          <div className="glass-pop rounded-2xl p-7 w-full max-w-lg overflow-visible max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar plano' : 'Novo plano'}</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Nome *</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: editing ? f.slug : slugify(e.target.value) }))} className={inputCls} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Slug</label><input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className={inputCls} /></div>
              <div className="col-span-2"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Descrição</label><input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputCls} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Preço mensal (R$)</label><input type="number" value={form.price_monthly} onChange={(e) => setForm((f) => ({ ...f, price_monthly: e.target.value }))} className={inputCls} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Preço anual (R$)</label><input type="number" value={form.price_yearly} onChange={(e) => setForm((f) => ({ ...f, price_yearly: e.target.value }))} className={inputCls} /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Stripe Price (mensal)</label><input value={form.stripe_price_monthly} onChange={(e) => setForm((f) => ({ ...f, stripe_price_monthly: e.target.value }))} className={inputCls} placeholder="price_..." /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Stripe Price (anual)</label><input value={form.stripe_price_yearly} onChange={(e) => setForm((f) => ({ ...f, stripe_price_yearly: e.target.value }))} className={inputCls} placeholder="price_..." /></div>
            </div>

            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mt-5 mb-2">Limites de uso <span className="text-admin-muted/40 normal-case tracking-normal">(vazio = ilimitado)</span></p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {LIMIT_FIELDS.map(([k, l]) => (
                <div key={k}><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{l}</label><input type="number" value={form.limits[k] ?? ''} onChange={(e) => setLimit(k, e.target.value)} className={inputCls} placeholder="∞" /></div>
              ))}
            </div>

            <div className="mt-4"><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Recursos (um por linha)</label><textarea value={form.features} onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))} rows={3} className={`${inputCls} resize-none`} placeholder={'PDV completo\nE-commerce\nSuporte prioritário'} /></div>
            <div className="flex items-center justify-between mt-4">
              <label className="flex items-center gap-3"><Toggle checked={!!form.is_active} onChange={(v) => setForm((f) => ({ ...f, is_active: v }))} /><span className="text-sm text-admin-muted">Plano ativo</span></label>
              <div className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-wider text-admin-muted/60">Ordem</span><input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} className="w-16 glass-input rounded-lg px-2 py-1.5 text-sm text-admin-text outline-none" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{editing ? 'Salvar' : 'Criar plano'}</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
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
