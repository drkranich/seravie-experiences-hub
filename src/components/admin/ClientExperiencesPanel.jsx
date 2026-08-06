import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'

const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Cada experiência mapeia para uma tabela + um formulário de item.
const EXPERIENCES = [
  {
    key: 'agenda', icon: 'calendar', title: 'Agendamento online',
    desc: 'Cliente escolhe serviço, dia e horário (spa, beauty, consultorias).',
    table: 'spa_services', activeField: 'is_active', order: 'name',
    itemLabel: (r) => r.name, itemMeta: (r) => [r.category, r.duration_min ? `${r.duration_min} min` : null, brl(r.price)].filter(Boolean).join(' · '),
    empty: () => ({ name: '', category: '', duration_min: 30, price: 0, description: '', is_active: true }),
    fields: [
      { key: 'name', label: 'Nome do serviço', required: true, full: true },
      { key: 'category', label: 'Categoria' },
      { key: 'duration_min', label: 'Duração (min)', type: 'number' },
      { key: 'price', label: 'Preço', type: 'currency' },
      { key: 'description', label: 'Descrição', type: 'textarea', full: true },
      { key: 'is_active', label: 'Ativo (aparece no link)', type: 'bool', full: true },
    ],
  },
  {
    key: 'reserva', icon: 'map', title: 'Reserva de experiência',
    desc: 'Cliente reserva passeio/roteiro com data e nº de pessoas (turismo, eventos).',
    table: 'tours', activeField: 'status', activeOn: 'active', activeOff: 'inactive', order: 'name',
    itemLabel: (r) => r.name, itemMeta: (r) => [r.type, r.duration, r.capacity ? `até ${r.capacity}p` : null, brl(r.price)].filter(Boolean).join(' · '),
    empty: () => ({ name: '', type: '', duration: '', price: 0, capacity: 10, description: '', status: 'active' }),
    fields: [
      { key: 'name', label: 'Nome do passeio/experiência', required: true, full: true },
      { key: 'type', label: 'Tipo' },
      { key: 'duration', label: 'Duração (ex: 2h, meio dia)' },
      { key: 'price', label: 'Preço por pessoa', type: 'currency' },
      { key: 'capacity', label: 'Capacidade', type: 'number' },
      { key: 'description', label: 'Descrição', type: 'textarea', full: true },
      { key: 'status', label: 'Ativo (aparece no link)', type: 'boolstatus', full: true },
    ],
  },
  {
    key: 'clube', icon: 'star', title: 'Clube / Assinatura',
    desc: 'Cliente adere a um plano recorrente (vinhos, café, floricultura).',
    table: 'club_plans', activeField: 'active', order: 'price',
    itemLabel: (r) => r.name, itemMeta: (r) => [r.cadence, r.items_per_cycle ? `${r.items_per_cycle} item(ns)/ciclo` : null, `${brl(r.price)}/mês`].filter(Boolean).join(' · '),
    empty: () => ({ name: '', cadence: 'mensal', items_per_cycle: 1, price: 0, description: '', active: true }),
    fields: [
      { key: 'name', label: 'Nome do plano', required: true, full: true },
      { key: 'cadence', label: 'Frequência (ex: mensal)' },
      { key: 'items_per_cycle', label: 'Itens por ciclo', type: 'number' },
      { key: 'price', label: 'Preço mensal', type: 'currency' },
      { key: 'description', label: 'Descrição', type: 'textarea', full: true },
      { key: 'active', label: 'Ativo (aparece no link)', type: 'bool', full: true },
    ],
  },
]

function QRThumb({ url, size = 128 }) {
  const [img, setImg] = useState('')
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#14160f', light: '#f4f0e6' } }).then(setImg).catch(() => {}) }, [url])
  if (!img) return <div className="rounded-xl bg-white/[0.05]" style={{ width: size, height: size }} />
  return <img src={img} alt="QR" width={size} height={size} className="rounded-xl bg-[#f4f0e6] p-1" />
}

