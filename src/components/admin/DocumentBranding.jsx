import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTenant } from '../../hooks/useTenant'
import { Icon, Toggle } from './ui'
import { uploadTo } from '../../lib/storage'
import { logAudit } from '../../lib/audit'

// Marca dos documentos (white-label): o cliente decide se os arquivos gerados
// levam a marca da empresa dele. Opcional — quando desligado, os documentos são neutros.
const inputCls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
const empty = { enabled: false, company_name: '', logo_url: '', brand_color: '#1F3A5F', website: '', footer_contact: '', show_seravie_credit: true }

export function DocumentBranding({ notify }) {
  const { profile, canEdit } = useTenant()
  const tenantId = profile?.tenant_id
  const mayEdit = canEdit ? canEdit('finance') : true
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const logoRef = useRef(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('document_branding').select('*').eq('tenant_id', tenantId).maybeSingle()
      if (data) setForm({ ...empty, ...data })
      setLoading(false)
    })()
  }, [tenantId])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const pickLogo = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return notify?.('Selecione uma imagem (PNG/JPG)', 'error')
    setUploading(true)
    const r = await uploadTo(file, { bucket: 'media', folder: 'branding', accept: 'image', maxMB: 4 })
    setUploading(false)
    if (r.error) return notify?.('Erro no upload: ' + r.error, 'error')
    set({ logo_url: r.url })
    notify?.('Logo enviada', 'success')
  }

  const save = async () => {
    setSaving(true)
    const payload = { tenant_id: tenantId, ...form, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('document_branding').upsert(payload, { onConflict: 'tenant_id' })
    setSaving(false)
    if (error) return notify?.('Erro ao salvar: ' + error.message, 'error')
    logAudit({ action: 'update', resource_type: 'document_branding', resource_id: tenantId, new_data: { enabled: form.enabled } }, tenantId)
    notify?.('Marca dos documentos salva', 'success')
  }

  if (loading) return <p className="text-admin-muted/30 text-sm py-12 text-center">Carregando…</p>

  const brandColor = form.brand_color || '#1F3A5F'
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* configuração */}
      <div>
        <div className="glass-soft rounded-xl px-4 py-3 mb-4 text-xs text-admin-muted/60 leading-relaxed">
          Faça os documentos gerados (comprovantes, PDFs assinados) levarem a marca da <b>sua empresa</b>, não a da Seravie. É opcional: quando desligado, os arquivos ficam neutros. A Seravie aparece apenas como um crédito discreto no rodapé — que você também pode remover.
        </div>

        <label className="flex items-center justify-between glass rounded-xl px-4 py-3 mb-4">
          <div><p className="text-admin-text text-sm font-medium">Usar marca própria</p><p className="text-admin-muted/40 text-xs">Aplica nome, logo e cor da sua empresa nos documentos</p></div>
          <Toggle checked={!!form.enabled} onChange={(v) => set({ enabled: v })} />
        </label>

        <div className={`space-y-3 transition-opacity ${form.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Nome da empresa</label><input value={form.company_name || ''} onChange={(e) => set({ company_name: e.target.value })} className={inputCls} placeholder="Sua Empresa Ltda." /></div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Logotipo</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl glass-soft flex items-center justify-center overflow-hidden shrink-0">
                {form.logo_url ? <img src={form.logo_url} alt="logo" className="w-full h-full object-contain" /> : <Icon name="image" className="w-6 h-6 text-admin-muted/30" />}
              </div>
              <div className="flex gap-2">
                <button onClick={() => logoRef.current?.click()} disabled={uploading} className="text-xs px-3 py-2 rounded-xl bg-admin-champ/15 text-admin-champ disabled:opacity-50">{uploading ? 'Enviando…' : (form.logo_url ? 'Trocar logo' : 'Enviar logo')}</button>
                {form.logo_url && <button onClick={() => set({ logo_url: '' })} className="text-xs px-3 py-2 rounded-xl bg-white/[0.05] text-admin-muted/70 hover:text-admin-rose">Remover</button>}
              </div>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files?.[0])} />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Cor da marca</label>
            <div className="flex items-center gap-3">
              <input type="color" value={brandColor} onChange={(e) => set({ brand_color: e.target.value })} className="w-12 h-10 rounded-lg bg-transparent cursor-pointer" />
              <input value={form.brand_color || ''} onChange={(e) => set({ brand_color: e.target.value })} className={`${inputCls} w-32`} placeholder="#1F3A5F" />
            </div>
          </div>

          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Site (rodapé)</label><input value={form.website || ''} onChange={(e) => set({ website: e.target.value })} className={inputCls} placeholder="www.suaempresa.com" /></div>
          <div><label className="text-[10px] uppercase tracking-wider text-admin-muted/60 block mb-1">Contato no rodapé (opcional)</label><input value={form.footer_contact || ''} onChange={(e) => set({ footer_contact: e.target.value })} className={inputCls} placeholder="contato@suaempresa.com · (11) 90000-0000" /></div>
        </div>

        <label className="flex items-center justify-between glass rounded-xl px-4 py-3 mt-4">
          <div><p className="text-admin-text text-sm font-medium">Mostrar crédito “via Seravie”</p><p className="text-admin-muted/40 text-xs">Linha discreta no rodapé do documento. Desligue para white-label total.</p></div>
          <Toggle checked={form.show_seravie_credit !== false} onChange={(v) => set({ show_seravie_credit: v })} />
        </label>

        {mayEdit && <button onClick={save} disabled={saving} className="mt-5 w-full bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ py-2.5 rounded-xl text-sm disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar marca'}</button>}
      </div>

      {/* prévia */}
      <div>
        <p className="text-[11px] tracking-wider uppercase text-admin-champ/70 mb-2">Prévia do documento</p>
        <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#faf8f2]">
          <div className="px-5 py-3 flex items-center gap-3" style={{ background: form.enabled ? brandColor : '#1F3A5F' }}>
            {form.enabled && form.logo_url && <img src={form.logo_url} alt="logo" className="h-5 object-contain" />}
            <span className="text-white text-sm font-semibold">{(form.enabled && form.company_name ? form.company_name : 'DOCUMENTO').toUpperCase()} · Manifesto de Assinaturas</span>
          </div>
          <div className="p-5">
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: form.enabled ? brandColor : '#1F3A5F' }}>Comprovante de assinatura eletrônica</p>
            <p className="text-[#1a1a1a] text-lg font-serif mb-3">Contrato de Exemplo</p>
            <div className="h-px bg-[#e4dfd2] my-3" />
            <p className="text-[#555] text-xs">Signatário: João da Silva · Assinou · IP 200.100.50.25</p>
            <div className="h-10 w-32 border border-[#d8d4c4] rounded mt-2 flex items-center justify-center text-[#bbb] text-[10px]">assinatura</div>
            <div className="h-px bg-[#e4dfd2] my-3" />
            <p className="text-[#888] text-[9px]">Assinatura eletrônica conforme MP 2.200-2/2001.{form.enabled && (form.footer_contact || form.website) ? '  ' + (form.footer_contact || form.website) : ''}</p>
            {form.show_seravie_credit !== false && <p className="text-[#aaa] text-[8px] mt-1">Documento gerado via Seravie Experiences</p>}
          </div>
        </div>
        <p className="text-admin-muted/40 text-[11px] mt-3">A prévia reflete o cabeçalho e o rodapé do PDF e da página de validação gerados.</p>
      </div>
    </div>
  )
}
