const CACHE_PREFIX = 'seravie_'
const CACHE_DURATION = 3600000 // 1 hora

export function setCache(key, value, duration = CACHE_DURATION) {
  const data = {
    value,
    timestamp: Date.now(),
    duration,
  }
  localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(data))
}

export function getCache(key) {
  const cached = localStorage.getItem(`${CACHE_PREFIX}${key}`)
  if (!cached) return null

  const data = JSON.parse(cached)
  const isExpired = Date.now() - data.timestamp > data.duration

  if (isExpired) {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`)
    return null
  }

  return data.value
}

export function clearCache(key) {
  if (key) {
    localStorage.removeItem(`${CACHE_PREFIX}${key}`)
  } else {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(k)
      }
    })
  }
}

export function cacheWithFallback(key, fetchFn, duration = CACHE_DURATION) {
  const cached = getCache(key)
  if (cached) return Promise.resolve(cached)

  return fetchFn().then(data => {
    setCache(key, data, duration)
    return data
  })
}
