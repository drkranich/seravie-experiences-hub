import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon } from '../ui'

// Player / consumo do curso — assistir as aulas cadastradas no editor.
// Suporta vídeo: upload (Supabase <video>), Cloudflare Stream (iframe embed),
// YouTube/Vimeo/link (iframe). Marca conclusão por aula e calcula progresso real.

function ytId(url) { const m = String(url).match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/); return m ? m[1] : null }
function vimeoId(url) { const m = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/); return m ? m[1] : null }

function VideoPlayer({ lesson }) {
  if (!lesson) return null
  const { video_provider, video_kind, video_url, stream_uid } = lesson

  if (video_provider === 'cloudflare_stream' && stream_uid) {
    const hash = (typeof window !== 'undefined' && window.__CF_STREAM_HASH) || null
    const src = hash ? `https://customer-${hash}.cloudflarestream.com/${stream_uid}/iframe` : `https://iframe.cloudflarestream.com/${stream_uid}`
    return <iframe src={src} className="w-full h-full" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;" allowFullScreen title={lesson.title} />
  }
  if (video_kind === 'youtube' || ytId(video_url)) {
    const id = ytId(video_url)
    if (id) return <iframe src={`https://www.youtube.com/embed/${id}`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={lesson.title} />
  }
  if (video_kind === 'vimeo' || vimeoId(video_url)) {
    const id = vimeoId(video_url)
    if (id) return <iframe src={`https://player.vimeo.com/video/${id}`} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={lesson.title} />
  }
  if (video_url) {
    // upload direto (Supabase) ou link direto de arquivo
    if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(video_url) || video_provider === 'supabase') {
      return <video src={video_url} controls className="w-full h-full bg-black" />
    }
    return <iframe src={video_url} className="w-full h-full" allowFullScreen title={lesson.title} />
  }
  return <div className="w-full h-full flex items-center justify-center text-admin-muted/40 text-sm">Esta aula ainda não tem vídeo.</div>
}

