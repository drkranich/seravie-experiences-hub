import { useState } from 'react'
import { Icon } from './ui'
import { CommerceDashboard } from './commerce/CommerceDashboard'
import { CommerceCatalog } from './commerce/CommerceCatalog'
import { CommerceMarketplace } from './commerce/CommerceMarketplace'
import { CommerceShipping } from './commerce/CommerceShipping'
import { StorePanel } from './StorePanel'

// Seravie Commerce Hub — centro comercial unificado do ecossistema Seravie.
// Vende produto, serviço, experiência, reserva, assinatura, kit, digital e mais.
// Onda 1: Dashboard executivo + Catálogo multi-tipo + Marketplace (canais reais).
// A "Loja" clássica (vitrine/pedidos/frete/config) segue disponível como aba.
export function CommerceHub({ notify }) {
  const [tab, setTab] = useState('dashboard')
  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: 'chart' },
    { key: 'catalog', label: 'Catálogo', icon: 'grid' },
    { key: 'marketplace', label: 'Marketplace', icon: 'grid' },
    { key: 'shipping', label: 'Logística', icon: 'truck' },
    { key: 'store', label: 'Loja & Pedidos', icon: 'cart' },
  ]
  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">Seravie Commerce Hub</h1>
          <p className="text-admin-muted/60 text-sm mt-1">o motor de monetização do ecossistema — venda produtos, serviços, experiências e muito mais</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-white/[0.03] p-1 rounded-xl w-fit flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${tab === t.key ? 'bg-admin-champ/15 text-admin-champ' : 'text-admin-muted hover:text-admin-text'}`}>
            <Icon name={t.icon} className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <CommerceDashboard />}
      {tab === 'catalog' && <CommerceCatalog notify={notify} />}
      {tab === 'marketplace' && <CommerceMarketplace notify={notify} />}
      {tab === 'shipping' && <CommerceShipping notify={notify} />}
      {tab === 'store' && <StorePanel notify={notify} />}
    </div>
  )
}
