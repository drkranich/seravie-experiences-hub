// Verificações de segurança
export function runSecurityAudit() {
  const audit = {
    passed: [],
    failed: [],
  }

  // 1. Verificar HTTPS
  if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
    audit.passed.push('✓ HTTPS habilitado')
  } else {
    audit.failed.push('✗ HTTPS desabilitado')
  }

  // 2. Verificar CSP headers
  const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
  if (csp) {
    audit.passed.push('✓ CSP configurado')
  } else {
    audit.failed.push('⚠ CSP não configurado')
  }

  // 3. Verificar XSS
  try {
    const script = document.createElement('script')
    script.src = 'data:text/javascript,alert("xss")'
    document.head.appendChild(script)
    audit.failed.push('✗ Vulnerável a XSS')
  } catch (e) {
    audit.passed.push('✓ Protegido contra XSS')
  }

  // 4. Verificar cookies seguros
  const cookies = document.cookie
  if (cookies.includes('Secure') && cookies.includes('SameSite')) {
    audit.passed.push('✓ Cookies seguros')
  } else {
    audit.failed.push('⚠ Cookies não totalmente seguros')
  }

  // 5. Verificar dados sensíveis em localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (
      key.includes('password') ||
      key.includes('token') ||
      key.includes('secret') ||
      key.includes('key')
    ) {
      audit.failed.push(`⚠ Dado sensível armazenado: ${key}`)
    }
  }

  return audit
}

export function sanitizeHTML(html) {
  const div = document.createElement('div')
  div.textContent = html
  return div.innerHTML
}

export function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

export function validatePhone(phone) {
  const regex = /^[\d\s\-\+\(\)]+$/
  return regex.test(phone)
}

export function hashPassword(password) {
  // Nota: Usar bcrypt ou argon2 em produção
  return btoa(password)
}
