// Web Vitals monitoring
export function initPerformanceMonitoring() {
  // Largest Contentful Paint (LCP)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log('LCP:', entry.renderTime || entry.loadTime)
    }
  }).observe({ entryTypes: ['largest-contentful-paint'] })

  // Cumulative Layout Shift (CLS)
  let clsValue = 0
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value
        console.log('CLS:', clsValue)
      }
    }
  }).observe({ entryTypes: ['layout-shift'] })

  // First Input Delay (FID)
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      console.log('FID:', entry.processingDuration)
    }
  }).observe({ entryTypes: ['first-input'] })

  // Navigation Timing
  window.addEventListener('load', () => {
    const perfData = window.performance.timing
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart
    console.log('Page Load Time:', pageLoadTime, 'ms')
  })
}

export function reportWebVitals(metric) {
  if (window.gtag) {
    window.gtag('event', 'page_view', {
      page_title: metric.name,
      value: Math.round(metric.value),
      event_category: 'Web Vitals',
      event_label: metric.id,
      non_interaction: true,
    })
  }
}
