import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../ui'
import { CashOpen, CashSummary } from './pdv/KdsPDVCash'
import { KdsPDVSale } from './pdv/KdsPDVSale'
import { KdsPDVHistory } from './pdv/KdsPDVHistory'

// PDV exclusivo do KDS — vendido separado, agregável. Reúne caixa + venda + histórico.
export function KdsPDV({ kind = 'kitchen', notify }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState('sale') // sale | history

  const loadSession = async () => {
    setLoading(true)
    const { data } = await supabase.from('cash_sessions').select('*').eq('status', 'open').order('opened_at', { ascending: false }).limit(1)
    setSession((data && data[0]) || null); setLoading(false)
  }
  useEffect(() => { loadSession() }, [])

  if (loading) return <p className="text-admin-muted/30 text-sm py-16 text-center">Carregando PDV…</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1 bg-white/[0.03] p-1 rounded-xl w-fit">
          <button onClick={() => setSub('sale')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${sub === 'sale' ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}><Icon name="cart" className="w-4 h-4" />Venda</button>
          <button onClick={() => setSub('history')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${sub === 'history' ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}><Icon name="clock" className="w-4 h-4" />Vendas</button>
        </div>
        {session && <span className="text-[11px] text-admin-sage flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-admin-sage animate-pulse" />caixa aberto</span>}
      </div>

      {sub === 'history' ? (
        <KdsPDVHistory kind={kind} notify={notify} />
      ) : !session ? (
        <CashOpen notify={notify} onOpened={setSession} />
      ) : (
        <div className="space-y-4">
          <CashSummary session={session} kind={kind} notify={notify} onClosed={() => { setSession(null); loadSession() }} />
          <KdsPDVSale session={session} kind={kind} notify={notify} />
        </div>
      )}
    </div>
  )
}
