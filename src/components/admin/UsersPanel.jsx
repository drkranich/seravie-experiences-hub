import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { useAuth } from '../../hooks/useAuth'
import { Icon, GlassSelect } from './ui'
import { logAudit } from '../../lib/audit'

const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e9)}`)
const STATUS_STYLE = { active: 'text-admin-sage', invited: 'text-admin-gold', inactive: 'text-admin-muted/50', suspended: 'text-admin-rose' }

export function UsersPanel({ notify }) {
  const { profile, isAdmin } = useTenant()
  const { user } = useAuth()
  const tenantId = profile?.tenant_id
  const [roles, setRoles] = useState([])
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ email: '', role_id: '' })
  const [lastLink, setLastLink] = useState(null)

  const load = async () => {
    setLoading(true)
    const [r, m, i] = await Promise.all([
      supabase.from('roles').select('id, name, slug').order('name'),
      supabase.from('memberships').select('*, roles(name, slug)').order('created_at', { ascending: false }),
      supabase.from('invitations').select('*, roles(name)').is('accepted_at', null).order('created_at', { ascending: false }),
    ])
    setRoles(r.data || []); setMembers(m.data || []); setInvites(i.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const linkFor = (token) => `${window.location.origin}/#convite/${token}`

  const invite = async () => {
    const email = form.email.trim().toLowerCase()
    if (!email) return notify('Informe o e-mail', 'error')
    if (!form.role_id) return notify('Escolha o papel', 'error')
    const token = uuid()
    const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    const { data, error } = await supabase.from('invitations').insert({ tenant_id: tenantId, email, role_id: form.role_id, token, invited_by: user?.id || null, expires_at: expires }).select('id, token').single()
    if (error) return notify('Erro ao convidar: ' + error.message, 'error')
    logAudit({ action: 'create', resource_type: 'invitations', resource_id: data?.id, new_data: { email, role_id: form.role_id } }, tenantId)
    setLastLink(linkFor(token)); setForm({ email: '', role_id: '' }); setModal(false); load()
    notify('Convite criado — copie o link e envie', 'success')
  }
  const revoke = async (inv) => {
    await supabase.from('invitations').delete().eq('id', inv.id)
    logAudit({ action: 'delete', resource_type: 'invitations', resource_id: inv.id, old_data: inv }, tenantId)
    notify('Convite revogado', 'success'); load()
  }
  const setMemberStatus = async (m, status) => {
    await supabase.from('memberships').update({ status }).eq('id', m.id)
    notify(status === 'active' ? 'Usuário reativado' : 'Usuário desativado', 'success'); load()
  }
  const copy = (text) => { navigator.clipboard?.writeText(text); notify('Link copiado', 'success') }

  if (isAdmin && !isAdmin()) return (
    <div className="glass rounded-2xl p-12 text-center"><Icon name="user" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/50 text-sm">Área restrita a administradores.</p></div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div><h1 className="font-serif text-4xl text-admin-text">Usuários & Acessos</h1><p className="text-admin-muted/60 text-sm mt-1">{members.length} membros · {invites.length} convites pendentes</p></div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Convidar</button>
      </div>

      {lastLink && (
        <div className="glass-soft rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-admin-champ/70">Link do convite (envie para a pessoa)</p><p className="text-admin-champ/80 text-xs truncate">{lastLink}</p></div>
          <button onClick={() => copy(lastLink)} className="border border-admin-champ/20 text-admin-champ/80 px-3 py-1.5 rounded-lg text-xs hover:bg-white/[0.04] transition-colors shrink-0">Copiar link</button>
        </div>
      )}

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p> : (
        <div className="grid lg:grid-cols-2 gap-5">
          <div>
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Membros</p>
            <div className="space-y-2">
              {members.length === 0 ? <p className="text-admin-muted/40 text-sm">Nenhum membro ainda.</p> : members.map((m) => (
                <div key={m.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-full bg-admin-champ/15 flex items-center justify-center shrink-0"><span className="text-admin-champ text-xs font-serif">{(m.email || '?')[0].toUpperCase()}</span></div>
                  <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{m.email || m.user_id?.slice(0, 8)}</p><p className="text-admin-muted/40 text-xs">{m.roles?.name || '—'}</p></div>
                  <span className={`text-[10px] ${STATUS_STYLE[m.status] || 'text-admin-muted/50'}`}>{m.status}</span>
                  {m.roles?.slug !== 'super_admin' && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {m.status === 'active'
                        ? <button onClick={() => setMemberStatus(m, 'inactive')} className="text-[10px] text-admin-muted hover:text-admin-rose px-2">desativar</button>
                        : <button onClick={() => setMemberStatus(m, 'active')} className="text-[10px] text-admin-muted hover:text-admin-sage px-2">reativar</button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Convites pendentes</p>
            <div className="space-y-2">
              {invites.length === 0 ? <p className="text-admin-muted/40 text-sm">Nenhum convite pendente.</p> : invites.map((inv) => (
                <div key={inv.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3 group">
                  <Icon name="mail" className="w-4 h-4 text-admin-gold/70 shrink-0" />
                  <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{inv.email}</p><p className="text-admin-muted/40 text-xs">{inv.roles?.name || '—'} · expira {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString('pt-BR') : '—'}</p></div>
                  <button onClick={() => copy(linkFor(inv.token))} className="text-[10px] text-admin-champ/70 hover:text-admin-champ px-2">copiar link</button>
                  <button onClick={() => revoke(inv)} className="text-[10px] text-admin-muted hover:text-admin-rose px-2 opacity-0 group-hover:opacity-100 transition-opacity">revogar</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-md overflow-visible">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Convidar usuário</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">E-mail *</label><input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="pessoa@email.com" /></div>
              <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Papel *</label><GlassSelect value={form.role_id} onChange={(v) => setForm((f) => ({ ...f, role_id: v }))} options={[{ value: '', label: 'Selecione o papel' }, ...roles.map((r) => ({ value: r.id, label: r.name }))]} /></div>
              <p className="text-admin-muted/40 text-xs">A pessoa recebe um link, faz login/cadastro com este e-mail e é vinculada ao seu tenant com o papel escolhido.</p>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={invite} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Gerar convite</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
