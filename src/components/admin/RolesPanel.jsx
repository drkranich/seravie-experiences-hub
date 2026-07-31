import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'
import { logAudit } from '../../lib/audit'
import { PermissionMatrix, permsToLevels, levelsToPerms } from './permissions'

// Perfis padrão. Colaboradores vêm no máximo em 'edit' (nunca 'manage'), ou seja,
// criam e editam mas NÃO excluem — excluir fica com o administrador.
const DEFAULTS = [
  { name: 'Administrador', slug: 'admin', description: 'Acesso total à plataforma', perms: ['*'] },
  { name: 'Gerente', slug: 'gerente', description: 'Gestão operacional (sem excluir)', mods: ['overview', 'crm', 'catalog', 'pos', 'receivables', 'ecommerce', 'finance', 'agenda', 'operations', 'marketing', 'team', 'analytics'], level: 'edit' },
  { name: 'Operador de caixa', slug: 'operador', description: 'Operação de loja e atendimento', mods: ['overview', 'crm', 'catalog', 'pos', 'agenda'], level: 'edit', viewOnlyExtra: ['receivables'] },
  { name: 'Visualizador', slug: 'visualizador', description: 'Somente leitura', mods: ['overview', 'crm', 'catalog', 'pos', 'receivables', 'ecommerce', 'finance', 'agenda', 'operations', 'marketing', 'team', 'knowledge', 'analytics', 'verticals'], level: 'view' },
]
const slugify = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

function buildPerms(d) {
  if (d.perms) return d.perms
  const out = []
  ;(d.mods || []).forEach((m) => out.push(`${d.level}:${m}`))
  ;(d.viewOnlyExtra || []).forEach((m) => out.push(`view:${m}`))
  return out
}
const countPerms = (perms) => (Array.isArray(perms) ? (perms.includes('*') ? 999 : perms.length) : 0)

export function RolesPanel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', slug: '', description: '', levels: {} })
  const [confirmDel, setConfirmDel] = useState(null)

  const load = async () => { setLoading(true); const { data } = await supabase.from('roles').select('*').order('name'); setRoles(data || []); setLoading(false) }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm({ name: '', slug: '', description: '', levels: permsToLevels([]) }); setModal(true) }
  const openEdit = (r) => { setEditing(r); setForm({ name: r.name, slug: r.slug, description: r.description || '', levels: permsToLevels(r.permissions) }); setModal(true) }

  const save = async () => {
    if (!form.name.trim()) return notify('Nome obrigatório', 'error')
    const permissions = levelsToPerms(form.levels)
    const payload = { name: form.name, slug: form.slug || slugify(form.name), description: form.description, permissions }
    let error, savedId
    if (editing) { const res = await supabase.from('roles').update(payload).eq('id', editing.id); error = res.error; savedId = editing.id }
    else { const res = await supabase.from('roles').insert({ ...payload, is_system: false, tenant_id: tenantId }).select('id').single(); error = res.error; savedId = res.data?.id }
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    logAudit({ action: editing ? 'update' : 'create', resource_type: 'roles', resource_id: savedId, old_data: editing || null, new_data: payload }, tenantId)
    notify(editing ? 'Perfil atualizado' : 'Perfil criado', 'success'); setModal(false); setEditing(null); load()
  }
  const remove = async (r) => {
    const { error } = await supabase.from('roles').delete().eq('id', r.id)
    setConfirmDel(null)
    if (error) return notify('Erro ao excluir', 'error')
    logAudit({ action: 'delete', resource_type: 'roles', resource_id: r.id, old_data: r }, tenantId)
    notify('Perfil excluído', 'success'); load()
  }
  const seedDefaults = async () => {
    const existing = new Set(roles.map((r) => r.slug))
    const rows = DEFAULTS.filter((d) => !existing.has(d.slug)).map((d) => ({ name: d.name, slug: d.slug, description: d.description, permissions: buildPerms(d), is_system: false, tenant_id: tenantId }))
    if (!rows.length) return notify('Perfis padrão já existem', 'info')
    const { error } = await supabase.from('roles').insert(rows)
    if (error) return notify('Erro ao criar perfis: ' + error.message, 'error')
    notify('Perfis padrão criados', 'success'); load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">Perfis & Permissões</h1><p className="text-admin-muted/60 text-sm mt-1">{roles.length} perfis · controle de acesso por módulo</p></div>
        <div className="flex gap-2">
          <button onClick={seedDefaults} className="flex items-center gap-2 border border-admin-champ/20 text-admin-champ/80 px-3 py-2 rounded-xl text-sm hover:bg-white/[0.04] transition-colors"><Icon name="spark" className="w-4 h-4" />Perfis padrão</button>
          <button onClick={openNew} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Novo perfil</button>
        </div>
      </div>

      <div className="glass-soft rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
        <Icon name="eye" className="w-4 h-4 text-admin-champ/70 mt-0.5 shrink-0" />
        <p className="text-admin-muted/60 text-xs leading-relaxed">Controle por página (cada página é um setor): <span className="text-admin-champ">Ver</span> (leitura), <span className="text-admin-gold">Editar</span> (criar/editar) ou <span className="text-admin-sage">Gerenciar</span> (inclui <span className="text-admin-rose">excluir</span>). Colaboradores só excluem se você conceder "Gerenciar". Administradores enxergam tudo.</p>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p>
        : roles.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center"><Icon name="user" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum perfil ainda. Crie os perfis padrão ou um novo.</p></div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {roles.map((r) => (
              <div key={r.id} className="glass rounded-xl p-4 group">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-admin-text text-sm font-medium">{r.name}</p>
                  {r.is_system && <span className="text-[9px] px-2 py-0.5 rounded-lg bg-admin-gold/10 text-admin-gold shrink-0">sistema</span>}
                </div>
                {r.description && <p className="text-admin-muted/50 text-xs mb-2">{r.description}</p>}
                <p className="text-admin-champ/60 text-xs">{Array.isArray(r.permissions) && r.permissions.includes('*') ? 'Acesso total' : `${countPerms(r.permissions)} permissões`}</p>
                <div className="flex gap-1 mt-3 pt-3 border-t border-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-champ hover:bg-white/[0.05] transition-colors" title="Editar"><Icon name="pen" className="w-3.5 h-3.5" /></button>
                  {r.slug !== 'super_admin' && <button onClick={() => setConfirmDel(r)} className="p-1.5 rounded-lg text-admin-muted hover:text-admin-rose hover:bg-white/[0.05] transition-colors ml-auto" title="Excluir"><Icon name="trash" className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
            ))}
          </div>
        )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-lg overflow-visible max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar perfil' : 'Novo perfil'}</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome *</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: editing ? f.slug : slugify(e.target.value) }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Slug</label><input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              <div className="col-span-2"><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Descrição</label><input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
            </div>

            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Permissões por página <span className="text-admin-muted/40 normal-case tracking-normal">(módulo aplica em bloco; expanda para ajustar setor a setor)</span></p>
            <PermissionMatrix levels={form.levels} onChange={(lv) => setForm((f) => ({ ...f, levels: lv }))} />

            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{editing ? 'Salvar alterações' : 'Criar perfil'}</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-serif text-xl text-admin-text mb-2">Excluir perfil</h3>
            <p className="text-admin-muted/70 text-sm mb-6">Remover o perfil “{confirmDel.name}”? Usuários com este perfil perdem as permissões associadas.</p>
            <div className="flex gap-3"><button onClick={() => remove(confirmDel)} className="flex-1 bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose py-2.5 rounded-xl text-sm transition-colors">Excluir</button><button onClick={() => setConfirmDel(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
