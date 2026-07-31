import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'

export function FranchisePanel({ notify }) {
  const { profile } = useTenant()
  const [tab, setTab] = useState('network')
  const [units, setUnits] = useState([])
  const [communications, setCommunications] = useState([])
  const [vmCampaigns, setVmCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUnitForm, setShowUnitForm] = useState(false)
  const [showCommForm, setShowCommForm] = useState(false)
  const [unitForm, setUnitForm] = useState({ name: '', city: '', state: '', phone: '', email: '' })
  const [commForm, setCommForm] = useState({ title: '', content: '', type: 'announcement', priority: 'normal', requires_confirmation: false })

  const loadUnits = async () => {
    setLoading(true)
    const { data } = await supabase.from('units').select('*').order('name')
    setUnits(data || [])
    setLoading(false)
  }

  const loadCommunications = async () => {
    setLoading(true)
    const { data } = await supabase.from('network_communications').select('*').order('created_at', { ascending: false }).limit(50)
    setCommunications(data || [])
    setLoading(false)
  }

  const loadVMCampaigns = async () => {
    setLoading(true)
    const { data } = await supabase.from('vm_campaigns').select('*').order('created_at', { ascending: false }).limit(30)
    setVmCampaigns(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (tab === 'network') loadUnits()
    else if (tab === 'communications') loadCommunications()
    else if (tab === 'vm') loadVMCampaigns()
  }, [tab])

  const saveUnit = async () => {
    if (!unitForm.name.trim()) { notify('Nome obrigatório', 'error'); return }
    const { error } = await supabase.from('units').insert({ ...unitForm, tenant_id: profile?.tenant_id })
    if (error) { notify('Erro ao salvar', 'error'); return }
    notify('Unidade criada', 'success'); setShowUnitForm(false); setUnitForm({ name: '', city: '', state: '', phone: '', email: '' }); loadUnits()
  }

  const saveCommunication = async () => {
    if (!commForm.title.trim() || !commForm.content.trim()) { notify('Título e conteúdo obrigatórios', 'error'); return }
    const { error } = await supabase.from('network_communications').insert({
      ...commForm, tenant_id: profile?.tenant_id, created_by: profile?.user_id, published_at: new Date().toISOString()
    })
    if (error) { notify('Erro ao publicar', 'error'); return }
    notify('Comunicado publicado', 'success'); setShowCommForm(false); setCommForm({ title: '', content: '', type: 'announcement', priority: 'normal', requires_confirmation: false }); loadCommunications()
  }

  const COMM_TYPE_LABELS = { announcement:'Comunicado', alert:'Alerta', training:'Treinamento', campaign:'Campanha', policy:'Política', other:'Outro' }
  const PRIORITY_COLORS = { low:'text-admin-muted/40', normal:'text-admin-sage', high:'text-admin-gold', urgent:'text-admin-rose' }
  const VM_STATUS_COLORS = { draft:'text-admin-muted/40', published:'text-admin-champ', active:'text-admin-sage', closed:'text-admin-muted/30' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">Franchise Experience</h1>
          <p className="text-admin-muted/60 text-sm mt-1">{units.length} unidades na rede</p>
        </div>
        <div className="flex gap-2">
          {tab === 'network' && <button onClick={() => setShowUnitForm(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Nova unidade</button>}
          {tab === 'communications' && <button onClick={() => setShowCommForm(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Novo comunicado</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['network','Rede & Unidades'],['communications','Comunicados'],['vm','Visual Merchandising']].map(([k,v]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>
            {v}
          </button>
        ))}
      </div>

      {/* REDE */}
      {tab === 'network' && (
        <div>
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
            : units.length === 0
              ? <div className="glass rounded-2xl p-12 text-center"><Icon name="leaf" className="w-10 h-10 text-admin-champ/20 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhuma unidade cadastrada</p><button onClick={() => setShowUnitForm(true)} className="mt-4 text-admin-champ text-sm hover:underline">Adicionar primeira unidade</button></div>
              : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {units.map(u => (
                    <div key={u.id} className="glass rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-admin-text text-sm font-medium">{u.name}</p>
                        <span className={`text-[9px] px-2 py-0.5 rounded-lg ${u.status === 'active' ? 'bg-admin-sage/10 text-admin-sage' : 'bg-white/[0.04] text-admin-muted/40'}`}>{u.status || 'active'}</span>
                      </div>
                      {(u.city || u.state) && <p className="text-admin-muted/50 text-xs">{[u.city, u.state].filter(Boolean).join(', ')}</p>}
                      {u.phone && <p className="text-admin-muted/40 text-xs mt-1">{u.phone}</p>}
                    </div>
                  ))}
                </div>
          }
        </div>
      )}

      {/* COMUNICADOS */}
      {tab === 'communications' && (
        <div className="space-y-2">
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
            : communications.length === 0
              ? <div className="glass rounded-2xl p-12 text-center"><p className="text-admin-muted/40 text-sm">Nenhum comunicado publicado</p></div>
              : communications.map(c => (
                <div key={c.id} className="glass rounded-xl px-5 py-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <p className="text-admin-text text-sm font-medium">{c.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-admin-champ/60">{COMM_TYPE_LABELS[c.type]}</span>
                        <span className={`text-[10px] font-medium ${PRIORITY_COLORS[c.priority]}`}>{c.priority?.toUpperCase()}</span>
                        {c.requires_confirmation && <span className="text-[10px] text-admin-gold">· Confirmação obrigatória</span>}
                      </div>
                    </div>
                    <p className="text-admin-muted/30 text-[10px] shrink-0">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <p className="text-admin-muted/60 text-xs line-clamp-2">{c.content}</p>
                </div>
              ))
          }
        </div>
      )}

      {/* VISUAL MERCHANDISING */}
      {tab === 'vm' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center col-span-3">Carregando…</p>
            : vmCampaigns.length === 0
              ? <div className="glass rounded-2xl p-12 text-center col-span-3"><p className="text-admin-muted/40 text-sm">Nenhuma campanha de VM</p></div>
              : vmCampaigns.map(vm => (
                <div key={vm.id} className="glass rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-admin-text text-sm font-medium">{vm.title}</p>
                    <span className={`text-[10px] ${VM_STATUS_COLORS[vm.status]}`}>{vm.status}</span>
                  </div>
                  <p className="text-admin-muted/50 text-xs capitalize mb-3">{vm.type}</p>
                  {vm.start_date && <p className="text-[10px] text-admin-muted/40">{new Date(vm.start_date).toLocaleDateString('pt-BR')} {vm.end_date ? '→ ' + new Date(vm.end_date).toLocaleDateString('pt-BR') : ''}</p>}
                </div>
              ))
          }
        </div>
      )}

      {/* Modal unidade */}
      {showUnitForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-admin-text">Nova unidade</h2>
              <button onClick={() => setShowUnitForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome *</label>
                <input value={unitForm.name} onChange={e => setUnitForm(f => ({ ...f, name: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Ex: Loja Centro SP" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Cidade</label>
                  <input value={unitForm.city} onChange={e => setUnitForm(f => ({ ...f, city: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
                </div>
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Estado</label>
                  <input value={unitForm.state} onChange={e => setUnitForm(f => ({ ...f, state: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="SP" maxLength={2} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Telefone</label>
                  <input value={unitForm.phone} onChange={e => setUnitForm(f => ({ ...f, phone: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
                </div>
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">E-mail</label>
                  <input value={unitForm.email} onChange={e => setUnitForm(f => ({ ...f, email: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveUnit} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar unidade</button>
              <button onClick={() => setShowUnitForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal comunicado */}
      {showCommForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl text-admin-text">Novo comunicado</h2>
              <button onClick={() => setShowCommForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label>
                <input value={commForm.title} onChange={e => setCommForm(f => ({ ...f, title: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Tipo</label>
                  <GlassSelect value={commForm.type} onChange={v => setCommForm(f => ({ ...f, type: v }))}
                    options={Object.entries(COMM_TYPE_LABELS).map(([value,label]) => ({value,label}))} />
                </div>
                <div>
                  <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Prioridade</label>
                  <GlassSelect value={commForm.priority} onChange={v => setCommForm(f => ({ ...f, priority: v }))}
                    options={['low','normal','high','urgent']} />
                </div>
              </div>
              <div>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Conteúdo *</label>
                <textarea value={commForm.content} onChange={e => setCommForm(f => ({ ...f, content: e.target.value }))} rows={4} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={commForm.requires_confirmation} onChange={e => setCommForm(f => ({ ...f, requires_confirmation: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-sm text-admin-muted">Exigir confirmação de leitura</span>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveCommunication} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Publicar</button>
              <button onClick={() => setShowCommForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted hover:text-admin-text transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