const isActive = (exp, row) => exp.activeOn ? row[exp.activeField] === exp.activeOn : row[exp.activeField] !== false

export function ClientExperiencesPanel({ notify }) {
  const { profile, canEdit, canManage } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('client_exp') : true
  const mayDelete = canManage ? canManage('client_exp') : true
  const [slug, setSlug] = useState(null)
  const [qrOpen, setQrOpen] = useState(null)
  const [items, setItems] = useState({})          // { agenda: [...], reserva: [...], clube: [...] }
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)        // { exp, form, editingId }

  const loadAll = async () => {
    if (!tenantId) return
    setLoading(true)
    const out = {}
    for (const e of EXPERIENCES) {
      const { data } = await supabase.from(e.table).select('*').eq('tenant_id', tenantId).order(e.order)
      out[e.key] = data || []
    }
    setItems(out); setLoading(false)
  }

  useEffect(() => {
    (async () => {
      if (!tenantId) return
      const { data } = await supabase.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
      setSlug(data?.slug || null)
    })()
    loadAll()
  }, [tenantId])

  const linkFor = (key) => `${window.location.origin}/#${key}/${slug || ''}`
  const copy = (key) => { navigator.clipboard?.writeText(linkFor(key)); notify('Link copiado', 'success') }

  const openNew = (exp) => setModal({ exp, form: exp.empty(), editingId: null })
  const openEdit = (exp, row) => setModal({ exp, form: { ...row }, editingId: row.id })
  const setF = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v } }))

  const save = async () => {
    const { exp, form, editingId } = modal
    if (!form.name?.trim()) return notify('Informe o nome', 'error')
    const payload = {}
    exp.fields.forEach((f) => {
      let v = form[f.key]
      if (f.type === 'number' || f.type === 'currency') v = Number(v) || 0
      if (f.type === 'boolstatus') v = form[f.key] // já é string status
      payload[f.key] = v
    })
    let error
    if (editingId) { const r = await supabase.from(exp.table).update(payload).eq('id', editingId); error = r.error }
    else { const r = await supabase.from(exp.table).insert({ ...payload, tenant_id: tenantId }); error = r.error }
    if (error) return notify('Erro ao salvar: ' + error.message, 'error')
    notify(editingId ? 'Atualizado' : 'Criado', 'success'); setModal(null); loadAll()
  }

  const toggleActive = async (exp, row) => {
    const on = isActive(exp, row)
    const patch = exp.activeOn ? { [exp.activeField]: on ? exp.activeOff : exp.activeOn } : { [exp.activeField]: !on }
    await supabase.from(exp.table).update(patch).eq('id', row.id); loadAll()
  }
  const remove = async (exp, row) => {
    if (!confirm(`Excluir "${exp.itemLabel(row)}"?`)) return
    const { error } = await supabase.from(exp.table).delete().eq('id', row.id)
    if (error) return notify('Erro ao excluir', 'error')
    notify('Excluído', 'success'); loadAll()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl text-admin-text">Experiências do Cliente</h1>
        <p className="text-admin-muted/50 text-sm mt-1">Cadastre os itens e divulgue os links públicos — seus clientes agendam, reservam e assinam sozinhos.</p>
      </div>

      {!slug ? (
        <p className="text-admin-muted/40 text-sm">Defina o identificador (slug) da sua conta em Configurações para gerar os links.</p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          {EXPERIENCES.map((e) => {
            const list = items[e.key] || []
            return (
              <div key={e.key} className="glass rounded-2xl p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-2"><Icon name={e.icon} className="w-5 h-5 text-admin-champ" /><h3 className="text-admin-text font-medium flex-1">{e.title}</h3>
                  {mayEdit && <button onClick={() => openNew(e)} className="text-[11px] px-2.5 py-1 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">+ Novo</button>}
                </div>
                <p className="text-admin-muted/50 text-xs leading-relaxed">{e.desc}</p>

                {/* Itens cadastrados */}
                <div className="mt-3 space-y-1.5">
                  {loading ? <p className="text-admin-muted/30 text-xs py-2">Carregando…</p> : list.length === 0 ? (
                    <p className="text-admin-muted/30 text-xs py-2 italic">Nenhum item ainda. Clique em “+ Novo”.</p>
                  ) : list.map((row) => {
                    const on = isActive(e, row)
                    return (
                      <div key={row.id} className="group bg-white/[0.03] rounded-lg px-3 py-2 flex items-center gap-2">
                        <button onClick={() => toggleActive(e, row)} title={on ? 'Ativo' : 'Inativo'} className={`w-1.5 h-1.5 rounded-full shrink-0 ${on ? 'bg-admin-sage' : 'bg-admin-muted/30'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-admin-text text-xs truncate">{e.itemLabel(row)}</p>
                          <p className="text-admin-muted/40 text-[10px] truncate">{e.itemMeta(row)}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {mayEdit && <button onClick={() => openEdit(e, row)} className="p-1 text-admin-muted hover:text-admin-champ"><Icon name="pen" className="w-3.5 h-3.5" /></button>}
                          {mayDelete && <button onClick={() => remove(e, row)} className="p-1 text-admin-muted hover:text-admin-rose"><Icon name="x" className="w-3.5 h-3.5" /></button>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-3 bg-white/[0.03] rounded-lg px-3 py-2 text-[11px] text-admin-champ/80 break-all">{linkFor(e.key)}</div>
                <div className="mt-auto flex gap-2 pt-3">
                  <button onClick={() => copy(e.key)} className="flex-1 text-xs py-2 rounded-lg bg-admin-champ/15 text-admin-champ hover:bg-admin-champ/25">Copiar link</button>
                  <button onClick={() => setQrOpen(e)} className="text-xs px-3 py-2 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">QR</button>
                  <a href={linkFor(e.key)} target="_blank" rel="noreferrer" className="text-xs px-3 py-2 rounded-lg bg-white/[0.05] text-admin-muted/70 hover:text-admin-champ">Abrir</a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal criar/editar item */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)}>
          <div className="glass-pop rounded-2xl p-7 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{modal.editingId ? 'Editar' : 'Novo'} · {modal.exp.title}</h2><button onClick={() => setModal(null)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              {modal.exp.fields.map((f) => {
                const cls = f.full ? 'col-span-2' : ''
                if (f.type === 'textarea') return <div key={f.key} className={cls}><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{f.label}</label><textarea value={modal.form[f.key] || ''} onChange={(e) => setF(f.key, e.target.value)} rows={2} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
                if (f.type === 'bool') return <label key={f.key} className={`${cls} flex items-center gap-2 text-sm text-admin-muted/70`}><input type="checkbox" checked={modal.form[f.key] !== false} onChange={(e) => setF(f.key, e.target.checked)} className="accent-admin-champ" />{f.label}</label>
                if (f.type === 'boolstatus') return <label key={f.key} className={`${cls} flex items-center gap-2 text-sm text-admin-muted/70`}><input type="checkbox" checked={modal.form[f.key] !== 'inactive'} onChange={(e) => setF(f.key, e.target.checked ? 'active' : 'inactive')} className="accent-admin-champ" />{f.label}</label>
                return <div key={f.key} className={cls}><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">{f.label}{f.required ? ' *' : ''}</label><input type={f.type === 'number' || f.type === 'currency' ? 'number' : 'text'} value={modal.form[f.key] ?? ''} onChange={(e) => setF(f.key, e.target.value)} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
              })}
            </div>
            <div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm">{modal.editingId ? 'Salvar' : 'Criar'}</button><button onClick={() => setModal(null)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
          </div>
        </div>
      )}

      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setQrOpen(null)}>
          <div className="glass-pop rounded-2xl p-7 text-center" onClick={(ev) => ev.stopPropagation()}>
            <QRThumb url={linkFor(qrOpen.key)} size={240} />
            <p className="text-admin-text font-medium mt-4">{qrOpen.title}</p>
            <p className="text-admin-muted/40 text-xs break-all mt-1 max-w-xs">{linkFor(qrOpen.key)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
