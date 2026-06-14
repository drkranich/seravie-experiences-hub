// Rate Limiting
const STORE = new Map()

export function createRateLimiter(maxRequests = 100, windowMs = 60000) {
  return function rateLimit(key) {
    const now = Date.now()
    const userKey = `ratelimit:${key}`

    if (!STORE.has(userKey)) {
      STORE.set(userKey, { count: 1, resetTime: now + windowMs })
      return { allowed: true, remaining: maxRequests - 1 }
    }

    const userData = STORE.get(userKey)

    if (now > userData.resetTime) {
      STORE.set(userKey, { count: 1, resetTime: now + windowMs })
      return { allowed: true, remaining: maxRequests - 1 }
    }

    if (userData.count >= maxRequests) {
      const retryAfter = Math.ceil((userData.resetTime - now) / 1000)
      return { allowed: false, remaining: 0, retryAfter }
    }

    userData.count++
    return { allowed: true, remaining: maxRequests - userData.count }
  }
}

export const formSubmitLimiter = createRateLimiter(5, 60000) // 5 por minuto
export const apiLimiter = createRateLimiter(100, 60000) // 100 por minuto
export const loginLimiter = createRateLimiter(5, 900000) // 5 por 15 minutos

export function checkRateLimit(limiter, identifier) {
  const result = limiter(identifier)
  if (!result.allowed) {
    throw new Error(`Rate limit exceeded. Retry after ${result.retryAfter}s`)
  }
  return result
}
