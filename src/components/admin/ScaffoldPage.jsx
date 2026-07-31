import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'

// Toda subpágina vira uma PÁGINA COMPLETA com múltiplas abas (não um bloco de notas):
// Painel (visão geral + guia), Lista (registros ricos), Quadro (kanban) e Sobre.
export function ScaffoldPage({ item, parentLabel, onNavigate }) {
  const pages = item.pages || []
  if (pages.length > 0) return <ModuleGrid item={item} parentLabel={parentLabel} onNavigate={onNavigate} />
  return <RichArea item={item} parentLabel={parentLabel} />
}

function Breadcrumb({ parentLabel, label }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-admin-muted/50 mb-3">
      {parentLabel && (<><span>{parentLabel}</span><span className="opacity-30">/</span></>)}
      <span className="text-admin-champ/70">{label}</span>
    </div>
  )
}

// Módulo com subpáginas → cards de navegação (com descrição e ícone)
function ModuleGrid({ item, parentLabel, onNavigate }) {
  return (
    <div className="w-full">
      <Breadcrumb parentLabel={parentLabel} label={item.label} />
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl glass-pop flex items-center justify-center shrink-0"><Icon name={item.icon || 'spark'} className="w-5 h-5 text-admin-champ/80" /></div>
        <div><h1 className="font-serif text-4xl text-admin-text leading-tight">{item.label}</h1><p className="text-admin-muted/60 text-sm mt-1">{item.pages.length} áreas neste módulo</p></div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {item.pages.map((p) => (
          <button key={p.key} onClick={() => onNavigate?.(p.route || p.key)} className="glass rounded-2xl p-5 text-left border border-transparent hover:border-admin-champ/25 lift transition-all">
            <div className="flex items-center justify-between mb-2"><p className="text-admin-text text-sm font-medium">{p.label}</p><Icon name="external" className="w-3.5 h-3.5 text-admin-champ/40" /></div>
            <p className="text-admin-muted/40 text-xs">{guideFor(p).about}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---- Guia por assunto: descreve o que cada área deve conter (heurística por palavra-chave) ----
const GUIDE_RULES = [
  { m: /campanh|marketing|an[uú]ncio|social|email|whatsapp|sms/i, about: 'Planeje e acompanhe campanhas e disparos.', cats: ['E-mail', 'WhatsApp', 'SMS', 'Redes sociais', 'Loja'], tips: ['Defina público-alvo e oferta', 'Agende data de disparo', 'Acompanhe aberturas e cliques'] },
  { m: /auditor|complian|conformidad|checklist|vistor/i, about: 'Registre auditorias, itens e não conformidades.', cats: ['Loja', 'Processo', 'Segurança', 'Qualidade'], tips: ['Use uma linha por item verificado', 'Marque não conformidades como alta prioridade', 'Anexe plano de ação'] },
  { m: /document|contrat|pol[ií]tic|procedim|pop/i, about: 'Organize documentos, contratos e procedimentos.', cats: ['Contrato', 'POP', 'Política', 'Manual'], tips: ['Versione por data', 'Defina responsável pela revisão', 'Registre validade/renovação'] },
  { m: /relat[oó]ri|indicador|dashboard|m[eé]trica|analytic|convers/i, about: 'Acompanhe indicadores e relatórios da área.', cats: ['Vendas', 'Atendimento', 'Operação', 'Marketing'], tips: ['Defina a meta do período', 'Compare com o mês anterior', 'Exporte para apresentar'] },
  { m: /trein|curso|certific|onboarding|academ/i, about: 'Gerencie treinamentos e capacitação da equipe.', cats: ['Trilha', 'Aula', 'Avaliação', 'Certificação'], tips: ['Marque treinamentos obrigatórios', 'Acompanhe conclusão por pessoa', 'Emita certificado ao concluir'] },
  { m: /canal|integr|webhook|api|conex/i, about: 'Configure e monitore canais e integrações.', cats: ['Marketplace', 'Pagamento', 'Frete', 'Mensageria'], tips: ['Guarde credenciais com segurança', 'Teste a conexão', 'Monitore status de sincronização'] },
  { m: /fornec|compra|estoque|invent|equipa/i, about: 'Controle fornecedores, compras e ativos.', cats: ['Fornecedor', 'Pedido de compra', 'Equipamento', 'Insumo'], tips: ['Cadastre contato e prazo', 'Defina ponto de reposição', 'Registre manutenções'] },
  { m: /tarefa|fluxo|processo|aprova|opera/i, about: 'Coordene tarefas, fluxos e aprovações.', cats: ['Tarefa', 'Aprovação', 'Fluxo', 'Incidente'], tips: ['Defina responsável e prazo', 'Use o Quadro para o andamento', 'Feche ao concluir'] },
  { m: /agenda|escala|calend|hor[aá]ri/i, about: 'Organize agenda, escalas e compromissos.', cats: ['Compromisso', 'Escala', 'Reunião'], tips: ['Defina data e responsável', 'Confirme presença', 'Acompanhe pendências'] },
  { m: /meta|objetivo|comiss/i, about: 'Defina metas e acompanhe o atingimento.', cats: ['Vendas', 'Receita', 'Equipe'], tips: ['Estabeleça alvo e prazo', 'Atualize o realizado', 'Comemore ao atingir'] },
]
function guideFor(item) {
  const label = item?.label || 'esta área'
  const rule = GUIDE_RULES.find((r) => r.m.test(label))
  return {
    about: rule?.about || `Registre e acompanhe tudo de ${label} num só lugar.`,
    cats: rule?.cats || ['Geral', 'Prioritário', 'Follow-up'],
    tips: rule?.tips || ['Crie um registro por assunto', 'Defina responsável e prazo', 'Use o Quadro para acompanhar o andamento'],
  }
}

const STATUS = { open: 'A fazer', doing: 'Em andamento', done: 'Concluído' }
const STATUS_STYLE = { open: 'bg-white/[0.05] text-admin-muted/60', doing: 'bg-admin-gold/10 text-admin-gold', done: 'bg-admin-sage/10 text-admin-sage' }
const PRIORITY = { low: 'Baixa', medium: 'Média', high: 'Alta' }
const PRIORITY_STYLE = { low: 'text-admin-muted/50', medium: 'text-admin-champ', high: 'text-admin-rose' }
const todayStr = () => new Date().toISOString().slice(0, 10)

function RichArea({ item, parentLabel }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const guide = useMemo(() => guideFor(item), [item.key])
  const [tab, setTab] = useState('panel')
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [search, setSearch] = useState('')
  const [fStatus, setFStatus] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('module_records').select('*').eq('page_key', item.key).order('created_at', { ascending: false })
    setRecords(data || []); setLoading(false)
  }
  useEffect(() => { load(); setTab('panel') }, [item.key])

  const d = (r) => r.data || {}
  const openNew = (preset = {}) => { setEditing(null); setForm({ title: '', notes: '', category: '', priority: 'medium', owner: '', due_date: '', status: 'open', ...preset }); setModal(true) }
  const openEdit = (r) => { setEditing(r.id); setForm({ title: r.title, notes: r.notes || '', status: r.status || 'open', category: d(r).category || '', priority: d(r).priority || 'medium', owner: d(r).owner || '', due_date: d(r).due_date || '' }); setModal(true) }

  const save = async () => {
    if (!form.title.trim()) return
    const data = { category: form.category || null, priority: form.priority || 'medium', owner: form.owner || null, due_date: form.due_date || null }
    if (editing) await supabase.from('module_records').update({ title: form.title, notes: form.notes, status: form.status, data, updated_at: new Date().toISOString() }).eq('id', editing)
    else await supabase.from('module_records').insert({ tenant_id: tenantId, page_key: item.key, title: form.title, notes: form.notes, status: form.status || 'open', data, created_by: profile?.user_id })
    setModal(false); setEditing(null); load()
  }
  const setStatus = async (r, status) => { await supabase.from('module_records').update({ status, updated_at: new Date().toISOString() }).eq('id', r.id); load() }
  const del = async (id) => { await supabase.from('module_records').delete().eq('id', id); load() }

  const counts = { total: records.length, open: records.filter((r) => (r.status || 'open') === 'open').length, doing: records.filter((r) => r.status === 'doing').length, done: records.filter((r) => r.status === 'done').length }
  const donePct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0
  const overdue = records.filter((r) => r.status !== 'done' && d(r).due_date && d(r).due_date < todayStr())

  const filtered = records.filter((r) =>
    (!fStatus || (r.status || 'open') === fStatus) &&
    (!search || r.title.toLowerCase().includes(search.toLowerCase()) || (d(r).owner || '').toLowerCase().includes(search.toLowerCase()))
  )

  const TABS = [['panel', 'Painel'], ['list', 'Lista'], ['board', 'Quadro'], ['about', 'Sobre esta área']]

  const RecordCard = ({ r }) => {
    const dd = d(r)
    const isOverdue = r.status !== 'done' && dd.due_date && dd.due_date < todayStr()
    return (
      <div className="glass rounded-xl px-4 py-3 group">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm ${r.status === 'done' ? 'text-admin-muted/40 line-through' : 'text-admin-text'}`}>{r.title}</p>
              <span className={`text-[9px] px-2 py-0.5 rounded-lg ${STATUS_STYLE[r.status || 'open']}`}>{STATUS[r.status || 'open']}</span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {dd.category && <span className="text-admin-muted/50 text-xs">{dd.category}</span>}
              {dd.priority && <span className={`text-xs ${PRIORITY_STYLE[dd.priority]}`}>● {PRIORITY[dd.priority]}</span>}
              {dd.owner && <span className="text-admin-muted/50 text-xs">👤 {dd.owner}</span>}
              {dd.due_date && <span className={`text-xs ${isOverdue ? 'text-admin-rose' : 'text-admin-muted/40'}`}>⏱ {new Date(dd.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}{isOverdue ? ' · vencido' : ''}</span>}
            </div>
            {r.notes && <p className="text-admin-muted/50 text-xs mt-1">{r.notes}</p>}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <GlassSelect value={r.status || 'open'} onChange={(v) => setStatus(r, v)} options={Object.entries(STATUS).map(([value, label]) => ({ value, label }))} className="w-32" />
            <button onClick={() => openEdit(r)} className="p-1.5 text-admin-muted hover:text-admin-champ rounded-lg hover:bg-white/[0.05]"><Icon name="pen" className="w-3.5 h-3.5" /></button>
            <button onClick={() => del(r.id)} className="p-1.5 text-admin-muted hover:text-admin-rose rounded-lg hover:bg-white/[0.05]"><Icon name="x" className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <Breadcrumb parentLabel={parentLabel} label={item.label} />
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl glass-pop flex items-center justify-center shrink-0"><Icon name={item.icon || 'spark'} className="w-5 h-5 text-admin-champ/80" /></div>
          <div><h1 className="font-serif text-4xl text-admin-text leading-tight">{item.label}</h1><p className="text-admin-muted/60 text-sm mt-1">{guide.about}</p></div>
        </div>
        <button onClick={() => openNew()} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors shrink-0"><Icon name="plus" className="w-4 h-4" />Novo registro</button>
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {TABS.map(([k, v]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{v}</button>
        ))}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p> : (
        <>
          {tab === 'panel' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Total</p><p className="text-admin-champ text-2xl font-medium">{counts.total}</p></div>
                <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">A fazer</p><p className="text-admin-text text-2xl font-medium">{counts.open}</p></div>
                <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Em andamento</p><p className="text-admin-gold text-2xl font-medium">{counts.doing}</p></div>
                <div className="glass rounded-2xl p-5"><p className="text-[10px] uppercase tracking-wider text-admin-muted/50 mb-1">Concluídos</p><p className="text-admin-sage text-2xl font-medium">{counts.done}</p></div>
              </div>

              <div className="grid lg:grid-cols-3 gap-5">
                <div className="glass rounded-2xl p-5 lg:col-span-2">
                  <div className="flex items-center justify-between mb-2"><p className="text-[11px] tracking-wider uppercase text-admin-champ/70">Progresso</p><span className="text-admin-muted/50 text-xs">{donePct}% concluído</span></div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mb-4"><div className="h-full rounded-full bg-admin-sage/70" style={{ width: `${donePct}%` }} /></div>
                  {overdue.length > 0 && <p className="text-admin-rose/80 text-xs mb-3">⚠ {overdue.length} item(ns) vencido(s)</p>}
                  <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Recentes</p>
                  {records.slice(0, 5).length === 0 ? <p className="text-admin-muted/40 text-sm">Nada registrado ainda.</p> : (
                    <div className="space-y-2">{records.slice(0, 5).map((r) => <RecordCard key={r.id} r={r} />)}</div>
                  )}
                </div>
                <div className="glass rounded-2xl p-5">
                  <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Começar rápido</p>
                  <p className="text-admin-muted/50 text-xs mb-3">Crie um registro já classificado:</p>
                  <div className="flex flex-wrap gap-2">
                    {guide.cats.map((c) => (
                      <button key={c} onClick={() => openNew({ category: c })} className="text-xs border border-admin-champ/20 text-admin-champ/80 px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">+ {c}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'list' && (
            <div>
              <div className="flex gap-3 mb-5 flex-wrap items-center">
                <div className="relative flex-1 min-w-48"><Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-admin-muted/40" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="w-full glass-input rounded-xl pl-9 pr-4 py-2.5 text-sm text-admin-text placeholder-admin-muted/30 outline-none" /></div>
                <div className="w-44"><GlassSelect value={fStatus} onChange={setFStatus} options={[{ value: '', label: 'Todos os status' }, ...Object.entries(STATUS).map(([value, label]) => ({ value, label }))]} /></div>
              </div>
              {filtered.length === 0 ? (
                <div className="glass rounded-3xl p-12 text-center max-w-2xl"><div className="w-12 h-12 rounded-2xl glass-pop flex items-center justify-center mx-auto mb-4"><Icon name={item.icon || 'spark'} className="w-5 h-5 text-admin-champ/70" /></div><p className="text-admin-text text-sm font-medium mb-1">Nada por aqui ainda</p><p className="text-admin-muted/50 text-sm max-w-md mx-auto mb-5">{guide.about}</p><button onClick={() => openNew()} className="inline-flex items-center gap-2 bg-admin-champ/12 hover:bg-admin-champ/20 text-admin-champ px-5 py-2.5 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Criar primeiro registro</button></div>
              ) : <div className="space-y-2">{filtered.map((r) => <RecordCard key={r.id} r={r} />)}</div>}
            </div>
          )}

          {tab === 'board' && (
            <div className="grid md:grid-cols-3 gap-4">
              {Object.entries(STATUS).map(([sk, sl]) => {
                const col = records.filter((r) => (r.status || 'open') === sk)
                return (
                  <div key={sk} className="glass rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3"><p className="text-sm text-admin-text font-medium">{sl}</p><span className="text-admin-muted/40 text-xs">{col.length}</span></div>
                    <div className="space-y-2 min-h-[40px]">
                      {col.map((r) => {
                        const dd = d(r)
                        return (
                          <div key={r.id} className="glass-soft rounded-xl px-3 py-2.5">
                            <p className="text-admin-text text-sm">{r.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">{dd.priority && <span className={`text-[10px] ${PRIORITY_STYLE[dd.priority]}`}>● {PRIORITY[dd.priority]}</span>}{dd.owner && <span className="text-admin-muted/40 text-[10px]">{dd.owner}</span>}</div>
                            <div className="flex gap-1 mt-2">
                              {sk !== 'open' && <button onClick={() => setStatus(r, sk === 'done' ? 'doing' : 'open')} className="text-[10px] text-admin-muted/60 hover:text-admin-champ">←</button>}
                              {sk !== 'done' && <button onClick={() => setStatus(r, sk === 'open' ? 'doing' : 'done')} className="text-[10px] text-admin-champ/70 hover:text-admin-champ ml-auto">avançar →</button>}
                            </div>
                          </div>
                        )
                      })}
                      {col.length === 0 && <p className="text-admin-muted/25 text-xs text-center py-3">—</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {tab === 'about' && (
            <div className="glass rounded-2xl p-6 max-w-2xl">
              <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Para que serve</p>
              <p className="text-admin-muted/70 text-sm mb-5">{guide.about} Esta área guarda seus registros por tenant, com status, prioridade, responsável e prazo — organize aqui tudo que pertence a “{item.label}”.</p>
              <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Boas práticas</p>
              <ul className="space-y-1.5 mb-5">{guide.tips.map((t, i) => <li key={i} className="flex items-start gap-2 text-admin-muted/70 text-sm"><Icon name="check" className="w-3.5 h-3.5 text-admin-sage mt-0.5 shrink-0" />{t}</li>)}</ul>
              <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Categorias sugeridas</p>
              <div className="flex flex-wrap gap-2">{guide.cats.map((c) => <span key={c} className="text-xs bg-white/[0.04] text-admin-muted/70 px-3 py-1 rounded-lg">{c}</span>)}</div>
            </div>
          )}
        </>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-pop rounded-2xl p-7 w-full max-w-lg overflow-visible max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{editing ? 'Editar registro' : `Novo em ${item.label}`}</h2><button onClick={() => setModal(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label><input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Categoria</label><input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} list="scaffold-cats" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /><datalist id="scaffold-cats">{guide.cats.map((c) => <option key={c} value={c} />)}</datalist></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Prioridade</label><GlassSelect value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v }))} options={Object.entries(PRIORITY).map(([value, label]) => ({ value, label }))} /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Responsável</label><input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Prazo</label><GlassDate value={form.due_date} onChange={(v) => setForm((f) => ({ ...f, due_date: v }))} /></div>
              <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Status</label><GlassSelect value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={Object.entries(STATUS).map(([value, label]) => ({ value, label }))} /></div>
              <div className="col-span-2"><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Anotações</label><textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">{editing ? 'Salvar' : 'Adicionar'}</button><button onClick={() => setModal(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
