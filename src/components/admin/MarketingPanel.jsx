import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, GlassSelect, GlassDate } from './ui'

// ---- helpers ----
const brl = (n) => `R$ ${(Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const CHANNELS = [
  { value: 'email', label: 'E-mail' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
]
const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((c) => [c.value, c.label]))

// Aplica os filtros de público sobre a lista de contatos.
function filterAudience(contacts, aud, channel) {
  const needEmail = channel === 'email'
  const needPhone = channel === 'whatsapp' || channel === 'sms'
  return (contacts || []).filter((c) => {
    if (aud.segment && aud.segment !== 'all' && c.segment !== aud.segment) return false
    if (aud.source && aud.source !== 'all' && c.source !== aud.source) return false
    if (aud.min_ltv && Number(c.ltv || 0) < Number(aud.min_ltv)) return false
    if (aud.birthday_month && aud.birthday_month !== 'all') {
      if (!c.birthdate) return false
      const m = Number(String(c.birthdate).slice(5, 7))
      if (m !== Number(aud.birthday_month)) return false
    }
    // precisa ter o canal de contato
    if (needEmail && !c.email) return false
    if (needPhone && !c.phone) return false
    return true
  })
}

// ---- AUTOMAÇÕES (gatilhos de relacionamento) ----
const AUTOMATION_TEMPLATES = [
  { trigger: 'welcome', name: 'Boas-vindas', icon: 'spark', color: 'champ', delay: 0,
    desc: 'Primeiro contato quando um novo cliente é cadastrado no PDV.',
    subject: 'Bem-vindo(a) à nossa loja!', message: 'Olá {nome}, que alegria ter você com a gente! Aproveite um mimo especial na sua próxima visita.' },
  { trigger: 'birthday', name: 'Aniversário', icon: 'gift', color: 'rose', delay: 0,
    desc: 'Dispara no dia do aniversário do cliente (campo do cadastro do PDV).',
    subject: 'Feliz aniversário, {nome}! 🎉', message: 'Hoje é dia de comemorar! Preparamos um presente especial para você — use seu cupom antes que acabe.' },
  { trigger: 'post_sale', name: 'Pós-venda', icon: 'heart', color: 'sage', delay: 3,
    desc: 'Mensagem alguns dias após a compra: agradecimento, avaliação ou dica de uso.',
    subject: 'Como foi sua experiência?', message: 'Oi {nome}, obrigado pela sua compra! Conta pra gente o que achou — sua opinião vale muito.' },
  { trigger: 'winback', name: 'Recompra / reativação', icon: 'clock', color: 'gold', delay: 60,
    desc: 'Cliente sem comprar há N dias recebe um incentivo para voltar.',
    subject: 'Sentimos sua falta, {nome}', message: 'Faz um tempo que você não aparece! Volte com um desconto exclusivo só pra você.' },
]
const AUTO_MAP = Object.fromEntries(AUTOMATION_TEMPLATES.map((t) => [t.trigger, t]))

export function MarketingPanel({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [tab, setTab] = useState('campaigns')
  const [campaigns, setCampaigns] = useState([])
  const [coupons, setCoupons] = useState([])
  const [contacts, setContacts] = useState([])
  const [automations, setAutomations] = useState([])
  const [loading, setLoading] = useState(true)

  // modais
  const [campModal, setCampModal] = useState(false)
  const [couponModal, setCouponModal] = useState(false)
  const [autoModal, setAutoModal] = useState(null) // template

  const loadCampaigns = async () => { const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false }); setCampaigns(data || []) }
  const loadCoupons = async () => { const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false }); setCoupons(data || []) }
  const loadContacts = async () => { const { data } = await supabase.from('contacts').select('id, name, email, phone, birthdate, segment, source, ltv').limit(2000); setContacts(data || []) }
  const loadAutomations = async () => { const { data } = await supabase.from('marketing_automations').select('*, coupon:coupons(code)').order('trigger'); setAutomations(data || []) }

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([loadCampaigns(), loadCoupons(), loadContacts(), loadAutomations()])
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [])

  // ---- métricas topo ----
  const withEmail = contacts.filter((c) => c.email).length
  const withPhone = contacts.filter((c) => c.phone).length
  const activeAutos = automations.filter((a) => a.is_active).length

  const TABS = [['campaigns', 'Campanhas', 'mail'], ['automations', 'Automações', 'spark'], ['coupons', 'Cupons', 'gift'], ['audience', 'Público', 'user']]

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">Marketing & Campanhas</h1>
          <p className="text-admin-muted/60 text-sm mt-1">Relacionamento com os clientes do PDV · e-mail, WhatsApp e cupons</p>
        </div>
        <div className="flex gap-2">
          {tab === 'campaigns' && <button onClick={() => setCampModal(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Nova campanha</button>}
          {tab === 'coupons' && <button onClick={() => setCouponModal(true)} className="flex items-center gap-2 bg-admin-champ/10 hover:bg-admin-champ/20 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors"><Icon name="plus" className="w-4 h-4" />Novo cupom</button>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard icon="user" label="Contatos" value={contacts.length} sub="base total" />
        <KpiCard icon="mail" label="Com e-mail" value={withEmail} sub={contacts.length ? `${Math.round(withEmail / contacts.length * 100)}% da base` : '—'} />
        <KpiCard icon="chart" label="Com telefone" value={withPhone} sub={contacts.length ? `${Math.round(withPhone / contacts.length * 100)}% da base` : '—'} />
        <KpiCard icon="spark" label="Automações ativas" value={activeAutos} sub={`de ${AUTOMATION_TEMPLATES.length} gatilhos`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit">
        {TABS.map(([k, v, ic]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${tab === k ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}><Icon name={ic} className="w-3.5 h-3.5" />{v}</button>
        ))}
      </div>

      {loading ? <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p> : (
        <>
          {tab === 'campaigns' && <CampaignsTab campaigns={campaigns} contacts={contacts} notify={notify} reload={loadCampaigns} tenantId={tenantId} />}
          {tab === 'automations' && <AutomationsTab automations={automations} coupons={coupons} onEdit={setAutoModal} notify={notify} reload={loadAutomations} />}
          {tab === 'coupons' && <CouponsTab coupons={coupons} reload={loadCoupons} />}
          {tab === 'audience' && <AudienceTab contacts={contacts} />}
        </>
      )}

      {campModal && <CampaignModal contacts={contacts} coupons={coupons} tenantId={tenantId} createdBy={profile?.user_id} notify={notify} onClose={() => setCampModal(false)} onSaved={() => { setCampModal(false); loadCampaigns() }} />}
      {couponModal && <CouponModal tenantId={tenantId} notify={notify} onClose={() => setCouponModal(false)} onSaved={() => { setCouponModal(false); loadCoupons() }} />}
      {autoModal && <AutomationModal template={autoModal} coupons={coupons} tenantId={tenantId} notify={notify} onClose={() => setAutoModal(null)} onSaved={() => { setAutoModal(null); loadAutomations() }} />}
    </div>
  )
}

function KpiCard({ icon, label, value, sub }) {
  return (
    <div className="glass rounded-xl px-4 py-3.5">
      <div className="flex items-center gap-2 mb-1"><Icon name={icon} className="w-3.5 h-3.5 text-admin-champ/50" /><span className="text-admin-muted/50 text-[11px] uppercase tracking-wider">{label}</span></div>
      <p className="text-admin-text text-2xl font-serif">{value}</p>
      <p className="text-admin-muted/40 text-xs mt-0.5">{sub}</p>
    </div>
  )
}

// ================= CAMPANHAS =================
const CAMP_STATUS = { draft: ['Rascunho', 'text-admin-muted/40'], scheduled: ['Agendada', 'text-admin-gold'], running: ['Em envio', 'text-admin-sage'], sent: ['Enviada', 'text-admin-champ'], paused: ['Pausada', 'text-admin-rose'], completed: ['Concluída', 'text-admin-muted/40'] }

function CampaignsTab({ campaigns, contacts, notify, reload, tenantId }) {
  const [busy, setBusy] = useState(null)

  // "Envio": prepara a fila de destinatários e marca como enviada (pronto para integração real de provedor).
  const dispatch = async (c) => {
    setBusy(c.id)
    try {
      const aud = c.audience || {}
      const list = filterAudience(contacts, aud, c.type)
      if (list.length === 0) { notify('Nenhum contato no público desta campanha', 'error'); setBusy(null); return }
      // grava a fila (uma linha por destinatário) — status 'queued', pronto para o worker de envio
      const rows = list.map((ct) => ({
        tenant_id: tenantId, campaign_id: c.id, contact_id: ct.id,
        name: ct.name, email: ct.email, phone: ct.phone, channel: c.type, status: 'queued',
      }))
      // limpa fila anterior desta campanha antes de reenfileirar
      try { await supabase.from('campaign_recipients').delete().eq('campaign_id', c.id) } catch { /* noop */ }
      let inserted = 0
      try {
        const { error, count } = await supabase.from('campaign_recipients').insert(rows, { count: 'exact' })
        if (error) throw error
        inserted = count ?? rows.length
      } catch (e) { notify('Erro ao enfileirar: ' + (e.message || e), 'error'); setBusy(null); return }
      // atualiza a campanha: público + status enviada + contadores
      try {
        await supabase.from('campaigns').update({
          status: 'sent', audience_size: list.length, sent_count: list.length,
          started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
        }).eq('id', c.id)
      } catch { /* noop */ }
      notify(`${inserted} destinatários enfileirados para ${CHANNEL_LABEL[c.type] || c.type}`, 'success')
      reload()
    } finally { setBusy(null) }
  }

  const setStatus = async (c, status) => {
    try { await supabase.from('campaigns').update({ status }).eq('id', c.id) } catch { /* noop */ }
    reload()
  }
  const remove = async (c) => {
    try { await supabase.from('campaigns').delete().eq('id', c.id) } catch { /* noop */ }
    notify('Campanha removida', 'success'); reload()
  }

  if (campaigns.length === 0) return (
    <div className="glass rounded-2xl p-12 text-center"><Icon name="mail" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhuma campanha ainda. Crie a primeira para falar com sua base.</p></div>
  )
  return (
    <div className="space-y-2">
      {campaigns.map((c) => {
        const aud = c.audience || {}
        const reach = filterAudience(contacts, aud, c.type).length
        const [stLabel, stColor] = CAMP_STATUS[c.status] || [c.status, 'text-admin-muted/40']
        const openRate = c.sent_count ? Math.round((c.open_count || 0) / c.sent_count * 100) : 0
        return (
          <div key={c.id} className="glass rounded-xl px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-lg bg-admin-champ/10 flex items-center justify-center shrink-0"><Icon name={c.type === 'whatsapp' ? 'chart' : c.type === 'sms' ? 'chart' : 'mail'} className="w-4 h-4 text-admin-champ/70" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-admin-text text-sm font-medium truncate">{c.title}</p>
                <div className="flex gap-3 mt-0.5 flex-wrap">
                  <span className="text-admin-muted/40 text-xs">{CHANNEL_LABEL[c.type] || c.type}</span>
                  <span className="text-admin-muted/40 text-xs">Alcance: {reach} contato(s)</span>
                  {c.sent_count > 0 && <span className="text-admin-muted/40 text-xs">Enviados: {c.sent_count}</span>}
                  {c.sent_count > 0 && <span className="text-admin-muted/40 text-xs">Abertura: {openRate}%</span>}
                </div>
              </div>
              <span className={`text-[11px] font-medium shrink-0 ${stColor}`}>{stLabel}</span>
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.05]">
              {['draft', 'scheduled', 'paused'].includes(c.status) && (
                <button disabled={busy === c.id} onClick={() => dispatch(c)} className="flex items-center gap-1.5 text-xs bg-admin-sage/10 text-admin-sage px-3 py-1.5 rounded-lg hover:bg-admin-sage/20 transition-colors disabled:opacity-50">
                  <Icon name="spark" className="w-3.5 h-3.5" />{busy === c.id ? 'Enfileirando…' : 'Preparar envio'}
                </button>
              )}
              {c.status === 'sent' && <span className="text-xs text-admin-champ/70">✓ {c.sent_count} na fila de envio</span>}
              {c.status === 'sent' && <button onClick={() => setStatus(c, 'completed')} className="text-xs text-admin-muted hover:text-admin-champ">marcar concluída</button>}
              <button onClick={() => remove(c)} className="ml-auto text-admin-muted/50 hover:text-admin-rose transition-colors" title="Remover"><Icon name="trash" className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ================= MODAL: CAMPANHA (construtor com público) =================
function CampaignModal({ contacts, coupons, tenantId, createdBy, notify, onClose, onSaved }) {
  const [f, setF] = useState({ title: '', type: 'email', subject: '', message: '', coupon_id: '', segment: 'all', source: 'all', min_ltv: '', birthday_month: 'all' })
  const [busy, setBusy] = useState(false)
  const set = (patch) => setF((s) => ({ ...s, ...patch }))

  const aud = { segment: f.segment, source: f.source, min_ltv: f.min_ltv, birthday_month: f.birthday_month }
  const reached = filterAudience(contacts, aud, f.type)

  // opções de segmento/origem a partir dos dados reais
  const segments = ['all', ...Array.from(new Set(contacts.map((c) => c.segment).filter(Boolean)))]
  const sources = ['all', ...Array.from(new Set(contacts.map((c) => c.source).filter(Boolean)))]

  const save = async () => {
    if (!f.title.trim()) return notify('Título obrigatório', 'error')
    setBusy(true)
    const payload = {
      tenant_id: tenantId, created_by: createdBy, title: f.title.trim(), type: f.type, status: 'draft',
      subject: f.subject || null, message: f.message || null,
      coupon_id: f.coupon_id || null, audience: aud, audience_size: reached.length,
    }
    try {
      const { error } = await supabase.from('campaigns').insert(payload)
      if (error) throw error
      notify('Campanha criada', 'success'); onSaved()
    } catch (e) { notify('Erro ao salvar: ' + (e.message || e), 'error') } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Nova campanha</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* coluna esquerda: conteúdo */}
          <div className="space-y-4">
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Título *</label><input value={f.title} onChange={(e) => set({ title: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Ex: Promoção de inverno" /></div>
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Canal</label><GlassSelect value={f.type} onChange={(v) => set({ type: v })} options={CHANNELS} /></div>
            {f.type === 'email' && <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Assunto do e-mail</label><input value={f.subject} onChange={(e) => set({ subject: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>}
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Mensagem</label><textarea value={f.message} onChange={(e) => set({ message: e.target.value })} rows={5} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" placeholder="Use {nome} para personalizar." /></div>
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Cupom vinculado (opcional)</label><GlassSelect value={f.coupon_id} onChange={(v) => set({ coupon_id: v })} options={[{ value: '', label: 'Nenhum' }, ...coupons.filter((c) => c.is_active).map((c) => ({ value: c.id, label: `${c.code} · ${c.type === 'percentage' ? c.value + '%' : brl(c.value)}` }))]} /></div>
          </div>

          {/* coluna direita: público */}
          <div className="space-y-4">
            <div className="glass-soft rounded-xl p-4">
              <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Público-alvo</p>
              <div className="space-y-3">
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Segmento</label><GlassSelect value={f.segment} onChange={(v) => set({ segment: v })} options={segments.map((s) => ({ value: s, label: s === 'all' ? 'Todos os segmentos' : s }))} /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Origem do contato</label><GlassSelect value={f.source} onChange={(v) => set({ source: v })} options={sources.map((s) => ({ value: s, label: s === 'all' ? 'Todas as origens' : s === 'pdv' ? 'PDV (compradores)' : s }))} /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Aniversariantes do mês</label><GlassSelect value={f.birthday_month} onChange={(v) => set({ birthday_month: v })} options={[{ value: 'all', label: 'Qualquer mês' }, ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))]} /></div>
                <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">LTV mínimo (R$)</label><input type="number" value={f.min_ltv} onChange={(e) => set({ min_ltv: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="0" /></div>
              </div>
            </div>
            <div className="glass-soft rounded-xl p-4 bg-admin-sage/[0.05] border border-admin-sage/20 text-center">
              <p className="text-admin-sage text-3xl font-serif">{reached.length}</p>
              <p className="text-admin-muted/60 text-xs mt-1">contatos alcançados com {CHANNEL_LABEL[f.type]}</p>
              <p className="text-admin-muted/40 text-[11px] mt-1">de {contacts.length} na base · exige {f.type === 'email' ? 'e-mail' : 'telefone'} cadastrado</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button disabled={busy} onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{busy ? 'Salvando…' : 'Criar campanha'}</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ================= AUTOMAÇÕES =================
function AutomationsTab({ automations, coupons, onEdit, notify, reload }) {
  const byTrigger = Object.fromEntries(automations.map((a) => [a.trigger, a]))
  const toggle = async (a) => {
    try { await supabase.from('marketing_automations').update({ is_active: !a.is_active }).eq('id', a.id) } catch { /* noop */ }
    reload()
  }
  return (
    <div>
      <p className="text-admin-muted/50 text-xs mb-4 leading-relaxed">Automações de relacionamento disparam sozinhas com base nos eventos dos clientes do PDV. Ative um gatilho, escreva a mensagem e (opcionalmente) vincule um cupom. A execução fica pronta para o provedor de envio configurado nos Secrets do Supabase.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {AUTOMATION_TEMPLATES.map((t) => {
          const saved = byTrigger[t.trigger]
          const active = saved?.is_active
          // classes literais (Tailwind não gera classes interpoladas)
          const STY = {
            champ: { border: 'border-admin-champ/30', bg: 'bg-admin-champ/10', text: 'text-admin-champ' },
            rose: { border: 'border-admin-rose/30', bg: 'bg-admin-rose/10', text: 'text-admin-rose' },
            sage: { border: 'border-admin-sage/30', bg: 'bg-admin-sage/10', text: 'text-admin-sage' },
            gold: { border: 'border-admin-gold/30', bg: 'bg-admin-gold/10', text: 'text-admin-gold' },
          }[t.color]
          return (
            <div key={t.trigger} className={`glass rounded-2xl p-5 border transition-colors ${active ? STY.border : 'border-transparent'}`}>
              <div className="flex items-start gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl ${STY.bg} flex items-center justify-center shrink-0`}><Icon name={t.icon} className={`w-5 h-5 ${STY.text}`} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-admin-text text-sm font-medium">{t.name}</p>
                  <p className="text-admin-muted/50 text-xs mt-0.5 leading-relaxed">{t.desc}</p>
                </div>
                <button onClick={() => saved ? toggle(saved) : onEdit(t)} className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors shrink-0 ${active ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/50 hover:text-admin-text'}`}>{active ? 'ativa' : 'inativa'}</button>
              </div>
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.05]">
                {saved && <span className="text-admin-muted/40 text-xs">{CHANNEL_LABEL[saved.channel]}{saved.delay_days ? ` · ${saved.delay_days}d` : ''}{saved.coupon?.code ? ` · 🎟 ${saved.coupon.code}` : ''}</span>}
                {saved && <span className="text-admin-muted/40 text-xs">Enviadas: {saved.sent_count || 0}</span>}
                <button onClick={() => onEdit({ ...t, ...saved })} className="ml-auto text-xs text-admin-champ/70 hover:text-admin-champ">{saved ? 'editar' : 'configurar'}</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ================= MODAL: AUTOMAÇÃO =================
