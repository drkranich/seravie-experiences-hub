export function initAnalytics() {
  // Google Analytics
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX'
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  function gtag() {
    window.dataLayer.push(arguments)
  }
  gtag('js', new Date())
  gtag('config', 'G-XXXXXXXXXX')
}

export function trackEvent(category, action, label) {
  if (window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
    })
  }
}

export function trackPageView(page) {
  if (window.gtag) {
    window.gtag('config', 'G-XXXXXXXXXX', {
      page_path: page,
    })
  }
}

export function trackFormSubmit(formName) {
  trackEvent('form', 'submit', formName)
}

export function trackButtonClick(buttonName) {
  trackEvent('button', 'click', buttonName)
}