export function CoursePlayer({ course, enrollment, me, onBack, onProgress, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [lessons, setLessons] = useState([])
  const [done, setDone] = useState(new Set()) // lesson_ids concluídos
  const [current, setCurrent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const [{ data: ls }, { data: prog }] = await Promise.all([
          supabase.from('network_academy_lessons').select('*').eq('course_id', course.id).order('sort', { ascending: true }),
          enrollment?.id ? supabase.from('network_lesson_progress').select('lesson_id').eq('enrollment_id', enrollment.id) : Promise.resolve({ data: [] }),
        ])
        if (!alive) return
        setLessons(ls || [])
        setDone(new Set((prog || []).map((p) => p.lesson_id)))
        setCurrent((ls || [])[0] || null)
      } catch { /* noop */ } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [course.id, enrollment?.id])

  const modules = useMemo(() => {
    const g = {}
    lessons.forEach((l) => { const k = l.module || 'Conteúdo'; (g[k] ||= []).push(l) })
    return Object.entries(g)
  }, [lessons])

  const pct = lessons.length ? Math.round((done.size / lessons.length) * 100) : 0

  const toggleDone = async (lesson) => {
    if (!enrollment?.id) return notify?.('Inscreva-se no curso para salvar seu progresso.', 'info')
    const has = done.has(lesson.id)
    const next = new Set(done); has ? next.delete(lesson.id) : next.add(lesson.id); setDone(next)
    try {
      if (has) await supabase.from('network_lesson_progress').delete().eq('lesson_id', lesson.id).eq('tenant_id', tenantId).eq('member_id', me?.id || null)
      else await supabase.from('network_lesson_progress').upsert({ tenant_id: tenantId, enrollment_id: enrollment.id, lesson_id: lesson.id, member_id: me?.id || null, completed: true }, { onConflict: 'lesson_id,tenant_id,member_id' })
      const newPct = lessons.length ? Math.round((next.size / lessons.length) * 100) : 0
      await supabase.from('network_academy_enrollments').update({ progress: newPct, completed: newPct >= 100 }).eq('id', enrollment.id)
      onProgress?.(course, newPct)
      if (newPct >= 100) notify?.('Curso concluído! 🎓', 'success')
    } catch { /* noop */ }
  }

  const idx = current ? lessons.findIndex((l) => l.id === current.id) : -1
  const goNext = () => { if (idx >= 0 && idx < lessons.length - 1) setCurrent(lessons[idx + 1]) }
  const goPrev = () => { if (idx > 0) setCurrent(lessons[idx - 1]) }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-admin-muted/60 hover:text-admin-text text-sm mb-4 transition-colors"><Icon name="down" className="w-4 h-4 rotate-90" /> Voltar aos cursos</button>

      {course.format && course.format !== 'gravado' && course.live_url && (
        <div className="glass-soft rounded-2xl p-4 mb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-sm text-admin-text/85"><span className="w-2 h-2 rounded-full bg-admin-rose animate-pulse" />Aula ao vivo{course.live_at ? ` · ${new Date(course.live_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</div>
          <a href={course.live_url} target="_blank" rel="noreferrer" className="text-sm bg-admin-rose/15 hover:bg-admin-rose/25 text-admin-rose px-4 py-2 rounded-xl transition-colors flex items-center gap-2"><Icon name="play" className="w-4 h-4" />Entrar na transmissão</a>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* player + info */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl overflow-hidden bg-black aspect-video glass">
            <VideoPlayer lesson={current} />
          </div>
          <div className="mt-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="font-serif text-xl text-admin-text">{current?.title || course.title}</h1>
                {current?.module && <p className="text-admin-champ/60 text-xs mt-0.5">{current.module}</p>}
              </div>
              {current && (
                <button onClick={() => toggleDone(current)} className={`text-sm px-4 py-2 rounded-xl transition-colors flex items-center gap-2 shrink-0 ${done.has(current.id) ? 'bg-admin-sage/15 text-admin-sage' : 'bg-admin-champ/12 text-admin-champ hover:bg-admin-champ/20'}`}><Icon name="check" className="w-4 h-4" />{done.has(current.id) ? 'Concluída' : 'Marcar como concluída'}</button>
              )}
            </div>
            {current?.description && <p className="text-admin-muted/65 text-sm mt-3 leading-relaxed">{current.description}</p>}
            {current?.material_url && <a href={current.material_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-admin-champ/80 hover:underline mt-3"><Icon name="download" className="w-4 h-4" />Material de apoio</a>}
            <div className="flex items-center gap-2 mt-5">
              <button onClick={goPrev} disabled={idx <= 0} className="text-sm px-4 py-2 rounded-xl glass-input text-admin-muted/70 hover:text-admin-champ disabled:opacity-30 transition-colors flex items-center gap-1.5"><Icon name="down" className="w-4 h-4 rotate-90" />Anterior</button>
              <button onClick={goNext} disabled={idx < 0 || idx >= lessons.length - 1} className="text-sm px-4 py-2 rounded-xl bg-admin-champ/12 text-admin-champ hover:bg-admin-champ/20 disabled:opacity-30 transition-colors flex items-center gap-1.5">Próxima<Icon name="down" className="w-4 h-4 -rotate-90" /></button>
            </div>
          </div>
        </div>

        {/* currículo lateral */}
        <div>
          <div className="glass rounded-2xl p-4 mb-3">
            <div className="flex items-center justify-between text-xs mb-2"><span className="text-admin-muted/50">Seu progresso</span><span className="text-admin-champ">{pct}%</span></div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-gradient-to-r from-admin-champ to-admin-copper transition-all" style={{ width: `${pct}%` }} /></div>
            <p className="text-admin-muted/40 text-[11px] mt-2">{done.size} de {lessons.length} aulas concluídas</p>
          </div>
          {loading ? <div className="glass rounded-2xl h-64 animate-pulse opacity-40" />
            : lessons.length === 0 ? <div className="glass rounded-2xl p-8 text-center"><p className="text-admin-muted/50 text-sm">Este curso ainda não tem aulas cadastradas.</p></div>
              : <div className="glass rounded-2xl overflow-hidden max-h-[70vh] overflow-y-auto">
                  {modules.map(([mod, ls]) => (
                    <div key={mod}>
                      <p className="text-[10px] uppercase tracking-wider text-admin-champ/60 px-4 pt-3 pb-1">{mod}</p>
                      {ls.map((l) => { const active = current?.id === l.id; const isDone = done.has(l.id); return (
                        <button key={l.id} onClick={() => setCurrent(l)} className={`w-full flex items-center gap-3 px-4 py-3 text-left border-l-2 transition-colors ${active ? 'border-admin-champ bg-admin-champ/[0.06]' : 'border-transparent hover:bg-white/[0.02]'}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isDone ? 'bg-admin-sage/20 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/50'}`}>{isDone ? <Icon name="check" className="w-3.5 h-3.5" /> : <Icon name="play" className="w-3 h-3" />}</div>
                          <div className="min-w-0 flex-1"><p className={`text-sm truncate ${active ? 'text-admin-champ' : 'text-admin-text'}`}>{l.title}</p><p className="text-admin-muted/40 text-[11px]">{l.duration || ''}{l.is_preview ? ' · amostra' : ''}</p></div>
                        </button>
                      )})}
                    </div>
                  ))}
                </div>}
        </div>
      </div>
    </div>
  )
}
