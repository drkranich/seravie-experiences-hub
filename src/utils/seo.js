export function updateMeta(title, description, image) {
  document.title = title

  const metaDescription = document.querySelector('meta[name="description"]')
  if (metaDescription) {
    metaDescription.setAttribute('content', description)
  } else {
    const meta = document.createElement('meta')
    meta.name = 'description'
    meta.content = description
    document.head.appendChild(meta)
  }

  const metaOG = document.querySelector('meta[property="og:image"]')
  if (metaOG) {
    metaOG.setAttribute('content', image)
  } else if (image) {
    const meta = document.createElement('meta')
    meta.setAttribute('property', 'og:image')
    meta.content = image
    document.head.appendChild(meta)
  }
}

export function generateSitemap(specialties, portfolio) {
  const pages = [
    { url: '/', priority: '1.0' },
    { url: '#especialidades', priority: '0.8' },
    { url: '#portfolio', priority: '0.8' },
    { url: '#contato', priority: '0.8' },
  ]

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>https://seravie-experiences.com${page.url}</loc>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`
}
