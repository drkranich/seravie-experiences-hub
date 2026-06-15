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