function AutomationModal({ template, coupons, tenantId, notify, onClose, onSaved }) {
  const existing = template.id ? template : null
  const [f, setF] = useState({
    channel: template.channel || 'email',
    delay_days: template.delay_days ?? template.delay ?? 0,
    coupon_id: template.coupon_id || '',
    subject: template.subject || AUTO_MAP[template.trigger]?.subject || '',
    message: template.message || AUTO_MAP[template.trigger]?.message || '',
    is_active: template.is_active ?? true,
  })
  const [busy, setBusy] = useState(false)
  const set = (patch) => setF((s) => ({ ...s, ...patch }))
  const showDelay = template.trigger === 'post_sale' || template.trigger === 'winback'

  const save = async () => {
    setBusy(true)
    const payload = {
      tenant_id: tenantId, trigger: template.trigger, name: AUTO_MAP[template.trigger]?.name || template.trigger,
      channel: f.channel, delay_days: Number(f.delay_days) || 0, coupon_id: f.coupon_id || null,
      subject: f.subject || null, message: f.message || null, is_active: f.is_active, updated_at: new Date().toISOString(),
    }
    try {
      let error
      if (existing?.id) { const r = await supabase.from('marketing_automations').update(payload).eq('id', existing.id); error = r.error }
      else { const r = await supabase.from('marketing_automations').insert(payload); error = r.error }
      if (error) throw error
      notify('Automação salva', 'success'); onSaved()
    } catch (e) { notify('Erro ao salvar: ' + (e.message || e), 'error') } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5"><h2 className="font-serif text-2xl text-admin-text">{AUTO_MAP[template.trigger]?.name}</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <p className="text-admin-muted/50 text-xs mb-5">{AUTO_MAP[template.trigger]?.desc}</p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Canal</label><GlassSelect value={f.channel} onChange={(v) => set({ channel: v })} options={CHANNELS} /></div>
            {showDelay && <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Dias após o evento</label><input type="number" value={f.delay_days} onChange={(e) => set({ delay_days: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>}
          </div>
          {f.channel === 'email' && <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Assunto</label><input value={f.subject} onChange={(e) => set({ subject: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>}
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Mensagem</label><textarea value={f.message} onChange={(e) => set({ message: e.target.value })} rows={4} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none resize-none" placeholder="Use {nome} para personalizar." /></div>
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Cupom (opcional)</label><GlassSelect value={f.coupon_id} onChange={(v) => set({ coupon_id: v })} options={[{ value: '', label: 'Nenhum' }, ...coupons.filter((c) => c.is_active).map((c) => ({ value: c.id, label: `${c.code} · ${c.type === 'percentage' ? c.value + '%' : brl(c.value)}` }))]} /></div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={f.is_active} onChange={(e) => set({ is_active: e.target.checked })} className="accent-admin-sage" /><span className="text-admin-muted/70 text-sm">Ativar esta automação</span></label>
        </div>
        <div className="flex gap-3 mt-6">
          <button disabled={busy} onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar automação'}</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ================= CUPONS =================
function CouponsTab({ coupons, reload }) {
  const toggle = async (c) => { try { await supabase.from('coupons').update({ is_active: !c.is_active }).eq('id', c.id) } catch { /* noop */ } reload() }
  if (coupons.length === 0) return (
    <div className="glass rounded-2xl p-12 text-center"><Icon name="gift" className="w-10 h-10 text-admin-champ/25 mx-auto mb-3" /><p className="text-admin-muted/40 text-sm">Nenhum cupom. Crie um para usar em campanhas e automações.</p></div>
  )
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {coupons.map((c) => (
        <div key={c.id} className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-admin-champ font-mono text-sm font-medium">{c.code}</p>
            <button onClick={() => toggle(c)} className={`text-[10px] px-2 py-0.5 rounded-lg transition-colors ${c.is_active ? 'bg-admin-sage/10 text-admin-sage hover:bg-admin-rose/10 hover:text-admin-rose' : 'bg-white/[0.04] text-admin-muted/40 hover:bg-admin-sage/10 hover:text-admin-sage'}`}>{c.is_active ? 'ativo' : 'inativo'}</button>
          </div>
          <p className="text-admin-text text-sm">{c.type === 'percentage' ? `${c.value}%` : brl(c.value)} de desconto</p>
          <p className="text-admin-muted/40 text-xs mt-1">Usado {c.used_count || 0}{c.max_uses ? `/${c.max_uses}` : ''} vezes</p>
        </div>
      ))}
    </div>
  )
}

// ================= MODAL: CUPOM =================
function CouponModal({ tenantId, notify, onClose, onSaved }) {
  const [f, setF] = useState({ code: '', type: 'percentage', value: '', max_uses: '', min_order: '', valid_until: '' })
  const [busy, setBusy] = useState(false)
  const set = (patch) => setF((s) => ({ ...s, ...patch }))
  const save = async () => {
    if (!f.code.trim()) return notify('Código obrigatório', 'error')
    setBusy(true)
    const payload = {
      tenant_id: tenantId, code: f.code.trim().toUpperCase(), type: f.type,
      value: parseFloat(f.value) || 0, max_uses: parseInt(f.max_uses) || null,
      min_order: parseFloat(f.min_order) || null, valid_until: f.valid_until || null, is_active: true,
    }
    try {
      const { error } = await supabase.from('coupons').insert(payload)
      if (error) throw error
      notify('Cupom criado', 'success'); onSaved()
    } catch (e) { notify(/unique|duplicate/i.test(e.message || '') ? 'Código já existe' : 'Erro: ' + (e.message || e), 'error') } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-pop rounded-2xl p-7 w-full max-w-md">
        <div className="flex items-center justify-between mb-6"><h2 className="font-serif text-2xl text-admin-text">Novo cupom</h2><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        <div className="space-y-4">
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Código *</label><input value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none font-mono" placeholder="EX: VERAO20" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Tipo</label><GlassSelect value={f.type} onChange={(v) => set({ type: v })} options={[{ value: 'percentage', label: 'Percentual' }, { value: 'fixed', label: 'Fixo (R$)' }]} /></div>
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Valor</label><input type="number" value={f.value} onChange={(e) => set({ value: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Usos máximos</label><input type="number" value={f.max_uses} onChange={(e) => set({ max_uses: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="Ilimitado" /></div>
            <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Pedido mínimo</label><input type="number" value={f.min_order} onChange={(e) => set({ min_order: e.target.value })} className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none" placeholder="—" /></div>
          </div>
          <div><label className="text-[10px] tracking-wider uppercase text-admin-muted/60 block mb-1.5">Válido até</label><GlassDate value={f.valid_until} onChange={(v) => set({ valid_until: v })} /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button disabled={busy} onClick={save} className="flex-1 bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50">{busy ? 'Salvando…' : 'Criar cupom'}</button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm text-admin-muted">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ================= PÚBLICO =================
function AudienceTab({ contacts }) {
  const bySegment = {}
  const bySource = {}
  contacts.forEach((c) => {
    const s = c.segment || 'sem segmento'; bySegment[s] = (bySegment[s] || 0) + 1
    const o = c.source || 'sem origem'; bySource[o] = (bySource[o] || 0) + 1
  })
  const birthdaysThisMonth = contacts.filter((c) => {
    if (!c.birthdate) return false
    const now = new Date()
    return Number(String(c.birthdate).slice(5, 7)) === now.getMonth() + 1
  })
  const sourceLabel = (s) => s === 'pdv' ? 'PDV (compradores)' : s
  const Row = ({ obj, labelFn }) => (
    <div className="space-y-1.5">
      {Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
        <div key={k} className="flex items-center justify-between text-sm">
          <span className="text-admin-muted/70">{labelFn ? labelFn(k) : k}</span>
          <span className="text-admin-text font-medium">{v}</span>
        </div>
      ))}
    </div>
  )
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="glass rounded-2xl p-5">
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Por segmento</p>
        {Object.keys(bySegment).length ? <Row obj={bySegment} /> : <p className="text-admin-muted/40 text-sm">Sem dados</p>}
      </div>
      <div className="glass rounded-2xl p-5">
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-3">Por origem</p>
        {Object.keys(bySource).length ? <Row obj={bySource} labelFn={sourceLabel} /> : <p className="text-admin-muted/40 text-sm">Sem dados</p>}
      </div>
      <div className="glass rounded-2xl p-5 bg-admin-rose/[0.04] border border-admin-rose/15">
        <p className="text-[11px] tracking-wider uppercase text-admin-rose/80 mb-3">🎂 Aniversariantes do mês</p>
        <p className="text-admin-text text-3xl font-serif mb-2">{birthdaysThisMonth.length}</p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {birthdaysThisMonth.slice(0, 20).map((c) => (
            <p key={c.id} className="text-admin-muted/60 text-xs truncate">{c.name} · {new Date(c.birthdate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
