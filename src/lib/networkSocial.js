// networkSocial — vocabulário e helpers do Seravie Network (plataforma social pro).

export const POST_KINDS = {
  post: { label: 'Publicação', icon: 'spark' },
  projeto: { label: 'Projeto', icon: 'layout' },
  lancamento: { label: 'Lançamento', icon: 'star' },
  inauguracao: { label: 'Inauguração', icon: 'flame' },
  colecao: { label: 'Coleção', icon: 'grid' },
  caso: { label: 'Caso de sucesso', icon: 'heart' },
  tendencia: { label: 'Tendência', icon: 'chart' },
  artigo: { label: 'Artigo', icon: 'book' },
  vaga: { label: 'Oportunidade', icon: 'briefcase' },
}

export const COMMUNITY_THEMES = [
  { slug: 'arquitetura', name: 'Arquitetura Comercial' },
  { slug: 'hospitalidade', name: 'Hospitalidade' },
  { slug: 'branding', name: 'Branding' },
  { slug: 'marketing', name: 'Marketing' },
  { slug: 'vm', name: 'Visual Merchandising' },
  { slug: 'turismo', name: 'Turismo' },
  { slug: 'gastronomia', name: 'Gastronomia' },
  { slug: 'eventos', name: 'Eventos' },
  { slug: 'floricultura', name: 'Floricultura' },
  { slug: 'chocolateria', name: 'Chocolateria' },
]

export const PERSON_TYPES = ['Arquiteto', 'Designer', 'Consultor', 'Fotógrafo', 'Artesão', 'Especialista', 'Franqueado', 'Parceiro']

export const VERIF = {
  member: { label: 'Membro', style: 'bg-white/[0.06] text-admin-muted/70' },
  verified: { label: 'Verificado', style: 'bg-admin-champ/15 text-admin-champ' },
  pro: { label: 'Pro', style: 'bg-admin-sage/15 text-admin-sage' },
  signature: { label: 'Signature', style: 'bg-admin-gold/20 text-admin-gold' },
}

export const timeAgo = (d) => {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `${Math.floor(s / 60)}min`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 604800) return `${Math.floor(s / 86400)}d`
  return new Date(d).toLocaleDateString('pt-BR')
}

export const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
