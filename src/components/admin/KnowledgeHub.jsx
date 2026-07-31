import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon } from './ui'

export function KnowledgeHub({ notify }) {
  const { profile } = useTenant()
  const [tab, setTab] = useState('articles')
  const [articles, setArticles] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', category: '', status: 'draft' })
  const [courseForm, setCourseForm] = useState({ title: '', description: '', category: '', status: 'draft' })

  const loadArticles = async () => { setLoading(true); const { data } = await supabase.from('articles').select('*').order('created_at', { ascending: false }); setArticles(data || []); setLoading(false) }
  const loadCourses = async () => { setLoading(true); const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false }); setCourses(data || []); setLoading(false) }

  useEffect(() => { tab === 'articles' ? loadArticles() : loadCourses() }, [tab])

  const saveArticle = async () => {
    if (!form.title.trim()) { notify('Título obrigatório', 'error'); return }
    const { error } = await supabase.from('articles').insert({ ...form, tenant_id: profile?.tenant_id, author_id: profile?.user_id })
    if (error) { notify('Erro', 'error'); return }
    notify('Artigo criado', 'success'); setShowForm(false); setForm({ title: '', content: '', category: '', status: 'draft' }); loadArticles()
  }

  const saveCourse = async () => {
    if (!courseForm.title.trim()) { notify('Título obrigatório', 'error'); return }
    const { error } = await supabase.from('courses').insert({ ...courseForm, tenant_id: profile?.tenant_id, created_by: profile?.user_id })
    if (error) { notify('Erro', 'error'); return }
    notify('Curso criado', 'success'); setShowForm(false); setCourseForm({ title: '', description: '', category: '', status: 'draft' }); loadCourses()
  }

  const STATUS_BADGES = { draft: 'text-admin-muted/40', published: 'text-admin-sage', archived: 'text-admin-muted/20' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Knowledge Hub</h1><p className="text-admin-muted/60 text-sm mt-1">Artigos, POPs e treinamentos</p></div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Novo</button>
      </div>
      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['articles','Artigos & POPs'],['courses','Cursos']].map(([k,v]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{v}</button>
        ))}
      </div>
      <div className="space-y-2">
        {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
          : (tab === 'articles' ? articles : courses).length === 0
            ? <div className="glass rounded-2xl p-10 text-center"><Icon name="book" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum item</p></div>
            : (tab === 'articles' ? articles : courses).map(item => (
              <div key={item.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                <Icon name="book" className="w-4 h-4 text-admin-champ/40 shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{item.title}</p><p className="text-admin-muted/40 text-xs">{item.category || '—'}</p></div>
                <span className={`text-[10px] ${STATUS_BADGES[item.status]}`}>{item.status}</span>
                <p className="text-admin-muted/30 text-[10px]">{new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            ))
        }
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{tab === 'articles' ? 'Novo artigo' : 'Novo curso'}</h2><button onClick={() => setShowForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            {tab === 'articles' ? (
              <div className="space-y-4">
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Categoria</label><input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Conteúdo</label><textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
                <div className="flex gap-3"><button onClick={saveArticle} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar</button><button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label><input value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Categoria</label><input value={courseForm.category} onChange={e => setCourseForm(f => ({ ...f, category: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Descrição</label><textarea value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
                <div className="flex gap-3"><button onClick={saveCourse} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar curso</button><button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
