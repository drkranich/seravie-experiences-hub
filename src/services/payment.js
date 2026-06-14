// Payment Service - Stripe Integration (Skeleton)
// Implementar quando versionar para SaaS

const STRIPE_PUBLIC_KEY = process.env.VITE_STRIPE_PUBLIC_KEY

export async function initializeStripe() {
  // Carregará Stripe.js quando necessário
  const script = document.createElement('script')
  script.src = 'https://js.stripe.com/v3/'
  document.head.appendChild(script)
}

export async function createPaymentIntent(amount, description) {
  const response = await fetch('/api/payment/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, description }),
  })

  return response.json()
}

export async function processPayment(paymentMethodId, amount) {
  const response = await fetch('/api/payment/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentMethodId, amount }),
  })

  return response.json()
}

export async function createSubscription(planId, customerId) {
  const response = await fetch('/api/payment/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId, customerId }),
  })

  return response.json()
}

export const PLANS = {
  FREE: { id: 'free', name: 'Grátis', price: 0 },
  STARTER: { id: 'starter', name: 'Iniciante', price: 99 },
  PROFESSIONAL: { id: 'professional', name: 'Profissional', price: 299 },
  ENTERPRISE: { id: 'enterprise', name: 'Enterprise', price: 999 },
}
