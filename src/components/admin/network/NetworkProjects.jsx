import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { initials, timeAgo } from '../../../lib/networkSocial'

// Projetos colaborativos — equipe convidada da rede trabalha junto no projeto.

const ROLES = ['Arquiteto', 'Designer', 'Fornecedor', 'Fotógrafo', 'Marceneiro', 'Consultor', 'Gerente']

function Avatar({ name, url, size = 'w-8 h-8', text = 'text-[11px]' }) {
  return url ? <img src={url} alt={name} className={`${size} rounded-full object-cover`} />
    : <div className={`${size} rounded-full bg-admin-champ/15 text-admin-champ flex items-center justify-center ${text} font-medium`}>{initials(name)}</div>
}

export function NetworkProjects({ me, notify }) {
  const { profile } = useTenant()
  const { user } = useAuth()
  const tenantId = profile?.tenant_id
  const [projects, setProjects] = useState([])
  const [teams, setTeams] = useState({})
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: ps }, { data: pm }, { data: mem }] = await Promise.all([
        supabase.from('network_projects').select('*').order('created_at', { ascending: false }),
        supabase.from('network_project_members').select('*'),
        supabase.from('network_members').select('id,name,avatar_url,role_title,headline').eq('status', 'active').limit(300),
      ])
      const g = {}; (pm || []).forEach((r) => { (g[r.project_id] ||= []).push(r) })
      setProjects(ps || []); setTeams(g); setMembers(mem || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const create = async (payload) => {
    const { data, error } = await supabase.from('network_projects').insert({ ...payload, tenant_id: tenantId, owner_id: user?.id }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setProjects((p) => [data, ...p]); setCreating(false); notify?.('Projeto criado', 'success')
  }

  if (open) {
    const fresh = projects.find((p) => p.id === open.id) || open
    return <ProjectRoom project={fresh} team={teams[open.id] || []} members={members} tenantId={tenantId} onBack={() => { setOpen(null); load() }} reload={load} notify={notify} />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Projetos colaborativos</h1><p className="text-admin-muted/50 text-sm mt-1">Monte uma equipe da rede e trabalhem juntos.</p></div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Novo projeto</button>
      </div>

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass rounded-2xl h-40 animate-pulse opacity-40" />)}</div>
        : projects.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="layout" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Nenhum projeto colaborativo ainda.</p><p className="text-admin-muted/35 text-xs mt-1">Crie um projeto e convide a equipe da rede.</p></div>
          : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((p) => { const team = teams[p.id] || []; return (
                <button key={p.id} onClick={() => setOpen(p)} className="group glass rounded-2xl overflow-hidden text-left hover:ring-1 hover:ring-admin-champ/30 transition-all">
                  <div className="h-28 bg-gradient-to-br from-admin-champ/15 to-admin-copper/10 flex items-center justify-center">{p.cover_url ? <img src={p.cover_url} alt="" className="w-full h-full object-cover" /> : <Icon name="layout" className="w-8 h-8 text-admin-champ/25" />}</div>
                  <div className="p-4">
                    <p className="text-admin-text font-medium">{p.name}</p>
                    {p.description && <p className="text-admin-muted/50 text-xs mt-1 line-clamp-2">{p.description}</p>}
                    <div className="flex items-center gap-1 mt-3">{team.slice(0, 4).map((t) => { const mem = members.find((m) => m.id === t.member_id); return <Avatar key={t.id} name={mem?.name} url={mem?.avatar_url} size="w-6 h-6" text="text-[9px]" /> })}<span className="text-admin-muted/40 text-[11px] ml-1">{team.length} na equipe</span></div>
                  </div>
                </button>
              )})}
            </div>}

      {creating && <CreateModal onClose={() => setCreating(false)} onCreate={create} />}
    </div>
  )
}

