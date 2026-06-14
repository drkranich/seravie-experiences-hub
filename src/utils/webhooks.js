// Sistema de Webhooks
import { supabase } from '../lib/supabase'

const WEBHOOK_EVENTS = {
  CONTACT_RECEIVED: 'contact.received',
  SPECIALTY_CREATED: 'specialty.created',
  SPECIALTY_UPDATED: 'specialty.updated',
  PORTFOLIO_CREATED: 'portfolio.created',
  PORTFOLIO_UPDATED: 'portfolio.updated',
}

export async function registerWebhook(url, events) {
  const { data, error } = await supabase
    .from('webhooks')
    .insert([
      {
        url,
        events,
        active: true,
        secret: generateSecret(),
      },
    ])

  if (error) throw error
  return data
}

export async function triggerWebhook(event, data) {
  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .eq('active', true)
    .contains('events', [event])

  if (!webhooks) return

  for (const webhook of webhooks) {
    await deliverWebhook(webhook, event, data)
  }
}

async function deliverWebhook(webhook, event, data) {
  const timestamp = Date.now()
  const signature = generateSignature(webhook.secret, timestamp, data)

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp,
      },
      body: JSON.stringify({
        event,
        data,
        timestamp,
      }),
    })

    if (!response.ok) {
      await logWebhookFailure(webhook.id, event, response.status)
    }
  } catch (error) {
    await logWebhookFailure(webhook.id, event, error.message)
  }
}

function generateSecret() {
  return Math.random().toString(36).substring(2)
}

function generateSignature(secret, timestamp, data) {
  const payload = `${timestamp}.${JSON.stringify(data)}`
  return btoa(`${secret}.${payload}`)
}

async function logWebhookFailure(webhookId, event, error) {
  await supabase.from('webhook_logs').insert([
    {
      webhook_id: webhookId,
      event,
      status: 'failed',
      error,
      created_at: new Date(),
    },
  ])
}

export { WEBHOOK_EVENTS }
