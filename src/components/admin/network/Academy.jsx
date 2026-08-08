import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { Icon, GlassSelect } from '../ui'
import { uploadTo } from '../../../lib/storage'

// Seravie Academy — trilhas e cursos do ecossistema. Membros se inscrevem,
// acompanham progresso; qualquer tenant pode publicar seus próprios cursos.

const LEVELS = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' }
const LEVEL_STYLE = { iniciante: 'bg-admin-sage/15 text-admin-sage', intermediario: 'bg-admin-gold/15 text-admin-gold', avancado: 'bg-admin-rose/15 text-admin-rose' }

export function Academy({ me, notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [courses, setCourses] = useState([])
  const [enrollments, setEnrollments] = useState({}) // course_id -> enrollment
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [creating, setCreating] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [{ data: cs }, { data: en }] = await Promise.all([
        supabase.from('network_academy_courses').select('*').eq('status', 'published').order('enrolled_count', { ascending: false }).limit(200),
        supabase.from('network_academy_enrollments').select('*').eq('tenant_id', tenantId),
      ])
      setCourses(cs || [])
      const map = {}; (en || []).forEach((e) => { map[e.course_id] = e }); setEnrollments(map)
    } catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [tenantId])

  const enroll = async (course) => {
    if (enrollments[course.id]) return notify?.('Você já está inscrito.', 'info')
    const { data, error } = await supabase.from('network_academy_enrollments').insert({ tenant_id: tenantId, course_id: course.id, member_id: me?.id, progress: 0 }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    setEnrollments((m) => ({ ...m, [course.id]: data }))
    setCourses((cs) => cs.map((c) => c.id === course.id ? { ...c, enrolled_count: (c.enrolled_count || 0) + 1 } : c))
    await supabase.from('network_academy_courses').update({ enrolled_count: (course.enrolled_count || 0) + 1 }).eq('id', course.id)
    notify?.(`Inscrito em "${course.title}"`, 'success')
  }
  const setProgress = async (course, progress) => {
    const en = enrollments[course.id]; if (!en) return
    const completed = progress >= 100
    setEnrollments((m) => ({ ...m, [course.id]: { ...en, progress, completed } }))
    await supabase.from('network_academy_enrollments').update({ progress, completed }).eq('id', en.id)
    if (completed) notify?.('Curso concluído! 🎓', 'success')
  }
  const onCreated = (c) => { setCourses((cs) => [c, ...cs]); setCreating(false); notify?.('Curso publicado', 'success') }

  const cats = useMemo(() => [...new Set(courses.map((c) => c.category).filter(Boolean))], [courses])
  const filtered = useMemo(() => {
    const nq = q.toLowerCase()
    return courses.filter((c) => (!cat || c.category === cat) && (!nq || [c.title, c.subtitle, c.instructor, c.category].join(' ').toLowerCase().includes(nq)))
  }, [courses, q, cat])
  const mine = filtered.filter((c) => enrollments[c.id])

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div><h1 className="font-serif text-2xl text-admin-text">Seravie Academy</h1><p className="text-admin-muted/50 text-sm mt-1">Trilhas e cursos para dominar a arte da experiência.</p></div>
        <div className="flex items-center gap-2">
          <div className="w-40"><GlassSelect value={cat} onChange={setCat} options={[{ value: '', label: 'Todas as áreas' }, ...cats.map((c) => ({ value: c, label: c }))]} /></div>
          <div className="flex items-center gap-2 glass-input rounded-xl px-3 py-2 w-44"><Icon name="search" className="w-4 h-4 text-admin-champ/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar curso…" className="flex-1 bg-transparent text-sm text-admin-text outline-none" /></div>
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Publicar curso</button>
        </div>
      </div>

      {mine.length > 0 && (
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-wider text-admin-champ/60 mb-3">Continuar aprendendo</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mine.map((c) => <CourseCard key={c.id} c={c} enrollment={enrollments[c.id]} onEnroll={enroll} onProgress={setProgress} />)}
          </div>
        </div>
      )}

      {loading ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass rounded-2xl h-64 animate-pulse opacity-40" />)}</div>
        : filtered.length === 0 ? <div className="glass rounded-2xl p-12 text-center"><Icon name="book" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/60 text-sm">Nenhum curso encontrado.</p></div>
          : <>
              {mine.length > 0 && <p className="text-[11px] uppercase tracking-wider text-admin-champ/60 mb-3">Todos os cursos</p>}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((c) => <CourseCard key={c.id} c={c} enrollment={enrollments[c.id]} onEnroll={enroll} onProgress={setProgress} />)}
              </div>
            </>}

      {creating && <CreateCourse tenantId={tenantId} onClose={() => setCreating(false)} onCreated={onCreated} notify={notify} />}
    </div>
  )
}

