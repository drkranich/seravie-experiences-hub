import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useTenant } from '../../../hooks/useTenant'
import { useAuth } from '../../../hooks/useAuth'
import { Icon, GlassSelect } from '../ui'
import { uploadIdentityDoc } from '../../../lib/storage'

// Verificação de identidade (orofacial + documento). Fluxo:
//  1) selfie ao vivo (câmera) — captura de vivacidade (liveness)
//  2) upload do documento (frente/verso) + número (guardado apenas como hash)
//  3) envio → status "em_análise" → aprovação (manual hoje; provedor de
//     biometria plugável via Edge Function 'verify-biometrics' depois)
// Arquivos vão para bucket privado 'identity-docs' (criptografado, isolado por
// usuário). A tabela guarda só os paths e o status — nunca os binários.

const DOC_TYPES = [{ value: 'rg', label: 'RG' }, { value: 'cnh', label: 'CNH' }, { value: 'passaporte', label: 'Passaporte' }]
const STATUS = {
  pendente: { label: 'Não verificado', s: 'bg-white/[0.06] text-admin-muted/60', icon: 'user' },
  em_analise: { label: 'Em análise', s: 'bg-admin-gold/15 text-admin-gold', icon: 'clock' },
  aprovado: { label: 'Verificado', s: 'bg-admin-sage/15 text-admin-sage', icon: 'check' },
  reprovado: { label: 'Reprovado', s: 'bg-admin-rose/15 text-admin-rose', icon: 'warning' },
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function IdentityVerification({ notify }) {
  const { profile } = useTenant()
  const { user } = useAuth()
  const tenantId = profile?.tenant_id
  const [rec, setRec] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0) // 0 status · 1 selfie · 2 documento · 3 revisão

  const [f, setF] = useState({ full_name: profile?.full_name || '', doc_type: 'rg', doc_number: '' })
  const [selfieBlob, setSelfieBlob] = useState(null)
  const [selfiePreview, setSelfiePreview] = useState(null)
  const [frontFile, setFrontFile] = useState(null)
  const [backFile, setBackFile] = useState(null)
  const [saving, setSaving] = useState(false)

  const videoRef = useRef(null); const streamRef = useRef(null)
  const frontRef = useRef(null); const backRef = useRef(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('identity_verifications').select('*').eq('tenant_id', tenantId).maybeSingle()
    setRec(data || null); setLoading(false)
  }
  useEffect(() => { if (tenantId) load() }, [tenantId])

  // câmera para selfie/liveness
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 480 }, audio: false })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
    } catch { notify?.('Não foi possível acessar a câmera. Permita o acesso ou use outro dispositivo.', 'error') }
  }
  const stopCamera = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null }
  useEffect(() => { if (step === 1) startCamera(); else stopCamera(); return () => stopCamera() }, [step])

  const capture = () => {
    const v = videoRef.current; if (!v) return
    const c = document.createElement('canvas'); c.width = v.videoWidth || 480; c.height = v.videoHeight || 480
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    c.toBlob((blob) => { setSelfieBlob(blob); setSelfiePreview(URL.createObjectURL(blob)); stopCamera() }, 'image/jpeg', 0.85)
  }
  const retake = () => { setSelfieBlob(null); setSelfiePreview(null); startCamera() }

  const submit = async () => {
    if (!f.full_name.trim()) return notify?.('Informe seu nome completo', 'error')
    if (!selfieBlob) { setStep(1); return notify?.('Capture a selfie de verificação', 'error') }
    if (!frontFile) { setStep(2); return notify?.('Envie a frente do documento', 'error') }
    setSaving(true)
    try {
      const selfieFile = new File([selfieBlob], 'selfie.jpg', { type: 'image/jpeg' })
      const [selfie, front, back] = await Promise.all([
        uploadIdentityDoc(selfieFile, 'selfie'),
        uploadIdentityDoc(frontFile, 'doc-front'),
        backFile ? uploadIdentityDoc(backFile, 'doc-back') : Promise.resolve({}),
      ])
      if (selfie.error || front.error) { setSaving(false); return notify?.('Erro no upload: ' + (selfie.error || front.error), 'error') }
      const numHash = f.doc_number ? await sha256(f.doc_number) : null
      const payload = {
        tenant_id: tenantId, user_id: user?.id || null, full_name: f.full_name, doc_type: f.doc_type,
        doc_number_hash: numHash, doc_front_path: front.path, doc_back_path: back?.path || null,
        selfie_path: selfie.path, liveness_path: selfie.path, status: 'em_analise', provider: 'manual',
      }
      const { data, error } = await supabase.from('identity_verifications').upsert(payload, { onConflict: 'tenant_id,user_id' }).select('*').single()
      setSaving(false)
      if (error) return notify?.('Erro ao enviar: ' + error.message, 'error')
      setRec(data); setStep(0); notify?.('Verificação enviada! Você será notificado após a análise.', 'success')
    } catch (e) { setSaving(false); notify?.('Falha: ' + (e?.message || e), 'error') }
  }

  const cls = 'w-full glass-input rounded-xl px-4 py-2.5 text-sm text-admin-text outline-none'
  const lbl = 'text-[10px] uppercase tracking-wider text-admin-muted/50 block mb-1.5'

  if (loading) return <div className="glass rounded-2xl h-48 animate-pulse opacity-40 max-w-xl" />

  const st = STATUS[rec?.status || 'pendente']
  const verified = rec?.status === 'aprovado'

  return (
    <div className="max-w-xl">
      <div className="mb-5"><h1 className="font-serif text-2xl text-admin-text">Verificação de identidade</h1><p className="text-admin-muted/50 text-sm mt-1">Verifique sua identidade para oferecer serviços com o selo de confiança Seravie.</p></div>

      {/* status atual */}
      <div className="glass rounded-2xl p-5 mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${st.s}`}><Icon name={st.icon} className="w-5 h-5" /></div>
          <div><p className="text-admin-text text-sm font-medium">{st.label}</p>{rec?.reviewed_at && <p className="text-admin-muted/45 text-[11px]">Analisado em {new Date(rec.reviewed_at).toLocaleDateString('pt-BR')}</p>}{rec?.reviewer_note && <p className="text-admin-muted/50 text-[11px] mt-0.5">{rec.reviewer_note}</p>}</div>
        </div>
        {!verified && rec?.status !== 'em_analise' && step === 0 && <button onClick={() => setStep(1)} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm transition-colors">{rec?.status === 'reprovado' ? 'Tentar novamente' : 'Iniciar verificação'}</button>}
      </div>

      {step > 0 && !verified && (
        <div className="glass rounded-2xl p-6">
          {/* stepper */}
          <div className="flex items-center gap-2 mb-5">
            {['Selfie', 'Documento', 'Revisar'].map((s, i) => { const n = i + 1; const active = n === step; const done = n < step; return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 ${active ? 'text-admin-champ' : done ? 'text-admin-sage' : 'text-admin-muted/40'}`}><span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${active ? 'bg-admin-champ/20 ring-1 ring-admin-champ/50' : done ? 'bg-admin-sage/20' : 'bg-white/[0.05]'}`}>{done ? <Icon name="check" className="w-3.5 h-3.5" /> : n}</span><span className="text-[11px] hidden sm:block">{s}</span></div>
                {i < 2 && <div className={`h-px flex-1 ${done ? 'bg-admin-sage/30' : 'bg-white/[0.06]'}`} />}
              </div>
            )})}
          </div>

          {step === 1 && (
            <div className="text-center">
              <p className="text-admin-muted/60 text-sm mb-3">Posicione seu rosto no centro, com boa iluminação, e capture uma selfie ao vivo.</p>
              <div className="w-56 h-56 mx-auto rounded-2xl overflow-hidden bg-black/40 ring-1 ring-white/[0.08] mb-4 flex items-center justify-center">
                {selfiePreview ? <img src={selfiePreview} alt="" className="w-full h-full object-cover" /> : <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />}
              </div>
              {!selfiePreview ? <button onClick={capture} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-5 py-2.5 rounded-xl text-sm transition-colors inline-flex items-center gap-2"><Icon name="eye" className="w-4 h-4" />Capturar selfie</button>
                : <div className="flex items-center justify-center gap-2"><button onClick={retake} className="glass-input text-admin-muted/70 hover:text-admin-champ px-4 py-2 rounded-xl text-sm">Refazer</button><button onClick={() => setStep(2)} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm">Continuar</button></div>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Nome completo *</label><input value={f.full_name} onChange={(e) => setF((s) => ({ ...s, full_name: e.target.value }))} className={cls} /></div>
                <div><label className={lbl}>Tipo de documento</label><GlassSelect value={f.doc_type} onChange={(v) => setF((s) => ({ ...s, doc_type: v }))} options={DOC_TYPES} /></div>
              </div>
              <div><label className={lbl}>Número do documento (guardado com segurança)</label><input value={f.doc_number} onChange={(e) => setF((s) => ({ ...s, doc_number: e.target.value }))} placeholder="Só o hash é armazenado" className={cls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Frente do documento *</label>
                  <input ref={frontRef} type="file" accept="image/*,application/pdf" onChange={(e) => setFrontFile(e.target.files?.[0] || null)} className="hidden" />
                  <button type="button" onClick={() => frontRef.current?.click()} className="w-full h-24 rounded-xl glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors text-xs gap-2"><Icon name={frontFile ? 'check' : 'upload'} className="w-4 h-4" />{frontFile ? 'Frente enviada' : 'Enviar frente'}</button>
                </div>
                <div>
                  <label className={lbl}>Verso (opcional)</label>
                  <input ref={backRef} type="file" accept="image/*,application/pdf" onChange={(e) => setBackFile(e.target.files?.[0] || null)} className="hidden" />
                  <button type="button" onClick={() => backRef.current?.click()} className="w-full h-24 rounded-xl glass-input flex items-center justify-center text-admin-muted/60 hover:text-admin-champ transition-colors text-xs gap-2"><Icon name={backFile ? 'check' : 'upload'} className="w-4 h-4" />{backFile ? 'Verso enviado' : 'Enviar verso'}</button>
                </div>
              </div>
              <div className="flex justify-between pt-2"><button onClick={() => setStep(1)} className="text-sm text-admin-muted hover:text-admin-text px-4 py-2">Voltar</button><button onClick={() => setStep(3)} disabled={!frontFile} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-4 py-2 rounded-xl text-sm disabled:opacity-40">Revisar</button></div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="glass-soft rounded-xl p-4 space-y-2 mb-4">
                <div className="flex items-center gap-3">{selfiePreview && <img src={selfiePreview} alt="" className="w-14 h-14 rounded-lg object-cover" />}<div><p className="text-admin-text text-sm">{f.full_name}</p><p className="text-admin-muted/45 text-xs">{DOC_TYPES.find((d) => d.value === f.doc_type)?.label}{f.doc_number ? ` · ****${f.doc_number.slice(-3)}` : ''}</p></div></div>
                <p className="text-admin-muted/50 text-[11px]">✓ Selfie de vivacidade · ✓ Frente do documento{backFile ? ' · ✓ Verso' : ''}</p>
              </div>
              <p className="text-admin-muted/45 text-[11px] mb-4 leading-relaxed"><Icon name="warning" className="w-3.5 h-3.5 inline mr-1 text-admin-gold" />Seus documentos são armazenados de forma criptografada em ambiente privado e usados exclusivamente para verificação de identidade, conforme a LGPD. O número do documento é guardado apenas como hash.</p>
              <div className="flex justify-between"><button onClick={() => setStep(2)} className="text-sm text-admin-muted hover:text-admin-text px-4 py-2">Voltar</button><button onClick={submit} disabled={saving} className="bg-admin-champ/15 hover:bg-admin-champ/25 text-admin-champ px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 inline-flex items-center gap-2"><Icon name="check" className="w-4 h-4" />{saving ? 'Enviando…' : 'Enviar para verificação'}</button></div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