function CreateModal({ onClose, onCreate }) {
  const [f, setF] = useState({ name: '', description: '' })
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Novo projeto</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <input value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} placeholder="Nome do projeto (ex.: Boutique Gourmet)" className={cls} />
          <textarea value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} rows={3} placeholder="Descrição" className={`${cls} resize-none`} />
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => f.name.trim() && onCreate({ name: f.name, description: f.description || null, status: 'active' })} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Criar</button></div>
      </div>
    </div>
  )
}

function ProjectRoom({ project, team, members, tenantId, onBack, reload, notify }) {
  const [inviting, setInviting] = useState(false)
  const [pick, setPick] = useState('')
  const [role, setRole] = useState(ROLES[0])
  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])
  const available = members.filter((m) => !team.some((t) => t.member_id === m.id))

  const invite = async () => {
    if (!pick) return
    const { error } = await supabase.from('network_project_members').insert({ tenant_id: tenantId, project_id: project.id, member_id: pick, role })
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setInviting(false); setPick(''); notify?.('Membro convidado', 'success'); reload()
  }
  const remove = async (id) => { await supabase.from('network_project_members').delete().eq('id', id); reload() }

  const share = async () => {
    let token = project.share_token
    if (!token || !project.is_public) {
      token = 'n' + Math.abs(project.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7)).toString(36) + project.id.slice(0, 8)
      await supabase.from('network_projects').update({ share_token: token, is_public: true }).eq('id', project.id)
    }
    const url = `${window.location.origin}/projeto/${token}`
    try { await navigator.clipboard.writeText(url); notify?.('Link do projeto copiado!', 'success') } catch { notify?.('Link: ' + url, 'info') }
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-admin-muted/60 hover:text-admin-text text-sm mb-4 transition-colors"><Icon name="down" className="w-4 h-4 rotate-90" /> Voltar aos projetos</button>
      <div className="glass rounded-2xl p-6 mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl text-admin-text">{project.name}</h1>
          {project.description && <p className="text-admin-muted/65 text-sm mt-2 max-w-2xl">{project.description}</p>}
        </div>
        <button onClick={share} className="flex items-center gap-2 glass-input text-admin-muted/70 hover:text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="share" className="w-4 h-4" />Compartilhar link</button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] uppercase tracking-wider text-admin-champ/70">Equipe do projeto</h3>
        <button onClick={() => setInviting(true)} className="text-xs text-admin-champ/80 hover:text-admin-champ flex items-center gap-1"><Icon name="plus" className="w-3.5 h-3.5" />Convidar</button>
      </div>
      {team.length === 0 ? <div className="glass rounded-2xl p-8 text-center"><p className="text-admin-muted/50 text-sm">Nenhum membro na equipe ainda.</p></div>
        : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {team.map((t) => { const m = memberById[t.member_id]; return (
              <div key={t.id} className="glass rounded-xl p-4 flex items-center gap-3 group">
                <Avatar name={m?.name} url={m?.avatar_url} size="w-10 h-10" text="text-sm" />
                <div className="min-w-0 flex-1"><p className="text-admin-text text-sm truncate">{m?.name || 'Membro'}</p><p className="text-admin-muted/40 text-[11px]">{t.role || m?.role_title || 'Colaborador'}</p></div>
                <button onClick={() => remove(t.id)} className="text-admin-muted/30 hover:text-admin-rose opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="x" className="w-3.5 h-3.5" /></button>
              </div>
            )})}
          </div>}

      {inviting && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setInviting(false)}>
          <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Convidar para o projeto</h2><button onClick={() => setInviting(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            {available.length === 0 ? <p className="text-admin-muted/50 text-sm">Todos os membros já estão na equipe.</p> : (
              <div className="space-y-3">
                <GlassSelect value={pick} onChange={setPick} options={[{ value: '', label: 'Selecione um membro' }, ...available.map((m) => ({ value: m.id, label: `${m.name}${m.role_title ? ' · ' + m.role_title : ''}` }))]} />
                <GlassSelect value={role} onChange={setRole} options={ROLES.map((r) => ({ value: r, label: r }))} />
                <div className="flex justify-end gap-2 pt-1"><button onClick={() => setInviting(false)} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={invite} disabled={!pick} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50">Convidar</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