function CourseCard({ c, enrollment, onEnroll, onProgress }) {
  const enrolled = !!enrollment
  const progress = enrollment?.progress || 0
  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col">
      <div className="h-32 bg-gradient-to-br from-admin-champ/15 to-admin-copper/10 relative">
        {c.cover_url ? <img src={c.cover_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Icon name="book" className="w-8 h-8 text-admin-champ/25" /></div>}
        <span className={`absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded-lg ${LEVEL_STYLE[c.level] || LEVEL_STYLE.iniciante}`}>{LEVELS[c.level] || c.level}</span>
        {c.is_free && <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-lg bg-black/50 backdrop-blur-md text-white">Gratuito</span>}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        {c.category && <p className="text-[10px] uppercase tracking-wider text-admin-champ/60 mb-1">{c.category}</p>}
        <p className="text-admin-text font-medium leading-snug">{c.title}</p>
        {c.subtitle && <p className="text-admin-muted/50 text-xs mt-1 line-clamp-2 flex-1">{c.subtitle}</p>}
        <div className="flex items-center gap-3 mt-3 text-[11px] text-admin-muted/45">
          {c.duration && <span className="flex items-center gap-1"><Icon name="clock" className="w-3.5 h-3.5" />{c.duration}</span>}
          {c.lessons_count ? <span className="flex items-center gap-1"><Icon name="play" className="w-3.5 h-3.5" />{c.lessons_count} aulas</span> : null}
        </div>
        {c.instructor && <p className="text-admin-muted/40 text-[11px] mt-2">por {c.instructor}</p>}

        {enrolled ? (
          <div className="mt-3 pt-3 border-t border-white/[0.05]">
            <div className="flex items-center justify-between text-[11px] mb-1.5"><span className="text-admin-muted/50">{enrollment.completed ? 'Concluído' : 'Progresso'}</span><span className="text-admin-champ">{progress}%</span></div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full bg-gradient-to-r from-admin-champ to-admin-copper transition-all" style={{ width: `${progress}%` }} /></div>
            <div className="flex gap-1.5 mt-2">
              {[25, 50, 75, 100].map((p) => <button key={p} onClick={() => onProgress(c, p)} className="flex-1 text-[10px] py-1 rounded-md bg-white/[0.04] text-admin-muted/60 hover:text-admin-champ hover:bg-admin-champ/10 transition-colors">{p === 100 ? '✓ Fim' : `${p}%`}</button>)}
            </div>
          </div>
        ) : (
          <button onClick={() => onEnroll(c)} className="mt-3 w-full py-2 rounded-xl text-sm bg-admin-champ/12 text-admin-champ hover:bg-admin-champ/20 transition-colors">Inscrever-se {c.enrolled_count ? `· ${c.enrolled_count}` : ''}</button>
        )}
      </div>
    </div>
  )
}

const CATS = ['Branding', 'Arquitetura', 'Visual Merchandising', 'Hospitalidade & Gastronomia', 'Negócio & Gestão', 'Tecnologia & Inovação', 'Design', 'Marketing']

function CreateCourse({ tenantId, onClose, onCreated, notify }) {
  const [f, setF] = useState({ title: '', subtitle: '', description: '', category: '', level: 'iniciante', duration: '', lessons_count: '', instructor: '', is_free: true, price: '', cover_url: '' })
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const [uploading, setUploading] = useState(false)
  const coverRef = useRef(null)
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'
  const upCover = async (file) => {
    setUploading(true)
    const r = await uploadTo(file, { folder: 'network/academy', accept: 'image', maxMB: 10 })
    setUploading(false)
    if (r.error) return notify?.(r.error, 'error')
    set('cover_url', r.url)
  }
  const save = async () => {
    if (!f.title.trim()) return notify?.('Informe o título', 'error')
    const { data, error } = await supabase.from('network_academy_courses').insert({
      tenant_id: tenantId, title: f.title, subtitle: f.subtitle || null, description: f.description || null,
      category: f.category || null, level: f.level, duration: f.duration || null,
      lessons_count: f.lessons_count ? parseInt(f.lessons_count) : 0, instructor: f.instructor || null,
      is_free: f.is_free, price: f.is_free ? null : (f.price ? Number(f.price) : null), cover_url: f.cover_url || null, status: 'published',
    }).select('*').single()
    if (error) return notify?.('Erro: ' + error.message, 'error')
    onCreated(data)
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-lg max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Publicar curso</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Capa do curso</label>
            <input ref={coverRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upCover(e.target.files[0])} className="hidden" />
            <button type="button" onClick={() => coverRef.current?.click()} disabled={uploading} className="w-full h-24 rounded-xl overflow-hidden glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors disabled:opacity-50">
              {f.cover_url ? <img src={f.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="flex items-center gap-2 text-sm"><Icon name={uploading ? 'clock' : 'image'} className="w-5 h-5" />{uploading ? 'Enviando…' : 'Enviar capa'}</span>}
            </button>
          </div>
          <div><label className={lbl}>Título *</label><input value={f.title} onChange={(e) => set('title', e.target.value)} className={cls} /></div>
          <div><label className={lbl}>Subtítulo</label><input value={f.subtitle} onChange={(e) => set('subtitle', e.target.value)} className={cls} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Área</label><GlassSelect value={f.category} onChange={(v) => set('category', v)} options={[{ value: '', label: '—' }, ...CATS.map((c) => ({ value: c, label: c }))]} /></div>
            <div><label className={lbl}>Nível</label><GlassSelect value={f.level} onChange={(v) => set('level', v)} options={Object.entries(LEVELS).map(([value, label]) => ({ value, label }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Duração</label><input value={f.duration} onChange={(e) => set('duration', e.target.value)} placeholder="Ex.: 2h40" className={cls} /></div>
            <div><label className={lbl}>Nº de aulas</label><input type="number" value={f.lessons_count} onChange={(e) => set('lessons_count', e.target.value)} className={cls} /></div>
          </div>
          <div><label className={lbl}>Instrutor</label><input value={f.instructor} onChange={(e) => set('instructor', e.target.value)} className={cls} /></div>
          <div><label className={lbl}>Descrição</label><textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} className={`${cls} resize-none`} /></div>
          <label className="flex items-center gap-2 text-sm text-admin-text/80"><input type="checkbox" checked={f.is_free} onChange={(e) => set('is_free', e.target.checked)} className="w-4 h-4 accent-admin-champ" />Curso gratuito</label>
          {!f.is_free && <div><label className={lbl}>Valor (R$)</label><input type="number" value={f.price} onChange={(e) => set('price', e.target.value)} className={cls} /></div>}
        </div>
        <div className="flex justify-end gap-2 mt-5"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button><button onClick={save} className="px-4 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ">Publicar</button></div>
      </div>
    </div>
  )
}
