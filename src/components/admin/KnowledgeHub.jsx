import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

const TYPE_LABELS = { article:'Artigo', pop:'POP', procedure:'Procedimento', policy:'Política', faq:'FAQ', manual:'Manual' }
const TYPE_COLORS = { article:'text-admin-champ', pop:'text-admin-sage', procedure:'text-admin-gold', policy:'text-admin-rose', faq:'text-admin-muted', manual:'text-admin-champ/60' }
const STATUS_COLORS = { draft:'text-admin-muted/40', review:'text-admin-gold', published:'text-admin-sage', archived:'text-admin-muted/20' }

export function KnowledgeHub({ notify }) {
  const { profile } = useTenant()
  const [articles, setArticles] = useState([])
  const [courses, setCourses] = useState([])
  const [tab, setTab] = useState('articles')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showCourseForm, setShowCourseForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', excerpt: '', type: 'article', category: '', status: 'draft', requires_confirmation: false })
  const [courseForm, setCourseForm] = useState({ title: '', description: '', category: '', level: 'beginner', is_mandatory: false })

  const loadArticles = async () => {
    setLoading(true)
    let q = supabase.from('articles').select('*').order('updated_at', { ascending: false }).limit(100)
    if (search) q = q.ilike('title', `%${search}%`)
    if (filterType) q = q.eq('type', filterType)
    const { data } = await q
    setArticles(data || [])
    setLoading(false)
  }

  const loadCourses = async () => {
    setLoading(true)
    const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false }).limit(50)
    setCourses(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (tab === 'articles') loadArticles()
    else loadCourses()
  }, [tab, search, filterType])

  const saveArticle = async () => {
    if (!form.title.trim()) { notify('Título obrigatório', 'error'); return }
    const slug = form.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 80) + '-' + Date.now()
    const { error } = await supabase.from('articles').insert({ ...form, slug, tenant_id: profile?.tenant_id, author_id: profile?.user_id })
    if (error) { notify('Erro ao salvar', 'error'); return }
    notify('Artigo criado', 'success')
    setShowForm(false)
    setForm({ title: '', content: '', excerpt: '', type: 'article', category: '', status: 'draft', requires_confirmation: false })
    loadArticles()
  }

  const publishArticle = async (id) => {
    await supabase.from('articles').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', id)
    notify('Publicado', 'success'); loadArticles(); if (selected?.id === id) setSelected(a => ({ ...a, status: 'published' }))
  }

  const saveCourse = async () => {
    if (!courseForm.title.trim()) { notify('Título obrigatório', 'error'); return }
    const { error } = await supabase.from('courses').insert({ ...courseForm, tenant_id: profile?.tenant_id, author_id: profile?.user_id })
    if (error) { notify('Erro ao salvar', 'error'); return }
    notify('Curso criado', 'success')
    setShowCourseForm(false)
    setCourseForm({ title: '', description: '', category: '', level: 'beginner', is_mandatory: false })
    loadCourses()
  }

  const removeArticle = async (id) => {
    if (!confirm('Remover artigo?')) return
    await supabase.from('articles').delete().eq('id', id)
    notify('Removido', 'success'); setSelected(null); loadArticles()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">Knowledge Hub</h1>
          <p className="text-admin-muted/60 text-sm mt-1">Artigos, POPs, manuais e treinamentos</p>
        </div>
        <div className="flex gap-2">
          {tab === 'articles' && <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Novo artigo</button>}
          {tab === 'courses' && <button onClick={() => setShowCourseForm(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="book" className="w-4 h-4" />Novo curso</button>}
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['articles','Artigos & POPs'],['courses','Cursos & Trilhas']].map(([k,v]) => (
          <button key={k} onClick={() => { setTab(k); setSelected(null) }}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>
            {v}
          </button>
        ))}
      </div>

      {tab === 'articles' && (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/30" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…"
                  className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" />
              </div>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="glass-input rounded-xl px-3 py-2.5 text-sm text-admin-text outline-none">
                <option value="">Todos</option>
                {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {loading
              ? <p className="text-admin-muted/30 text-sm py-6 text-center">Carregando…</p>
              : articles.length === 0
                ? <div className="glass rounded-2xl p-10 text-center"><Icon name="book" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum artigo</p></div>
                : articles.map(a => (
                  <button key={a.id} onClick={() => setSelected(a)}
                    className={`w-full text-left glass rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.04] ${selected?.id === a.id ? 'border-admin-champ/20' : ''}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-medium ${TYPE_COLORS[a.type]}`}>{TYPE_LABELS[a.type]}</span>
                      <span className={`text-[10px] ${STATUS_COLORS[a.status]}`}>{a.status}</span>
                    </div>
                    <p className="text-admin-text text-sm truncate">{a.title}</p>
                    {a.category && <p className="text-admin-muted/40 text-xs mt-0.5">{a.category}</p>}
                  </button>
                ))
            }
          </div>

          <div className="lg:col-span-3">
            {selected ? (
              <div className="glass rounded-2xl p-6 sticky top-24">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-medium ${TYPE_COLORS[selected.type]}`}>{TYPE_LABELS[selected.type]}</span>
                      <span className={`text-[10px] ${STATUS_COLORS[selected.status]}`}>{selected.status}</span>
                    </div>
                    <h2 className="font-serif text-2xl text-admin-text">{selected.title}</h2>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {selected.status !== 'published' && (
                      <button onClick={() => publishArticle(selected.id)} className="text-[10px] px-3 py-1.5 rounded-lg bg-admin-sage/10 text-admin-sage hover:bg-admin-sage/20 transition-colors">Publicar</button>
                    )}
                    <button onClick={() => removeArticle(selected.id)} className="text-[10px] px-3 py-1.5 rounded-lg text-admin-muted/40 hover:text-admin-rose hover:bg-white/[0.03] transition-colors">Remover</button>
                  </div>
                </div>
                {selected.excerpt && <p className="text-admin-muted/60 text-sm mb-4 italic">{selected.excerpt}</p>}
                {selected.content && (
                  <div className="text-admin-muted/70 text-sm leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto pr-2">
                    {selected.content}
                  </div>
                )}
                {selected.requires_confirmation && (
                  <p className="text-[10px] text-admin-gold mt-4">· Requer confirmação de leitura</p>
                )}
              </div>
            ) : (
              <div className="glass rounded-2xl p-12 text-center">
                <Icon name="book" className="w-12 h-12 text-admin-champ/15 mx-auto mb-3" />
                <p className="text-admin-muted/30 text-sm">Selecione um artigo para visualizar</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'courses' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? <p className="text-admin-muted/30 text-sm py-8 text-center col-span-3">Carregando…</p>
            : courses.length === 0
              ? <div className="glass rounded-2xl p-12 text-center col-span-3"><Icon name="book" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum curso</p></div>
              : courses.map(c => (
                <div key={c.id} className="glass rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-admin-text text-sm font-medium mb-1">{c.title}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-admin-champ/60 capitalize">{c.level}</span>
                        {c.is_mandatory && <span className="text-[10px] text-admin-rose">Obrigatório</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                  </div>
                  {c.description && <p className="text-admin-muted/50 text-xs line-clamp-2">{c.description}</p>}
                  {c.category && <p className="text-[10px] text-admin-muted/30 mt-2">{c.category}</p>}
                </div>
              ))
          }
        </div>
      )}

      {/* Modal artigo */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-admin-text">Novo artigo</h2>
              <button onClick={() => setShowForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Tipo</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none">
                    {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Categoria</label>
                  <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Ex: Atendimento" />
                </div>
              </div>
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Resumo</label>
                <input value={form.excerpt} onChange={e => setForm(f => ({ ...f, excerpt: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Breve descrição…" />
              </div>
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Conteúdo</label>
                <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={6} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" placeholder="Escreva o conteúdo completo…" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.requires_confirmation} onChange={e => setForm(f => ({ ...f, requires_confirmation: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-sm text-admin-muted">Exigir confirmação de leitura</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveArticle} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Salvar rascunho</button>
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal curso */}
      {showCourseForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-admin-text">Novo curso</h2>
              <button onClick={() => setShowCourseForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label>
                <input value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nível</label>
                  <select value={courseForm.level} onChange={e => setCourseForm(f => ({ ...f, level: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none">
                    <option value="beginner">Iniciante</option>
                    <option value="intermediate">Intermediário</option>
                    <option value="advanced">Avançado</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Categoria</label>
                  <input value={courseForm.category} onChange={e => setCourseForm(f => ({ ...f, category: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Descrição</label>
                <textarea value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={courseForm.is_mandatory} onChange={e => setCourseForm(f => ({ ...f, is_mandatory: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-sm text-admin-muted">Curso obrigatório</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveCourse} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar curso</button>
              <button onClick={() => setShowCourseForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
