import { useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect, AddressAutocomplete, addressFromContact } from '../ui'
import { uploadTo } from '../../../lib/storage'
import { usePersonTypes } from '../../../lib/personTypes'

// Edição completa do perfil de membro do Network:
// foto, capa, headline, bio, empresa, tipo, especialidades, skills, serviços,
// endereço (GPS), contatos e redes sociais.

export function MemberProfileEdit({ member, onClose, onSaved, notify }) {
  const m = member
  const PERSON_TYPES = usePersonTypes()
  const [f, setF] = useState({
    name: m.name || '', headline: m.headline || '', role_title: m.role_title || '', company: m.company || '',
    bio: m.bio || '', services: m.services || '',
    specialties: Array.isArray(m.specialties) ? m.specialties : [], skills: Array.isArray(m.skills) ? m.skills : [],
    avatar_url: m.avatar_url || '', cover_url: m.cover_url || '',
    website: m.website || '', instagram: m.instagram || '', linkedin: m.linkedin || '', portfolio_url: m.portfolio_url || '',
    phone: m.phone || '', whatsapp: m.whatsapp || '', email: m.email || '',
    open_to_work: !!m.open_to_work,
  })
  const [addr, setAddr] = useState(addressFromContact(m))
  const [saving, setSaving] = useState(false)
  const [upAvatar, setUpAvatar] = useState(false)
  const [upCover, setUpCover] = useState(false)
  const avatarRef = useRef(null); const coverRef = useRef(null)
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'

  const up = async (file, kind) => {
    const setU = kind === 'avatar' ? setUpAvatar : setUpCover
    setU(true)
    const r = await uploadTo(file, { folder: `network/${kind}`, accept: 'image', maxMB: 10 })
    setU(false)
    if (r.error) return notify?.(r.error, 'error')
    set(kind === 'avatar' ? 'avatar_url' : 'cover_url', r.url)
  }
  const save = async () => {
    if (!f.name.trim()) return notify?.('Informe seu nome', 'error')
    setSaving(true)
    // vincula automaticamente o catálogo de fornecedor do mesmo tenant, se houver
    let supplier_id = m.supplier_id || null
    if (!supplier_id) {
      const { data: sup } = await supabase.from('suppliers').select('id').eq('tenant_id', m.tenant_id).order('created_at', { ascending: true }).limit(1).maybeSingle()
      if (sup?.id) supplier_id = sup.id
    }
    const { data, error } = await supabase.from('network_members').update({ ...f, ...addr, supplier_id }).eq('id', m.id).select('*').single()
    setSaving(false)
    if (error) return notify?.('Erro ao salvar: ' + error.message, 'error')
    notify?.('Perfil atualizado', 'success'); onSaved?.(data)
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-xl text-admin-text">Editar meu perfil</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>

        {/* Foto + capa */}
        <div className="flex items-end gap-4 mb-4">
          <div>
            <label className={lbl}>Foto</label>
            <input ref={avatarRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && up(e.target.files[0], 'avatar')} className="hidden" />
            <button onClick={() => avatarRef.current?.click()} disabled={upAvatar} className="w-20 h-20 rounded-full overflow-hidden glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors">
              {f.avatar_url ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" /> : <Icon name={upAvatar ? 'clock' : 'image'} className="w-5 h-5" />}
            </button>
          </div>
          <div className="flex-1">
            <label className={lbl}>Capa</label>
            <input ref={coverRef} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && up(e.target.files[0], 'cover')} className="hidden" />
            <button onClick={() => coverRef.current?.click()} disabled={upCover} className="w-full h-20 rounded-xl overflow-hidden glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors">
              {f.cover_url ? <img src={f.cover_url} alt="" className="w-full h-full object-cover" /> : <span className="flex items-center gap-2 text-xs"><Icon name={upCover ? 'clock' : 'image'} className="w-4 h-4" />{upCover ? 'Enviando…' : 'Enviar capa'}</span>}
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className={lbl}>Nome *</label><input value={f.name} onChange={(e) => set('name', e.target.value)} className={cls} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Headline (chamada do perfil)</label><input value={f.headline} onChange={(e) => set('headline', e.target.value)} className={cls} placeholder="Ex.: Arquiteta de espaços comerciais" /></div>
          <div><label className={lbl}>Tipo / atuação</label><GlassSelect value={f.role_title} onChange={(v) => set('role_title', v)} options={[{ value: '', label: '—' }, ...PERSON_TYPES.map((t) => ({ value: t, label: t }))]} /></div>
          <div><label className={lbl}>Empresa</label><input value={f.company} onChange={(e) => set('company', e.target.value)} className={cls} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Sobre / Bio</label><textarea value={f.bio} onChange={(e) => set('bio', e.target.value)} rows={3} className={`${cls} resize-none`} /></div>
          <div className="sm:col-span-2"><label className={lbl}>Serviços oferecidos</label><textarea value={f.services} onChange={(e) => set('services', e.target.value)} rows={2} className={`${cls} resize-none`} placeholder="Descreva os serviços que você oferece" /></div>
          <div className="sm:col-span-2"><label className={lbl}>Especialidades (separe por vírgula)</label><input value={(f.specialties || []).join(', ')} onChange={(e) => set('specialties', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} className={cls} placeholder="Ex.: Cafeterias, Hospitalidade, Retail" /></div>
          <div className="sm:col-span-2"><label className={lbl}>Habilidades / skills (separe por vírgula)</label><input value={(f.skills || []).join(', ')} onChange={(e) => set('skills', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} className={cls} placeholder="Ex.: Projeto executivo, Luminotécnica" /></div>

          <div className="sm:col-span-2"><label className={lbl}>Endereço (GPS)</label><AddressAutocomplete value={addr} onChange={setAddr} notify={notify} /></div>

          <div><label className={lbl}>WhatsApp</label><input value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} className={cls} placeholder="5511999990000" /></div>
          <div><label className={lbl}>Telefone</label><input value={f.phone} onChange={(e) => set('phone', e.target.value)} className={cls} /></div>
          <div><label className={lbl}>E-mail</label><input value={f.email} onChange={(e) => set('email', e.target.value)} className={cls} /></div>
          <div><label className={lbl}>Site</label><input value={f.website} onChange={(e) => set('website', e.target.value)} className={cls} placeholder="seusite.com.br" /></div>
          <div><label className={lbl}>Instagram</label><input value={f.instagram} onChange={(e) => set('instagram', e.target.value)} className={cls} placeholder="@seu.perfil" /></div>
          <div><label className={lbl}>LinkedIn</label><input value={f.linkedin} onChange={(e) => set('linkedin', e.target.value)} className={cls} placeholder="URL do LinkedIn" /></div>
          <div className="sm:col-span-2"><label className={lbl}>Portfólio (URL externo, opcional)</label><input value={f.portfolio_url} onChange={(e) => set('portfolio_url', e.target.value)} className={cls} /></div>

          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-admin-text/80 mt-1"><input type="checkbox" checked={f.open_to_work} onChange={(e) => set('open_to_work', e.target.checked)} className="w-4 h-4 accent-admin-champ" />Aberto a oportunidades (aparecer no Banco de Talentos)</label>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-admin-muted hover:text-admin-text">Cancelar</button>
          <button onClick={save} disabled={saving} className="px-5 py-2 rounded-xl text-sm bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar perfil'}</button>
        </div>
      </div>
    </div>
  )
}
