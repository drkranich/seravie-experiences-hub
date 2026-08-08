import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'
import { timeAgo, initials } from '../../../lib/networkSocial'
import { uploadTo } from '../../../lib/storage'

// Experience Stories — versão profissional dos stories (obras, bastidores, inaugurações).
// Faixa horizontal no topo do feed + visualizador em tela cheia.

const KINDS = { obra: 'Obra', bastidor: 'Bastidor', inauguracao: 'Inauguração', evento: 'Evento', produto: 'Novo produto' }

export function StoriesStrip({ me, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [stories, setStories] = useState([])
  const [viewing, setViewing] = useState(null) // índice
  const [adding, setAdding] = useState(false)
  const addRef = useRef(null)

  const load = useCallback(async () => {
    // stories das últimas 48h (efêmeros)
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    const { data } = await supabase.from('network_stories').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(40)
    setStories(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const onAdd = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const isImg = file.type.startsWith('image/')
    const r = await uploadTo(file, { folder: 'network/stories', accept: 'any', maxMB: 40 })
    if (addRef.current) addRef.current.value = ''
    if (r.error) return notify?.(r.error, 'error')
    const { data, error } = await supabase.from('network_stories').insert({ tenant_id: tenantId, member_id: me?.id, author_name: me?.name || 'Você', author_avatar: me?.avatar_url || null, media_url: r.url, media_type: isImg ? 'image' : 'video', kind: 'obra' }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setStories((s) => [data, ...s]); setAdding(false); notify?.('Story publicado', 'success')
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {/* adicionar */}
        <button onClick={() => addRef.current?.click()} className="shrink-0 flex flex-col items-center gap-1.5 w-16">
          <div className="w-16 h-16 rounded-full ring-2 ring-dashed ring-admin-champ/40 flex items-center justify-center text-admin-champ/70 hover:bg-admin-champ/5 transition-colors"><Icon name="plus" className="w-5 h-5" /></div>
          <span className="text-[10px] text-admin-muted/50">Seu story</span>
        </button>
        <input ref={addRef} type="file" accept="image/*,video/*" onChange={onAdd} className="hidden" />
        {stories.map((st, i) => (
          <button key={st.id} onClick={() => setViewing(i)} className="shrink-0 flex flex-col items-center gap-1.5 w-16">
            <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-br from-admin-champ to-admin-copper">
              <div className="w-full h-full rounded-full overflow-hidden bg-admin-side">
                {st.media_type === 'image' ? <img src={st.media_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Icon name="play" className="w-5 h-5 text-white/70" /></div>}
              </div>
            </div>
            <span className="text-[10px] text-admin-muted/60 truncate w-full text-center">{st.author_name?.split(' ')[0] || 'Membro'}</span>
          </button>
        ))}
      </div>

      {viewing != null && stories[viewing] && (
        <StoryViewer stories={stories} index={viewing} onClose={() => setViewing(null)} onNav={setViewing} />
      )}
    </div>
  )
}

function StoryViewer({ stories, index, onClose, onNav }) {
  const st = stories[index]
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <button onClick={(e) => { e.stopPropagation(); index > 0 && onNav(index - 1) }} className={`absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 ${index === 0 ? 'opacity-20' : 'hover:bg-white/20'}`}><Icon name="down" className="w-5 h-5 rotate-90" /></button>
      <div className="relative max-w-sm w-full max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 absolute top-0 left-0 right-0 p-4 z-10 bg-gradient-to-b from-black/60 to-transparent rounded-t-2xl">
          {st.author_avatar ? <img src={st.author_avatar} alt="" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-admin-champ/20 text-admin-champ flex items-center justify-center text-[11px]">{initials(st.author_name)}</div>}
          <div className="flex-1 min-w-0"><p className="text-white text-sm truncate">{st.author_name}</p><p className="text-white/50 text-[10px]">{KINDS[st.kind] || ''} · {timeAgo(st.created_at)}</p></div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><Icon name="x" className="w-5 h-5" /></button>
        </div>
        <div className="rounded-2xl overflow-hidden bg-black">
          {st.media_type === 'image' ? <img src={st.media_url} alt="" className="w-full max-h-[85vh] object-contain" /> : <video src={st.media_url} controls autoPlay className="w-full max-h-[85vh]" />}
        </div>
        {st.caption && <p className="text-white/80 text-sm absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">{st.caption}</p>}
      </div>
      <button onClick={(e) => { e.stopPropagation(); index < stories.length - 1 && onNav(index + 1) }} className={`absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 ${index === stories.length - 1 ? 'opacity-20' : 'hover:bg-white/20'}`}><Icon name="down" className="w-5 h-5 -rotate-90" /></button>
    </div>
  )
}
