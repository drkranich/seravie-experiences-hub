import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect } from './ui'

export function MarketingPanel({ notify }) {
  const { profile } = useTenant()
  const [tab, setTab] = useState('campaigns')
  const [campaigns, setCampaigns] = useState([])
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [campForm, setCampForm] = useState({ title: '', description: '', type: 'email' })
  const [couponForm, setCouponForm] = useState({ code: '', type: 'percentage', value: '', max_uses: '', valid_until: '' })

  const loadCampaigns = async () => { setLoading(true); const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false }); setCampaigns(data || []); setLoading(false) }
  const loadCoupons = async () => { setLoading(true); const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false }); setCoupons(data || []); setLoading(false) }

  useEffect(() => { tab === 'campaigns' ? loadCampaigns() : loadCoupons() }, [tab])

  const saveCampaign = async () => {
    if (!campForm.title.trim()) { notify('Título obrigatório', 'error'); return }
    const { error } = await supabase.from('campaigns').insert({ ...campForm, tenant_id: profile?.tenant_id, created_by: profile?.user_id })
    if (error) { notify('Erro', 'error'); return }
    notify('Campanha criada', 'success'); setShowForm(false); setCampForm({ title: '', description: '', type: 'email' }); loadCampaigns()
  }

  const saveCoupon = async () => {
    if (!couponForm.code.trim()) { notify('Código obrigatório', 'error'); return }
    const { error } = await supabase.from('coupons').insert({ ...couponForm, value: parseFloat(couponForm.value) || 0, max_uses: parseInt(couponForm.max_uses) || null, tenant_id: profile?.tenant_id })
    if (error) { notify(error.message.includes('unique') ? 'Código já existe' : 'Erro', 'error'); return }
    notify('Cupom criado', 'success'); setShowForm(false); setCouponForm({ code: '', type: 'percentage', value: '', max_uses: '', valid_until: '' }); loadCoupons()
  }

  const STATUS_COLORS = { draft:'text-admin-muted/40', scheduled:'text-admin-gold', running:'text-admin-sage', paused:'text-admin-rose', completed:'text-admin-muted/30', cancelled:'text-admin-rose/50' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif text-4xl text-admin-text">Marketing</h1><p className="text-admin-muted/60 text-sm mt-1">Campanhas, cupons e fidelidade</p></div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="spark" className="w-4 h-4" />Novo</button>
      </div>
      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {[['campaigns','Campanhas'],['coupons','Cupons']].map(([k,v]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>{v}</button>
        ))}
      </div>
      {tab === 'campaigns' && (
        <div className="space-y-2">
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center">Carregando…</p>
            : campaigns.length === 0 ? <div className="glass rounded-2xl p-10 text-center"><p className="text-admin-muted/40 text-sm">Nenhuma campanha</p></div>
            : campaigns.map(c => (
              <div key={c.id} className="glass rounded-xl px-5 py-3.5 flex items-center gap-4">
                <Icon name="star" className="w-4 h-4 text-admin-champ/40 shrink-0" />
                <div className="flex-1 min-w-0"><p className="text-admin-text text-sm truncate">{c.title}</p><div className="flex gap-3 mt-0.5"><span className="text-admin-muted/40 text-xs">{c.type}</span><span className="text-admin-muted/30 text-xs">Enviados: {c.sent_count}</span><span className="text-admin-muted/30 text-xs">Abertos: {c.open_count}</span></div></div>
                <span className={`text-[10px] font-medium ${STATUS_COLORS[c.status]}`}>{c.status}</span>
              </div>
            ))
          }
        </div>
      )}
      {tab === 'coupons' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? <p className="text-admin-muted/30 text-sm py-8 text-center col-span-3">Carregando…</p>
            : coupons.length === 0 ? <div className="glass rounded-2xl p-10 text-center col-span-3"><p className="text-admin-muted/40 text-sm">Nenhum cupom</p></div>
            : coupons.map(c => (
              <div key={c.id} className="glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-2"><p className="text-admin-champ font-mono text-sm font-medium">{c.code}</p><span className={`text-[10px] px-2 py-0.5 rounded-lg ${c.is_active ? 'bg-admin-sage/10 text-admin-sage' : 'bg-white/[0.04] text-admin-muted/40'}`}>{c.is_active ? 'ativo' : 'inativo'}</span></div>
                <p className="text-admin-text text-sm">{c.type === 'percentage' ? `${c.value}%` : `R$ ${c.value}`} de desconto</p>
                <p className="text-admin-muted/40 text-xs mt-1">Usado {c.used_count}{c.max_uses ? `/${c.max_uses}` : ''} vezes</p>
              </div>
            ))
          }
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-7 w-full max-w-md">
            <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">{tab === 'campaigns' ? 'Nova campanha' : 'Novo cupom'}</h2><button onClick={() => setShowForm(false)} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
            {tab === 'campaigns' ? (
              <div className="space-y-4">
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label><input value={campForm.title} onChange={e => setCampForm(f => ({ ...f, title: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Canal</label><GlassSelect value={campForm.type} onChange={v => setCampForm(f => ({ ...f, type: v }))} options={['email','whatsapp','sms','social','push','mixed']} /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Descrição</label><textarea value={campForm.description} onChange={e => setCampForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" /></div>
                <div className="flex gap-3"><button onClick={saveCampaign} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar</button><button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Código *</label><input value={couponForm.code} onChange={e => setCouponForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none font-mono" placeholder="EX: VERAO20" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Tipo</label><GlassSelect value={couponForm.type} onChange={v => setCouponForm(f => ({ ...f, type: v }))} options={[{value:'percentage',label:'Percentual'},{value:'fixed',label:'Fixo'}]} /></div>
                  <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Valor</label><input type="number" value={couponForm.value} onChange={e => setCouponForm(f => ({ ...f, value: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
                </div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Usos máximos</label><input type="number" value={couponForm.max_uses} onChange={e => setCouponForm(f => ({ ...f, max_uses: e.target.value }))} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Ilimitado" /></div>
                <div className="flex gap-3"><button onClick={saveCoupon} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar cupom</button><button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
