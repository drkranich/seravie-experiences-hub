import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon, GlassSelect } from '../ui'

// =====================================================================
//  CAMPAIGN STUDIO — Canais (WhatsApp/E-mail/SMS/Push) e Indicações.
// =====================================================================

// Cada canal declara seus campos de credencial (informados NA TELA).
// Campos secret: true aparecem mascarados. Ficam em marketing_channels.config
// (protegida por RLS — só o próprio tenant lê/escreve).
const CHANNELS = [
  { key: 'email', label: 'E-mail', icon: 'mail', color: 'champ', provider: 'Resend / SMTP', senderLabel: 'E-mail remetente', desc: 'Disparos e automações por e-mail.',
    fields: [
      { key: 'from_email', label: 'E-mail remetente', placeholder: 'contato@sualoja.com' },
      { key: 'from_name', label: 'Nome do remetente', placeholder: 'Sua Loja' },
      { key: 'provider', label: 'Provedor', placeholder: 'resend | sendgrid | smtp' },
      { key: 'api_key', label: 'API Key (Resend/SendGrid)', secret: true },
      { key: 'smtp_host', label: 'SMTP Host (se SMTP)', placeholder: 'smtp.seudominio.com' },
      { key: 'smtp_user', label: 'SMTP Usuário', placeholder: 'opcional' },
      { key: 'smtp_pass', label: 'SMTP Senha', secret: true },
    ] },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'chart', color: 'sage', provider: 'Meta / Twilio', senderLabel: 'Número WhatsApp', desc: 'Mensagens e templates aprovados pela Meta.',
    fields: [
      { key: 'phone_number_id', label: 'Phone Number ID', placeholder: 'ID do número (Meta)' },
      { key: 'access_token', label: 'Access Token', secret: true },
    ] },
  { key: 'sms', label: 'SMS', icon: 'chart', color: 'gold', provider: 'Twilio / Zenvia', senderLabel: 'Remetente (sender ID)', desc: 'Mensagens curtas por SMS.',
    fields: [
      { key: 'sender_id', label: 'Sender ID / número', placeholder: 'SEULOJA' },
      { key: 'account_sid', label: 'Account SID (Twilio)', placeholder: 'ACxxxxxxxx' },
      { key: 'auth_token', label: 'Auth Token', secret: true },
    ] },
  { key: 'push', label: 'Push', icon: 'spark', color: 'copper', provider: 'OneSignal / FCM', senderLabel: 'App / domínio', desc: 'Notificações push web e app.',
    fields: [
      { key: 'app_id', label: 'App ID (OneSignal)', placeholder: 'ID do app' },
      { key: 'rest_api_key', label: 'REST API Key', secret: true },
    ] },
]
const COLOR = {
  champ: { bg: 'bg-admin-champ/10', text: 'text-admin-champ', br: 'border-admin-champ/25' },
  sage: { bg: 'bg-admin-sage/10', text: 'text-admin-sage', br: 'border-admin-sage/25' },
  gold: { bg: 'bg-admin-gold/10', text: 'text-admin-gold', br: 'border-admin-gold/25' },
  copper: { bg: 'bg-admin-copper/10', text: 'text-admin-copper', br: 'border-admin-copper/25' },
}

