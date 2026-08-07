import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useTenant } from '../../../../hooks/useTenant'
import { Icon } from '../../ui'
import { brl, num, methodLabel } from './pdvLib'

// Tela de abertura de caixa.
export function CashOpen({ onOpened, notify }) {
  const { profile } = useTenant()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const open = async () => {
    setBusy(true)
    const { data, error } = await supabase.from('cash_sessions').insert({ tenant_id: profile?.tenant_id, opening_amount: num(amount), opened_by: profile?.user_id || null, status: 'open' }).select('*').single()
    setBusy(false)
    if (error) return notify?.('Erro ao abrir caixa: ' + error.message, 'error')
    notify?.('Caixa aberto', 'success'); onOpened?.(data)
  }
  return (
    <div className="max-w-md mx-auto glass rounded-2xl p-8 text-center mt-6">
      <div className="w-14 h-14 rounded-2xl bg-admin-champ/10 flex items-center justify-center mx-auto mb-4"><Icon name="cart" className="w-7 h-7 text-admin-champ" /></div>
      <h2 className="font-serif text-2xl text-admin-text mb-1">Abrir caixa</h2>
      <p className="text-admin-muted/50 text-sm mb-6">Informe o valor inicial em dinheiro (fundo de troco).</p>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className="w-full glass-input rounded-xl px-4 py-3 text-center text-2xl text-admin-text outline-none mb-4" />
      <button onClick={open} disabled={busy} className="w-full bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-3 rounded-xl text-sm disabled:opacity-50">{busy ? 'Abrindo…' : 'Abrir caixa'}</button>
    </div>
  )
}

// Resumo e ações do caixa aberto (sangria, suprimento, fechar).
export function CashSummary({ session, onClosed, notify }) {
  const { profile } = useTenant()
  const [moves, setMoves] = useState([])
  const [modal, setModal] = useState(null) // 'withdraw' | 'deposit' | 'close'
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [counted, setCounted] = useState('')

  const load = async () => { const { data } = await supabase.from('cash_movements').select('*').eq('session_id', session.id).order('created_at'); setMoves(data || []) }
  useEffect(() => { load(); const iv = setInterval(load, 8000); return () => clearInterval(iv) }, [session.id])

  const sales = moves.filter((m) => m.type === 'sale')
  const cashSales = sales.filter((m) => m.payment_method === 'cash').reduce((s, m) => s + Number(m.amount), 0)
  const totalSales = sales.reduce((s, m) => s + Number(m.amount), 0)
  const deposits = moves.filter((m) => m.type === 'deposit').reduce((s, m) => s + Number(m.amount), 0)
  const withdrawals = moves.filter((m) => m.type === 'withdrawal').reduce((s, m) => s + Number(m.amount), 0)
  const expectedCash = Number(session.opening_amount) + cashSales + deposits - withdrawals

  const byMethod = {}
  sales.forEach((m) => { byMethod[m.payment_method] = (byMethod[m.payment_method] || 0) + Number(m.amount) })

  const addMove = async (type) => {
    if (num(amount) <= 0) return notify?.('Informe um valor', 'error')
    await supabase.from('cash_movements').insert({ tenant_id: profile?.tenant_id, session_id: session.id, type, amount: num(amount), payment_method: 'cash', description: desc || null })
    setModal(null); setAmount(''); setDesc(''); load(); notify?.(type === 'withdrawal' ? 'Sangria registrada' : 'Suprimento registrado', 'success')
  }
  const close = async () => {
    const c = num(counted)
    const { error } = await supabase.from('cash_sessions').update({ status: 'closed', closing_amount: c, expected_amount: expectedCash, difference: c - expectedCash, closed_by: profile?.user_id || null, closed_at: new Date().toISOString() }).eq('id', session.id)
    if (error) return notify?.('Erro ao fechar', 'error')
    notify?.('Caixa fechado', 'success'); setModal(null); onClosed?.()
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-admin-sage animate-pulse" /><p className="text-admin-text font-medium">Caixa aberto</p></div>
        <p className="text-admin-muted/40 text-xs">desde {new Date(session.opened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Stat label="Abertura" value={brl(session.opening_amount)} />
        <Stat label="Vendas" value={brl(totalSales)} accent="sage" />
        <Stat label="Dinheiro esperado" value={brl(expectedCash)} accent="champ" />
        <Stat label="Sangrias" value={brl(withdrawals)} accent="rose" />
      </div>
      {Object.keys(byMethod).length > 0 && (
        <div className="mb-4 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-admin-muted/50">Por forma de pagamento</p>
          {Object.entries(byMethod).map(([m, v]) => <div key={m} className="flex justify-between text-xs"><span className="text-admin-muted/60">{methodLabel(m)}</span><span className="text-admin-text">{brl(v)}</span></div>)}
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => setModal('withdraw')} className="flex-1 text-xs py-2 rounded-xl bg-white/[0.05] text-admin-muted hover:text-admin-rose">Sangria</button>
        <button onClick={() => setModal('deposit')} className="flex-1 text-xs py-2 rounded-xl bg-white/[0.05] text-admin-muted hover:text-admin-sage">Suprimento</button>
        <button onClick={() => { setCounted(''); setModal('close') }} className="flex-1 text-xs py-2 rounded-xl bg-admin-rose/15 text-admin-rose hover:bg-admin-rose/25">Fechar caixa</button>
      </div>

      {(modal === 'withdraw' || modal === 'deposit') && (
        <Modal title={modal === 'withdraw' ? 'Sangria (retirada)' : 'Suprimento (entrada)'} onClose={() => setModal(null)}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Valor" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none mb-3" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Motivo (opcional)" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none mb-4" />
          <button onClick={() => addMove(modal === 'withdraw' ? 'withdrawal' : 'deposit')} className="w-full bg-admin-champ/15 text-admin-champ py-2.5 rounded-xl text-sm">Registrar</button>
        </Modal>
      )}
      {modal === 'close' && (
        <Modal title="Fechar caixa" onClose={() => setModal(null)}>
          <p className="text-admin-muted/60 text-sm mb-3">Dinheiro esperado em caixa: <span className="text-admin-champ">{brl(expectedCash)}</span></p>
          <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1.5">Valor contado</label>
          <input value={counted} onChange={(e) => setCounted(e.target.value)} inputMode="decimal" placeholder="0,00" className="w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none mb-2" />
          {counted !== '' && <p className={`text-sm mb-4 ${num(counted) - expectedCash === 0 ? 'text-admin-sage' : 'text-admin-rose'}`}>Diferença: {brl(num(counted) - expectedCash)}</p>}
          <button onClick={close} className="w-full bg-admin-rose/15 text-admin-rose py-2.5 rounded-xl text-sm">Confirmar fechamento</button>
        </Modal>
      )}
    </div>
  )
}

function Stat({ label, value, accent = 'text' }) {
  const tone = { text: 'text-admin-text', champ: 'text-admin-champ', sage: 'text-admin-sage', rose: 'text-admin-rose' }[accent]
  return <div className="glass-soft rounded-xl p-3"><p className="text-[9px] uppercase tracking-wider text-admin-muted/50">{label}</p><p className={`text-lg font-medium tabular-nums ${tone}`}>{value}</p></div>
}
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-pop rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h3 className="font-serif text-xl text-admin-text">{title}</h3><button onClick={onClose} className="text-admin-muted hover:text-admin-text"><Icon name="x" className="w-5 h-5" /></button></div>
        {children}
      </div>
    </div>
  )
}
