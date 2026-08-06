import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'

export function SuperAdminPanel({ notify }) {
  const { profile, isSuperAdmin } = useTenant()
  const [tab, setTab] = useState('tenants')
  const [tenants, setTenants] = useState([])
  const [flags, setFlags] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role_slug: 'attendant' })

  const loadTenants = async () => { setLoading(true); const { data } = await supabase.from('tenants').select('*, subscriptions(status, billing_cycle)').order('created_at'); setTenants(data || []); setLoading(false) }
  const loadFlags = async () => { setLoading(true); const { data } = await supabase.from('feature_flags').select('*').order('name'); setFlags(data || []); setLoading(false) }
  const loadMembers = async () => { setLoading(true); const { data } = await supabase.from('memberships').select('*, roles(name, slug)').order('created_at'); setMembers(data || []); setLoading(false) }

  useEffect(() => {
    if (tab === 'tenants') loadTenants()
    else if (tab === 'flags') loadFlags()
    else if (tab === 'members') loadMembers()
  }, [tab])

  const toggleFlag = async (flag) => {
    await supabase.from('feature_flags').update({ is_active: !flag.is_active }).eq('id', flag.id)
    loadFlags(); notify(flag.is_active ? 'Flag desativada' : 'Flag ativada', 'success')
  }

  const invite = async () => {
    if (!inviteForm.email.trim()) { notify('E-mail obrigatório', 'error'); return }
    const { data: role } = await supabase.from('roles').select('id').eq('slug', inviteForm.role_slug).eq('tenant_id', profile?.tenant_id).single()
    if (!role) { notify('Role não encontrado', 'error'); return }
    const { error } = await supabase.from('invitations').insert({ tenant_id: profile?.tenant_id, email: inviteForm.email, role_id: role.id, invited_by: profile?.user_id })
    if (error) { notify('Erro ao convidar', 'error'); return }
    notify('Convite enviado', 'success'); setShowInvite(false); setInviteForm({ email: '', role_slug: 'attendant' })
  }

  if (!isSuperAdmin()) return (
    <div className="glass rounded-2xl p-12 text-center">
      <Icon name="x" className="w-10 h-10 text-admin-rose/30 mx-auto mb-3" />
      <p className="text-admin-muted/50 text-sm">Acesso restrito a Super Admin</p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Super Admin</h1><p className="text-admin-muted/60 text-sm mt-1">Gestão da plataforma</p></div>
        {tab === 'members' && <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Convidar usuário</button>}
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['tenants','Tenants'],['members','Usuários'],['flags','Feature Flags']].map(([k,v]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab===k?'bg-admin-champ/15 text-admin-champ':'text-admin-muted hover:text-admin-text'}`}>{v}</button>
        ))}
      </div>

      {tab === 'tenants' && (
        <div className="space-y-2">
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
            : tenants.map(t => (
              <div key={t.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-admin-champ/10 flex items-center justify-center shrink-0"><span className="text-admin-champ text-sm font-serif">{t.name[0]}</span></div>
                <div className="flex-1 min-w-0">
                  <p className="text-admin-text text-sm font-medium">{t.name}</p>
                  <p className="text-admin-muted/40 text-xs">{t.slug} · {t.domain || 'sem domínio'}{t.stripe_charges_enabled ? ' · Stripe ✓' : t.stripe_account_id ? ' · Stripe pendente' : ''}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0" title="Comissão da plataforma sobre as vendas deste tenant (Connect)">
                  <span className="text-admin-muted/30 text-[9px] uppercase">com.</span>
                  <input type="number" min="0" max="100" step="0.5" defaultValue={t.platform_fee_percent ?? 0}
                    onBlur={async (e) => { const v = Math.max(0, Math.min(100, Number(e.target.value) || 0)); await supabase.from('tenants').update({ platform_fee_percent: v }).eq('id', t.id); notify('Comissão atualizada', 'success') }}
                    className="w-12 glass-input rounded-lg px-2 py-1 text-xs text-admin-text outline-none text-right" />
                  <span className="text-admin-muted/40 text-xs">%</span>
                </div>
                <button onClick={async () => { const v = !t.is_franchise; await supabase.from('tenants').update({ is_franchise: v }).eq('id', t.id); loadTenants(); notify(v ? 'Marcado como franquia' : 'Franquia removida', 'success') }}
                  title="Marcar este tenant como unidade franqueada" className={`text-[10px] px-2 py-1 rounded-lg shrink-0 transition-colors ${t.is_franchise ? 'bg-admin-gold/15 text-admin-gold' : 'bg-white/[0.04] text-admin-muted/40 hover:text-admin-muted'}`}>Franquia</button>
                {t.is_franchise && (
                  <div className="flex items-center gap-1 shrink-0" title="Royalty sobre o faturamento da unidade">
                    <span className="text-admin-muted/30 text-[9px] uppercase">roy.</span>
                    <input type="number" min="0" max="100" step="0.5" defaultValue={t.royalty_percent ?? 0}
                      onBlur={async (e) => { const v = Math.max(0, Math.min(100, Number(e.target.value) || 0)); await supabase.from('tenants').update({ royalty_percent: v }).eq('id', t.id); notify('Royalty atualizado', 'success') }}
                      className="w-12 glass-input rounded-lg px-2 py-1 text-xs text-admin-gold outline-none text-right" />
                    <span className="text-admin-gold/60 text-xs">%</span>
                  </div>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-lg ${t.status === 'active' ? 'bg-admin-sage/10 text-admin-sage' : 'bg-white/[0.04] text-admin-muted/40'}`}>{t.status}</span>
                <p className="text-admin-muted/30 text-[10px] shrink-0">{new Date(t.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            ))
          }
        </div>
      )}

      {tab === 'members' && (
        <div className="space-y-2">
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
            : members.map(m => (
              <div key={m.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                <div className="w-7 h-7 rounded-full bg-admin-champ/15 flex items-center justify-center shrink-0"><Icon name="user" className="w-3.5 h-3.5 text-admin-champ" /></div>
                <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{m.user_id}</p><p className="text-admin-muted/40 text-xs">{m.roles?.name}</p></div>
                <span className={`text-[10px] px-2 py-0.5 rounded-lg ${m.status === 'active' ? 'bg-admin-sage/10 text-admin-sage' : 'bg-white/[0.04] text-admin-muted/40'}`}>{m.status}</span>
              </div>
            ))
          }
        </div>
      )}

      {tab === 'flags' && (
        <div className="space-y-2">
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
            : flags.map(f => (
              <div key={f.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                <div className="flex-1 min-w-0"><p className="text-admin-text text-sm font-mono">{f.name}</p><p className="text-admin-muted/40 text-xs">{f.description}</p></div>
                <span className="text-admin-muted/30 text-xs">{f.rollout_percentage}%</span>
                <button onClick={() => toggleFlag(f)} className={`text-[10px] px-3 py-1.5 rounded-lg transition-colors ${f.is_active ? 'bg-admin-sage/10 text-admin-sage hover:bg-admin-rose/10 hover:text-admin-rose' : 'bg-white/[0.04] text-admin-muted/40 hover:bg-admin-champ/10 hover:text-admin-champ'}`}>
                  {f.is_active ? 'on' : 'off'}
                </button>
              </div>
            ))
          }
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Convidar usuário</h2><button onClick={() => setShowInvite(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="space-y-4">
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">E-mail *</label><input type="email" value={inviteForm.email} onChange={e => setInviteForm(f => ({...f, email: e.target.value}))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Papel</label><GlassSelect value={inviteForm.role_slug} onChange={v => setInviteForm(f => ({...f, role_slug: v}))} options={['admin','manager','attendant','collaborator']} /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={invite} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Enviar convite</button><button onClick={() => setShowInvite(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
