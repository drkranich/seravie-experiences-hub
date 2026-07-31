import { Icon } from './ui'

// Página on-brand para módulos/subpáginas cuja função ainda será aprofundada.
// Mantém o DNA visual (glass, serif, champanhe) e a navegação já funcional.
//  - item: { key, label, icon, pages? }
//  - parentLabel: nome do módulo pai (para breadcrumb), opcional
//  - onNavigate: (key) => void  (para abrir subpáginas)
export function ScaffoldPage({ item, parentLabel, onNavigate }) {
  const pages = item.pages || []
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 text-[11px] text-admin-muted/50 mb-3">
        {parentLabel && (<><span>{parentLabel}</span><span className="opacity-30">/</span></>)}
        <span className="text-admin-champ/70">{item.label}</span>
      </div>

      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl glass-pop flex items-center justify-center shrink-0">
          <Icon name={item.icon || 'spark'} className="w-5 h-5 text-admin-champ/80" />
        </div>
        <div>
          <h1 className="font-serif text-4xl text-admin-text leading-tight">{item.label}</h1>
          <p className="text-admin-muted/60 text-sm mt-1">
            {pages.length > 0
              ? `${pages.length} áreas neste módulo · Experience OS`
              : 'Área do Experience OS — estrutura pronta, em ativação'}
          </p>
        </div>
      </div>

      {pages.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pages.map((p) => (
            <button key={p.key} onClick={() => onNavigate?.(p.key)}
              className="glass rounded-2xl p-5 text-left border border-transparent hover:border-admin-champ/25 lift transition-all">
              <div className="flex items-center justify-between mb-2">
                <p className="text-admin-text text-sm font-medium">{p.label}</p>
                <Icon name="external" className="w-3.5 h-3.5 text-admin-champ/40" />
              </div>
              <p className="text-admin-muted/40 text-xs">Abrir {p.label.toLowerCase()}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="glass rounded-3xl p-10 lg:p-14 text-center max-w-2xl">
          <div className="w-14 h-14 rounded-2xl glass-pop flex items-center justify-center mx-auto mb-5">
            <Icon name={item.icon || 'spark'} className="w-6 h-6 text-admin-champ/70" />
          </div>
          <h2 className="font-serif text-2xl text-admin-text mb-2">{item.label}</h2>
          <p className="text-admin-muted/55 text-sm leading-relaxed max-w-md mx-auto">
            Esta área faz parte do ecossistema Seravie e será ativada com dados e
            fluxos próprios do seu segmento. A estrutura, as permissões e o design
            já seguem o mesmo padrão da plataforma.
          </p>
          <div className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-xl bg-admin-champ/10 text-admin-champ/80 text-xs">
            <Icon name="spark" className="w-3.5 h-3.5" /> Em ativação
          </div>
        </div>
      )}
    </div>
  )
}
