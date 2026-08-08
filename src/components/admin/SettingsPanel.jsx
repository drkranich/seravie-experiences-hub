import { useState, useEffect } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { Card, Field, TextInput, TextArea, AdminBtn, Spinner, AddressAutocomplete } from './ui'
import { ImageUpload } from './ImageUpload'

export function SettingsPanel({ notify }) {
  const { settings, loading, save } = useSettings()
  const { profile, reload } = useTenant()
  const [d, setD] = useState(null)
  const [saving, setSaving] = useState(false)
  const [franchiseName, setFranchiseName] = useState('')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    if (settings) setD(JSON.parse(JSON.stringify(settings)))
  }, [settings])

  useEffect(() => {
    if (profile?.tenant_name) setFranchiseName(profile.tenant_name)
  }, [profile?.tenant_name])

  // Salva o nome da franquia (tenants.name) — o que aparece na sidebar sob "Seravie Experiences".
  const saveFranchiseName = async () => {
    const name = franchiseName.trim()
    if (!name) return notify('Informe o nome da franquia', 'error')
    setSavingName(true)
    const { error } = await supabase.from('tenants').update({ name }).eq('id', profile?.tenant_id)
    setSavingName(false)
    if (error) return notify('Erro ao salvar o nome: ' + error.message, 'error')
    notify('Nome da franquia atualizado. Recarregue para ver na barra lateral.', 'success')
    if (reload) reload()
  }

  if (loading || !d) {
    return (
      <div className="flex items-center gap-3 text-ivory/40">
        <Spinner /> Carregando…
      </div>
    )
  }

  const set = (path, value) => {
    setD((prev) => {
      const next = JSON.parse(JSON.stringify(prev))
      const keys = path.split('.')
      let o = next
      for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]] = o[keys[i]] || {}
      o[keys[keys.length - 1]] = value
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = {
      ...d,
      footer_links: Array.isArray(d.footer_links)
        ? d.footer_links
        : String(d.footer_links || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
    }
    const { error } = await save(payload)
    setSaving(false)
    if (error) notify('Erro ao salvar: ' + error, 'error')
    else notify('Configurações salvas.', 'success')
  }

  const footerText = Array.isArray(d.footer_links) ? d.footer_links.join('\n') : d.footer_links || ''

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-4xl text-ivory">Configurações</h1>
          <p className="text-ivory/45 mt-2">Marca, logo, favicon, redes sociais, rodapé e SEO.</p>
        </div>
        <AdminBtn icon={saving ? undefined : 'check'} onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando' : 'Salvar'}
        </AdminBtn>
      </div>

      {/* Nome da franquia — aparece na barra lateral, sob "Seravie Experiences" */}
      <Card className="p-6 mb-5">
        <h2 className="text-[11px] tracking-widerx uppercase text-gold mb-2">Sua franquia</h2>
        <p className="text-ivory/40 text-xs mb-4">Este é o nome que aparece na barra lateral, abaixo de “Seravie Experiences”.</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Field label="Nome da franquia">
              <TextInput value={franchiseName} onChange={(e) => setFranchiseName(e.target.value)} placeholder="Ex: Manos de Soleil" />
            </Field>
          </div>
          <AdminBtn icon={savingName ? undefined : 'check'} onClick={saveFranchiseName} disabled={savingName}>
            {savingName ? 'Salvando' : 'Salvar nome'}
          </AdminBtn>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-6">
          <h2 className="text-[11px] tracking-widerx uppercase text-gold mb-5">Marca</h2>
          <div className="space-y-4">
            <Field label="Nome">
              <TextInput value={d.brand?.name || ''} onChange={(e) => set('brand.name', e.target.value)} />
            </Field>
            <Field label="Sufixo">
              <TextInput value={d.brand?.suffix || ''} onChange={(e) => set('brand.suffix', e.target.value)} />
            </Field>
            <Field label="Tagline">
              <TextInput value={d.brand?.tagline || ''} onChange={(e) => set('brand.tagline', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-[11px] tracking-widerx uppercase text-gold mb-5">Logo &amp; Favicon</h2>
          <div className="space-y-5">
            <ImageUpload label="Logo (aparece no painel e no site)" value={d.brand?.logo_url || ''} onChange={(url) => set('brand.logo_url', url)} />
            <ImageUpload label="Favicon (ícone da aba do navegador)" value={d.brand?.favicon_url || ''} onChange={(url) => set('brand.favicon_url', url)} />
            <p className="text-ivory/35 text-xs">Recomendado: logo em PNG/SVG com fundo transparente; favicon quadrado (512×512).</p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-[11px] tracking-widerx uppercase text-gold mb-5">Redes sociais</h2>
          <div className="space-y-4">
            <Field label="Instagram (URL)">
              <TextInput value={d.social?.instagram || ''} onChange={(e) => set('social.instagram', e.target.value)} />
            </Field>
            <Field label="Pinterest (URL)">
              <TextInput value={d.social?.pinterest || ''} onChange={(e) => set('social.pinterest', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-[11px] tracking-widerx uppercase text-gold mb-5">Endereço da empresa</h2>
          <AddressAutocomplete value={d.address || {}} onChange={(a) => set('address', a)} notify={() => {}} />
        </Card>

        <Card className="p-6">
          <h2 className="text-[11px] tracking-widerx uppercase text-gold mb-5">SEO</h2>
          <div className="space-y-4">
            <Field label="Título da página">
              <TextInput value={d.seo?.title || ''} onChange={(e) => set('seo.title', e.target.value)} />
            </Field>
            <Field label="Descrição">
              <TextArea rows="2" value={d.seo?.description || ''} onChange={(e) => set('seo.description', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-[11px] tracking-widerx uppercase text-gold mb-5">Rodapé</h2>
          <Field label="Links (um por linha)">
            <TextArea rows="4" value={footerText} onChange={(e) => set('footer_links', e.target.value.split('\n'))} />
          </Field>
        </Card>
      </div>
    </div>
  )
}
