import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'
import { COMMUNITY_THEMES } from '../../../lib/networkSocial'
import { useCommunityThemes } from '../../../lib/communityThemes'

// Comunidades — entrar/sair, ver membros. Curadoria inicial semeia temas reais.

export function Communities({ me, notify }) {
  const { profile } = useTenant()
  const { user } = useAuth()
  const tenantId = profile?.tenant_id
  const [communities, setCommunities] = useState([])
  const [myMemberships, setMyMemberships] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [customOpen, setCustomOpen] = useState(false)
  const themes = useCommunityThemes()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: cs }, { data: ms }] = await Promise.all([
        supabase.from('network_communities').select('*').order('members_count', { ascending: false }),
        supabase.from('network_community_members').select('community_id').eq('user_id', user?.id || '00000000-0000-0000-0000-000000000000'),
      ])
      setCommunities(cs || []); setMyMemberships(new Set((ms || []).map((m) => m.community_id)))
    } catch { /* noop */ } finally { setLoading(false) }
  }, [user])
  useEffect(() => { load() }, [load])

  const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const seed = async (theme) => {
    const slug = theme.slug || slugify(theme.name)
    if (communities.some((c) => c.slug === slug)) return notify?.('Essa comunidade já existe.', 'error')
    const { data, error } = await supabase.from('network_communities').insert({ tenant_id: tenantId, name: theme.name, slug, theme: slug, description: theme.description || null, members_count: 0, status: 'active' }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setCommunities((c) => [data, ...c]); notify?.(`Comunidade "${theme.name}" criada`, 'success')
    return data
  }
  const createCustom = async ({ name, description }) => {
    const created = await seed({ name: name.trim(), description: description?.trim() || null })
    if (created) setCustomOpen(false)
  }
  const toggle = async (c) => {
    const has = myMemberships.has(c.id)
    setMyMemberships((prev) => { const n = new Set(prev); has ? n.delete(c.id) : n.add(c.id); return n })
    setCommunities((prev) => prev.map((x) => x.id === c.id ? { ...x, members_count: Math.max(0, (x.members_count || 0) + (has ? -1 : 1)) } : x))
    try {
      if (has) await supabase.from('network_community_members').delete().eq('community_id', c.id).eq('user_id', user?.id)
      else await supabase.from('network_community_members').insert({ tenant_id: tenantId, community_id: c.id, user_id: user?.id, member_name: me?.name || 'Membro' })
      await supabase.from('network_communities').update({ members_count: Math.max(0, (c.members_count || 0) + (has ? -1 : 1)) }).eq('id', c.id)
    } catch { /* noop */ }
  }

  const existingSlugs = new Set(communities.map((c) => c.slug))
  const suggestions = (themes || COMMUNITY_THEMES).filter((t) => !existingSlugs.has(t.slug))
  // agrupa sugestões por categoria (mantém ordem de aparição)
  const grouped = suggestions.reduce((acc, t) => { const k = t.category || 'Outras'; (acc[k] = acc[k] || []).push(t); return acc }, {})
  const groupKeys = Object.keys(grouped)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
        <div><h1 className="font-serif text-2xl text-admin-text">Comunidades</h1><p className="text-admin-muted/50 text-sm mt-1">Fóruns e grupos por área do ecossistema.</p></div>
        <button onClick={() => setCustomOpen(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Nova comunidade</button>
      </div>

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-36 animate-pulse opacity-40" />)}</div> : (
        <>
          {communities.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {communities.map((c) => { const joined = myMemberships.has(c.id); return (
                <div key={c.id} className="glass rounded-2xl overflow-hidden">
                  <div className="h-24 bg-gradient-to-br from-admin-champ/15 to-admin-copper/10 flex items-center justify-center">{c.cover_url ? <img src={c.cover_url} alt="" className="w-full h-full object-cover" /> : <Icon name="users" className="w-8 h-8 text-admin-champ/25" />}</div>
                  <div className="p-4">
                    <p className="text-admin-text font-medium">{c.name}</p>
                    <p className="text-admin-muted/45 text-xs mt-0.5">{(c.members_count || 0).toLocaleString('pt-BR')} membros</p>
                    {c.description && <p className="text-admin-muted/50 text-xs mt-2 line-clamp-2">{c.description}</p>}
                    <button onClick={() => toggle(c)} className={`mt-3 w-full py-2 rounded-xl text-sm transition-colors ${joined ? 'bg-admin-sage/12 text-admin-sage' : 'bg-admin-champ/12 text-admin-champ hover:bg-admin-champ/20'}`}>{joined ? '✓ Participando' : 'Participar'}</button>
                  </div>
                </div>
              )})}
            </div>
          )}

          <div>
            {!communities.length && <p className="text-[11px] uppercase tracking-wider text-admin-champ/60 mb-4">Comece criando comunidades</p>}
            {suggestions.length > 0 ? (
              <div className="space-y-4">
                {groupKeys.map((g) => (
                  <div key={g}>
                    {groupKeys.length > 1 && <p className="text-[10px] uppercase tracking-wider text-admin-muted/40 mb-2">{g}</p>}
                    <div className="flex flex-wrap gap-2">
                      {grouped[g].map((t) => <button key={t.slug} onClick={() => seed(t)} title={t.description || ''} className="text-xs px-3 py-2 rounded-xl bg-white/[0.04] text-admin-muted/70 hover:text-admin-champ hover:bg-admin-champ/10 transition-colors flex items-center gap-1.5"><Icon name="plus" className="w-3.5 h-3.5" />{t.name}</button>)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <button onClick={() => setCustomOpen(true)} className="text-xs px-3 py-2 rounded-xl bg-white/[0.04] text-admin-muted/70 hover:text-admin-champ hover:bg-admin-champ/10 transition-colors flex items-center gap-1.5"><Icon name="plus" className="w-3.5 h-3.5" />Criar comunidade personalizada</button>
            )}
          </div>
        </>
      )}

      {customOpen && <CustomCommunityModal onClose={() => setCustomOpen(false)} onCreate={createCustom} />}
    </div>
  )
}

function CustomCommunityModal({ onClose, onCreate }) {
  const [f, setF] = useState({ name: '', description: '' })
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Nova comunidade</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <input value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} placeholder="Nome da comunidade *" className={cls} autoFocus />
          <textarea value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} rows={3} placeholder="Descrição (opcional)" className={`${cls} resize-none`} />
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={() => f.name.trim() && onCreate(f)} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Criar comunidade</button></div>
      </div>
    </div>
  )
}
