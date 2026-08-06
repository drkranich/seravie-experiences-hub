import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { ResourceTabs } from './ResourcePanel'
import { KanbanBoard } from './Kanban'

const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const CHANNELS = [
  { key: 'ifood', label: 'iFood' },
  { key: 'rappi', label: 'Rappi' },
  { key: '99food', label: '99Food' },
  { key: 'app', label: 'App próprio' },
  { key: 'whatsapp', label: 'WhatsApp' },
]

// ---------- Pedidos (kanban unificado dos canais) ----------
function OrdersTab({ notify }) {
  return (
    <KanbanBoard notify={notify} module="ecommerce" table="delivery_orders" title="" subtitle="pedidos dos canais de delivery em uma tela" icon="cart"
      stageField="status" stageLabel="Status" primary="customer_name" valueField="total"
      stages={[
        ['new', 'Novo', 'border-admin-champ/40'],
        ['confirmed', 'Confirmado', 'border-admin-sage/40'],
        ['preparing', 'Preparando', 'border-admin-gold/40'],
        ['dispatched', 'Saiu p/ entrega', 'border-admin-champ/50'],
        ['delivered', 'Entregue', 'border-admin-sage/50'],
        ['cancelled', 'Cancelado', 'border-admin-rose/40'],
      ]}
      chips={['channel', 'display_id', 'payment_method']}
      fields={[
        { key: 'customer_name', label: 'Cliente', type: 'text', primary: true, full: true },
        { key: 'channel', label: 'Canal', type: 'text' },
        { key: 'display_id', label: 'Código', type: 'text' },
        { key: 'customer_phone', label: 'Telefone', type: 'text' },
        { key: 'total', label: 'Total', type: 'currency' },
        { key: 'delivery_fee', label: 'Taxa de entrega', type: 'currency' },
        { key: 'payment_method', label: 'Pagamento', type: 'text' },
        { key: 'eta_minutes', label: 'ETA (min)', type: 'int' },
      ]}
      kpis={[
        { label: 'Pedidos', fmt: 'int', calc: (r) => r.length },
        { label: 'Novos', fmt: 'int', calc: (r) => r.filter((x) => x.status === 'new').length },
        { label: 'Faturamento', fmt: 'currency', calc: (r) => r.filter((x) => x.status !== 'cancelled').reduce((s, x) => s + Number(x.total || 0), 0) },
      ]}
    />
  )
}

// ---------- Canais (credenciais — pronto para plugar) ----------
function ChannelsTab({ notify }) {
  const { profile } = useTenant()
  const tenantId = profile?.tenant_id
  const [rows, setRows] = useState([])
  const load = async () => { const { data } = await supabase.from('store_channels').select('*'); setRows(data || []) }
  useEffect(() => { load() }, [])
  const byChannel = (c) => rows.find((r) => r.channel === c)
  const toggle = async (c) => {
    const existing = byChannel(c.key)
    if (existing) await supabase.from('store_channels').update({ is_enabled: !existing.is_enabled }).eq('id', existing.id)
    else await supabase.from('store_channels').insert({ tenant_id: tenantId, channel: c.key, is_enabled: true, status: 'pending' })
    load(); notify('Canal atualizado', 'success')
  }
  return (
    <div>
      <div className="glass rounded-2xl p-3 mb-4 text-[12px] text-admin-muted/70 leading-relaxed">
        Ative os canais e cadastre as credenciais de cada marketplace. A sincronização de pedidos (iFood/Rappi/99Food) exige homologação na API do canal e roda pela edge function <code className="text-admin-champ">channel-sync</code>. Enquanto não homologado, os pedidos podem ser lançados manualmente na aba "Pedidos".
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CHANNELS.map((c) => {
          const rec = byChannel(c.key)
          const on = rec?.is_enabled
          return (
            <div key={c.key} className="glass rounded-2xl p-4 flex items-center justify-between">
              <div><p className="text-admin-text text-sm font-medium">{c.label}</p><p className="text-admin-muted/40 text-[11px]">{rec ? (rec.status || 'configurar') : 'não conectado'}</p></div>
              <button onClick={() => toggle(c)} className={`text-[10px] px-3 py-1.5 rounded-lg ${on ? 'bg-admin-sage/15 text-admin-sage' : 'bg-white/[0.05] text-admin-muted/60'}`}>{on ? 'ativo' : 'ativar'}</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DeliveryHubPanel({ notify }) {
  return (
    <ResourceTabs title="Hub Delivery" subtitle="iFood, Rappi, 99Food e app próprio em uma tela só"
      tabs={[
        { key: 'orders', label: 'Pedidos', render: () => <OrdersTab notify={notify} /> },
        { key: 'channels', label: 'Canais', render: () => <ChannelsTab notify={notify} /> },
      ]}
    />
  )
}
