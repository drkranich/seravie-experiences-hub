import { supabase } from './supabase'

export const MEDIA_BUCKET = 'media'

export function publicUrl(path) {
  if (!path) return ''
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadFile(file) {
  if (!file) return { error: 'Nenhum arquivo selecionado.' }
  if (!file.type.startsWith('image/')) return { error: 'Selecione um arquivo de imagem.' }
  if (file.size > 8 * 1024 * 1024) return { error: 'Imagem muito grande (máx. 8MB).' }

  const safe = file.name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const path = `${Date.now()}-${safe}`

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (error) return { error: error.message }
  return { path, url: publicUrl(path) }
}

// Upload flexível: escolhe bucket, pasta e tipos aceitos.
// Usado pelo Seravie Flow (bucket 'flow') tanto no admin quanto no formulário público.
export async function uploadTo(file, { bucket = MEDIA_BUCKET, folder = '', accept = 'image', maxMB = 8 } = {}) {
  if (!file) return { error: 'Nenhum arquivo selecionado.' }
  if (accept === 'image' && !file.type.startsWith('image/')) return { error: 'Selecione um arquivo de imagem.' }
  if (file.size > maxMB * 1024 * 1024) return { error: `Arquivo muito grande (máx. ${maxMB}MB).` }

  const safe = (file.name || 'arquivo')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${folder ? folder.replace(/\/+$/, '') + '/' : ''}${Date.now()}-${rand}-${safe}`

  const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) return { error: error.message }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { path, url: data.publicUrl }
}

// ---------- Cofre de documentos (bucket privado 'vault') ----------
export const VAULT_BUCKET = 'vault'

// Envia qualquer tipo de arquivo ao cofre (PDF, Word, planilha, imagem...).
export async function uploadToVault(file, { folder = '', maxMB = 50 } = {}) {
  if (!file) return { error: 'Nenhum arquivo selecionado.' }
  if (file.size > maxMB * 1024 * 1024) return { error: `Arquivo muito grande (máx. ${maxMB}MB).` }
  const safe = (file.name || 'arquivo')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${folder ? folder.replace(/\/+$/, '') + '/' : ''}${Date.now()}-${rand}-${safe}`
  const { error } = await supabase.storage.from(VAULT_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) return { error: error.message }
  return { path, name: file.name, type: file.type, size: file.size }
}

// URL temporária assinada para abrir/baixar um arquivo privado do cofre.
export async function vaultSignedUrl(path, expiresIn = 3600) {
  if (!path) return { error: 'Sem caminho.' }
  const { data, error } = await supabase.storage.from(VAULT_BUCKET).createSignedUrl(path, expiresIn)
  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

export async function removeFromVault(path) {
  if (!path) return {}
  const { error } = await supabase.storage.from(VAULT_BUCKET).remove([path])
  return { error: error?.message }
}

export async function listFiles() {
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })

  if (error) return { error: error.message, files: [] }

  const files = (data || [])
    .filter((f) => f.name && f.name !== '.emptyFolderPlaceholder')
    .map((f) => ({
      name: f.name,
      url: publicUrl(f.name),
      size: f.metadata?.size || 0,
      created_at: f.created_at,
    }))
  return { files }
}

export async function removeFile(name) {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([name])
  return { error: error?.message }
}