export function ChannelsTab({ tenantId, notify }) {
  const [rows, setRows] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // channel key
  const [tplModal, setTplModal] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [chRes, tplRes] = await Promise.all([
        supabase.from('marketing_channels').select('*'),
        supabase.from('marketing_templates').select('*').order('created_at', { ascending: false }),
      ])
      setRows(chRes.data || [])
      setTemplates(tplRes.data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  const rowFor = (k) => rows.find((r) => r.channel === k)

  const toggle = async (k) => {
    const existing = rowFor(k)
    try {
      if (existing) await supabase.from('marketing_channels').update({ is_enabled: !existing.is_enabled, updated_at: new Date().toISOString() }).eq('id', existing.id)
      else await supabase.from('marketing_channels').insert({ tenant_id: tenantId, channel: k, is_enabled: true })
    } catch (e) { notify('Erro: ' + (e.message || e), 'error') }
    load()
  }
  const saveChannel = async (k, { sender_name, provider, config }) => {
    const existing = rowFor(k)
    // preserva segredos já salvos quando o campo vier vazio
    const merged = { ...(existing?.config || {}), ...config }
    Object.keys(merged).forEach((key) => { if (merged[key] === '' || merged[key] == null) delete merged[key] })
    const payload = { sender_name: sender_name || null, provider: provider || null, config: merged, updated_at: new Date().toISOString() }
    try {
      if (existing) await supabase.from('marketing_channels').update(payload).eq('id', existing.id)
      else await supabase.from('marketing_channels').insert({ tenant_id: tenantId, channel: k, ...payload })
      notify('Canal salvo', 'success'); setEditing(null); load()
    } catch (e) { notify('Erro: ' + (e.message || e), 'error') }
  }
  const removeTpl = async (t) => { try { await supabase.from('marketing_templates').delete().eq('id', t.id) } catch { /* noop */ } load() }

  return (
    <div>
      <div className="glass-soft rounded-xl px-4 py-3 mb-5 flex items-start gap-3 bg-admin-champ/[0.04] border border-admin-champ/15">
        <Icon name="gear" className="w-4 h-4 text-admin-champ/70 mt-0.5 shrink-0" />
        <p className="text-admin-muted/60 text-xs leading-relaxed">Informe as credenciais de cada canal aqui na tela. <span className="text-admin-champ">Elas ficam guardadas com segurança na sua conta</span> (área protegida, visível só para você) e são usadas pelo servidor no envio. Ativar um canal o disponibiliza para campanhas, automações e jornadas.</p>
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-10 text-center">Carregando…</p> : (
        <>
          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            {CHANNELS.map((ch) => {
              const r = rowFor(ch.key)
              const on = r?.is_enabled
              const col = COLOR[ch.color]
              return (
                <div key={ch.key} className={`glass rounded-2xl p-5 border ${on ? col.br : 'border-transparent'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl ${col.bg} flex items-center justify-center shrink-0`}><Icon name={ch.icon} className={`w-5 h-5 ${col.text}`} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-admin-text text-sm font-medium">{ch.label}</p>
                        <span className={`text-[9px] px-2 py-0.5 rounded ${on ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/40'}`}>{on ? 'ativo' : 'inativo'}</span>
                      </div>
                      <p className="text-admin-muted/50 text-xs mt-0.5">{ch.desc}</p>
                      {r?.sender_id && <p className="text-admin-muted/40 text-[11px] mt-1">{ch.senderLabel}: {r.sender_id}</p>}
                      <p className="text-admin-muted/30 text-[10px] mt-0.5">Provedor: {r?.provider || ch.provider}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/[0.05]">
                    <button onClick={() => toggle(ch.key)} className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${on ? 'bg-admin-rose/10 text-admin-rose/80 hover:bg-admin-rose/20' : 'bg-admin-sage/10 text-admin-sage hover:bg-admin-sage/20'}`}>{on ? 'Desativar' : 'Ativar'}</button>
                    <button onClick={() => setEditing(ch.key)} className="text-xs text-admin-champ/80 hover:underline ml-auto">Configurar</button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Templates */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-admin-muted/40">Templates de mensagem</p>
            <button onClick={() => setTplModal(true)} className="flex items-center gap-1.5 text-xs text-admin-champ/80 hover:text-admin-champ"><Icon name="plus" className="w-3.5 h-3.5" />Novo template</button>
          </div>
          {templates.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center"><p className="text-admin-muted/40 text-sm">Nenhum template. Crie modelos reutilizáveis (Black Friday, Boas-vindas, Aniversário…).</p></div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((t) => (
                <div key={t.id} className="glass rounded-xl p-4 group">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-admin-text text-sm font-medium truncate">{t.name}</p>
                    <button onClick={() => removeTpl(t)} className="text-admin-muted/30 hover:text-admin-rose opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="trash" className="w-3.5 h-3.5" /></button>
                  </div>
                  <p className="text-admin-muted/40 text-[10px] mb-2">{t.channel}{t.category ? ` · ${t.category}` : ''}</p>
                  {t.subject && <p className="text-admin-muted/70 text-xs truncate">{t.subject}</p>}
                  <p className="text-admin-muted/50 text-xs line-clamp-2 mt-0.5">{t.body}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editing && <ChannelModal channelKey={editing} row={rowFor(editing)} onClose={() => setEditing(null)} onSave={saveChannel} />}
      {tplModal && <TemplateModal tenantId={tenantId} notify={notify} onClose={() => setTplModal(false)} onSaved={() => { setTplModal(false); load() }} />}
    </div>
  )
}

function ChannelModal({ channelKey, row, onClose, onSave }) {
  const ch = CHANNELS.find((c) => c.key === channelKey)
  const cfg = row?.config || {}
  const [senderName, setSenderName] = useState(row?.sender_name || '')
  const [values, setValues] = useState(() => Object.fromEntries(ch.fields.map((f) => [f.key, cfg[f.key] || ''])))
  const [show, setShow] = useState({})
  const setV = (k, v) => setValues((s) => ({ ...s, [k]: v }))
  const inp = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-7 w-full max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2"><h2 className="font-serif text-2xl text-admin-text">Configurar {ch.label}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <p className="text-admin-muted/50 text-xs mb-5">{ch.desc}</p>
        <div className="space-y-4">
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome do remetente (exibição)</label><input value={senderName} onChange={(e) => setSenderName(e.target.value)} className={inp} placeholder="Ex: Loja Manos de Solei" /></div>
          {ch.fields.map((fld) => {
            const isSecret = fld.secret && !show[fld.key]
            return (
              <div key={fld.key}>
                <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">{fld.label}</label>
                <div className="relative">
                  <input type={isSecret ? 'password' : 'text'} value={values[fld.key]} onChange={(e) => setV(fld.key, e.target.value)} className={inp} placeholder={fld.placeholder || ''} autoComplete="off" />
                  {fld.secret && <button type="button" onClick={() => setShow((s) => ({ ...s, [fld.key]: !s[fld.key] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-admin-muted/50 hover:text-admin-champ">{show[fld.key] ? 'ocultar' : 'mostrar'}</button>}
                </div>
              </div>
            )
          })}
          <div className="glass-soft rounded-xl px-4 py-3 bg-admin-champ/[0.05] border border-admin-champ/15">
            <p className="text-admin-champ/80 text-[11px] leading-relaxed">🔒 Suas credenciais ficam guardadas com segurança na sua conta (área protegida) e só são usadas pelo servidor no envio. Deixe um campo secreto em branco para manter o valor já salvo.</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => onSave(channelKey, { sender_name: senderName, provider: values.provider || ch.provider, config: values })} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Salvar</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

const TPL_CATEGORIES = [
  { value: 'boas_vindas', label: 'Boas-vindas' }, { value: 'promocao', label: 'Promoção' }, { value: 'black_friday', label: 'Black Friday' },
  { value: 'natal', label: 'Natal' }, { value: 'aniversario', label: 'Aniversário' }, { value: 'pos_venda', label: 'Pós-venda' },
  { value: 'reativacao', label: 'Reativação' }, { value: 'carrinho', label: 'Carrinho abandonado' }, { value: 'outro', label: 'Outro' },
]
function TemplateModal({ tenantId, notify, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', channel: 'email', category: 'promocao', subject: '', body: '' })
  const set = (p) => setF((s) => ({ ...s, ...p }))
  const save = async () => {
    if (!f.name.trim()) return notify('Nome obrigatório', 'error')
    try {
      const { error } = await supabase.from('marketing_templates').insert({ tenant_id: tenantId, ...f })
      if (error) throw error
      notify('Template criado', 'success'); onSaved()
    } catch (e) { notify('Erro: ' + (e.message || e), 'error') }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">Novo template</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome *</label><input value={f.name} onChange={(e) => set({ name: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Canal</label><GlassSelect value={f.channel} onChange={(v) => set({ channel: v })} options={[{ value: 'email', label: 'E-mail' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'sms', label: 'SMS' }, { value: 'push', label: 'Push' }]} /></div>
          </div>
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Categoria</label><GlassSelect value={f.category} onChange={(v) => set({ category: v })} options={TPL_CATEGORIES} /></div>
          {f.channel === 'email' && <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Assunto</label><input value={f.subject} onChange={(e) => set({ subject: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>}
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Mensagem</label><textarea value={f.body} onChange={(e) => set({ body: e.target.value })} rows={5} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" placeholder="Use {nome} para personalizar." /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Criar template</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// =====================================================================
//  INDICAÇÕES (referral): programa + registro de indicações
// =====================================================================
const REF_STATUS = { pending: ['Pendente', 'bg-admin-gold/15 text-admin-gold'], converted: ['Converteu', 'bg-admin-sage/15 text-admin-sage'], rewarded: ['Recompensado', 'bg-admin-champ/15 text-admin-champ'], cancelled: ['Cancelado', 'bg-white/[0.05] text-admin-muted/40'] }

export function ReferralsTab({ tenantId, contacts = [], notify }) {
  const [program, setProgram] = useState(null)
  const [refs, setRefs] = useState([])
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [newModal, setNewModal] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [pRes, rRes, cRes] = await Promise.all([
        supabase.from('referral_programs').select('*').maybeSingle(),
        supabase.from('referrals').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('coupons').select('id, code, is_active').eq('is_active', true),
      ])
      setProgram(pRes.data || null)
      setRefs(rRes.data || [])
      setCoupons(cRes.data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const saveProgram = async (patch) => {
    try {
      if (program?.id) await supabase.from('referral_programs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', program.id)
      else await supabase.from('referral_programs').insert({ tenant_id: tenantId, ...patch })
      notify('Programa atualizado', 'success'); load()
    } catch (e) { notify('Erro: ' + (e.message || e), 'error') }
  }
  const setStatus = async (r, status) => {
    const patch = { status, updated_at: new Date().toISOString() }
    if (status === 'rewarded') patch.reward_given = true
    try { await supabase.from('referrals').update(patch).eq('id', r.id) } catch { /* noop */ }
    // recompensa em pontos ao indicador, se configurado
    if (status === 'rewarded' && program?.referrer_reward_type === 'points' && r.referrer_contact_id && program.referrer_points > 0) {
      try {
        const { data: acc } = await supabase.from('loyalty_accounts').select('*').eq('contact_id', r.referrer_contact_id).maybeSingle()
        if (acc) await supabase.from('loyalty_accounts').update({ points: (acc.points || 0) + program.referrer_points, lifetime_points: (acc.lifetime_points || 0) + program.referrer_points }).eq('id', acc.id)
        else await supabase.from('loyalty_accounts').insert({ tenant_id: tenantId, contact_id: r.referrer_contact_id, points: program.referrer_points, lifetime_points: program.referrer_points, tier: 'bronze' })
      } catch { /* noop */ }
    }
    notify('Indicação atualizada', 'success'); load()
  }

  const active = program?.is_active
  const converted = refs.filter((r) => ['converted', 'rewarded'].includes(r.status)).length

  return (
    <div>
      {loading ? <p className="text-admin-muted/30 text-sm py-10 text-center">Carregando…</p> : (
        <>
          {/* Cartão do programa */}
          <div className={`glass rounded-2xl p-5 mb-6 border ${active ? 'border-admin-sage/25' : 'border-transparent'}`}>
            <div className="flex items-start gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-xl bg-admin-rose/10 flex items-center justify-center shrink-0"><Icon name="heart" className="w-6 h-6 text-admin-rose" /></div>
              <div className="flex-1 min-w-[12rem]">
                <div className="flex items-center gap-2"><p className="text-admin-text font-medium">Programa de Indicações</p><span className={`text-[9px] px-2 py-0.5 rounded ${active ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/40'}`}>{active ? 'ativo' : 'inativo'}</span></div>
                <p className="text-admin-muted/50 text-xs mt-1">Cliente indica um amigo → ambos ganham. O indicador recebe {program?.referrer_reward_type === 'coupon' ? 'um cupom' : `${program?.referrer_points || 100} pontos`} quando a indicação converte.</p>
              </div>
              <div className="flex gap-4 items-center">
                <div className="text-center"><p className="text-admin-text text-2xl font-serif">{refs.length}</p><p className="text-admin-muted/40 text-[10px]">indicações</p></div>
                <div className="text-center"><p className="text-admin-sage text-2xl font-serif">{converted}</p><p className="text-admin-muted/40 text-[10px]">converteram</p></div>
              </div>
            </div>
            <ProgramConfig program={program} coupons={coupons} onSave={saveProgram} />
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] uppercase tracking-wider text-admin-muted/40">Indicações registradas</p>
            <button onClick={() => setNewModal(true)} className="flex items-center gap-1.5 text-xs text-admin-champ/80 hover:text-admin-champ"><Icon name="plus" className="w-3.5 h-3.5" />Registrar indicação</button>
          </div>
          {refs.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center"><p className="text-admin-muted/40 text-sm">Nenhuma indicação ainda.</p></div>
          ) : (
            <div className="space-y-2">
              {refs.map((r) => {
                const [stLabel, stCls] = REF_STATUS[r.status] || REF_STATUS.pending
                return (
                  <div key={r.id} className="glass rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                    <Icon name="user" className="w-4 h-4 text-admin-champ/40 shrink-0" />
                    <div className="flex-1 min-w-[10rem]">
                      <p className="text-admin-text text-sm">{r.referred_name} <span className="text-admin-muted/40 text-xs">indicado por {r.referrer_name || '—'}</span></p>
                      <p className="text-admin-muted/40 text-[11px]">{[r.referred_phone, r.referred_email].filter(Boolean).join(' · ') || 'sem contato'}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg shrink-0 ${stCls}`}>{stLabel}</span>
                    <div className="flex gap-2 shrink-0">
                      {r.status === 'pending' && <button onClick={() => setStatus(r, 'converted')} className="text-xs text-admin-sage hover:underline">marcar convertida</button>}
                      {r.status === 'converted' && <button onClick={() => setStatus(r, 'rewarded')} className="text-xs text-admin-champ hover:underline">recompensar</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
      {newModal && <ReferralModal tenantId={tenantId} contacts={contacts} notify={notify} onClose={() => setNewModal(false)} onSaved={() => { setNewModal(false); load() }} />}
    </div>
  )
}

function ProgramConfig({ program, coupons, onSave }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({
    is_active: program?.is_active || false,
    referrer_reward_type: program?.referrer_reward_type || 'points',
    referrer_points: program?.referrer_points ?? 100,
    referrer_coupon_id: program?.referrer_coupon_id || '',
    referred_coupon_id: program?.referred_coupon_id || '',
  })
  const set = (p) => setF((s) => ({ ...s, ...p }))
  return (
    <div className="mt-4 pt-4 border-t border-white/[0.05]">
      <button onClick={() => setOpen((o) => !o)} className="text-xs text-admin-champ/80 hover:text-admin-champ flex items-center gap-1.5"><Icon name={open ? 'up' : 'down'} className="w-3.5 h-3.5" />Configurar recompensas</button>
      {open && (
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Recompensa do indicador</label>
            <GlassSelect value={f.referrer_reward_type} onChange={(v) => set({ referrer_reward_type: v })} options={[{ value: 'points', label: 'Pontos de fidelidade' }, { value: 'coupon', label: 'Cupom' }]} />
          </div>
          {f.referrer_reward_type === 'points'
            ? <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Pontos ao indicador</label><input type="number" value={f.referrer_points} onChange={(e) => set({ referrer_points: Number(e.target.value) })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
            : <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Cupom ao indicador</label><GlassSelect value={f.referrer_coupon_id} onChange={(v) => set({ referrer_coupon_id: v })} options={[{ value: '', label: 'Selecione…' }, ...coupons.map((c) => ({ value: c.id, label: c.code }))]} /></div>}
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Cupom para o indicado</label><GlassSelect value={f.referred_coupon_id} onChange={(v) => set({ referred_coupon_id: v })} options={[{ value: '', label: 'Nenhum' }, ...coupons.map((c) => ({ value: c.id, label: c.code }))]} /></div>
          <label className="flex items-center gap-2 cursor-pointer self-end pb-2"><input type="checkbox" checked={f.is_active} onChange={(e) => set({ is_active: e.target.checked })} className="accent-admin-sage" /><span className="text-admin-muted/70 text-sm">Programa ativo</span></label>
          <div className="sm:col-span-2"><button onClick={() => onSave(f)} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors">Salvar programa</button></div>
        </div>
      )}
    </div>
  )
}

function ReferralModal({ tenantId, contacts, notify, onClose, onSaved }) {
  const [f, setF] = useState({ referrer_contact_id: '', referred_name: '', referred_phone: '', referred_email: '' })
  const set = (p) => setF((s) => ({ ...s, ...p }))
  const save = async () => {
    if (!f.referred_name.trim()) return notify('Nome do indicado obrigatório', 'error')
    const referrer = contacts.find((c) => c.id === f.referrer_contact_id)
    try {
      const { error } = await supabase.from('referrals').insert({ tenant_id: tenantId, referrer_contact_id: f.referrer_contact_id || null, referrer_name: referrer?.name || null, referred_name: f.referred_name.trim(), referred_phone: f.referred_phone || null, referred_email: f.referred_email || null, status: 'pending' })
      if (error) throw error
      notify('Indicação registrada', 'success'); onSaved()
    } catch (e) { notify('Erro: ' + (e.message || e), 'error') }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-md">
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">Registrar indicação</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-4">
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Quem indicou (cliente)</label><GlassSelect value={f.referrer_contact_id} onChange={(v) => set({ referrer_contact_id: v })} options={[{ value: '', label: 'Selecione…' }, ...contacts.slice(0, 500).map((c) => ({ value: c.id, label: c.name || 'Sem nome' }))]} /></div>
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Nome do indicado *</label><input value={f.referred_name} onChange={(e) => set({ referred_name: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Telefone</label><input value={f.referred_phone} onChange={(e) => set({ referred_phone: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">E-mail</label><input value={f.referred_email} onChange={(e) => set({ referred_email: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors">Registrar</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}
