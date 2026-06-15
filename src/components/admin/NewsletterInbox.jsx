import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, AdminBtn, Icon, Spinner } from './ui'

export function NewsletterInbox({ notify }) {
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase
      .from('newsletter_subscribers')
      .select('*')
      .order('created_at', { ascending: false })
    setSubs(data || [])
    setLoading(false)
  }
  useEffect(() => {
    load()
  }, [])

  const del = async (id) => {
    if (!window.confirm('Remover este inscrito?')) return
    const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', id)
    if (error) notify('Erro: ' + error.message, 'error')
    else {
      notify('Removido.', 'success')
      load()
    }
  }

  const copyAll = () => {
    const txt = subs.map((s) => s.email).join('\n')
    if (navigator.clipboard) navigator.clipboard.writeText(txt)
    notify('E-mails copiados.', 'success')
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif text-4xl text-admin-text">Newsletter</h1>
          <p className="text-admin-muted/70 mt-2">{subs.length} inscritos</p>
        </div>
        {subs.length > 0 && (
          <AdminBtn variant="ghost" icon="copy" onClick={copyAll}>
            Copiar e-mails
          </AdminBtn>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-admin-muted">
          <Spinner /> Carregando…
        </div>
      ) : subs.length === 0 ? (
        <Card className="p-10 text-center text-admin-muted">Nenhum inscrito ainda.</Card>
      ) : (
        <Card className="divide-y divide-admin-champ/10">
          {subs.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <span className="text-admin-text text-sm">{s.email}</span>
                <span className="text-admin-muted/50 text-xs ml-3">
                  {new Date(s.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <button
                onClick={() => del(s.id)}
                className="text-admin-muted/50 hover:text-admin-rose transition-colors"
                aria-label="Remover"
              >
                <Icon name="trash" className="w-4 h-4" />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
