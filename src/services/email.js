// Email Service com Templates
import { supabase } from '../lib/supabase'

const EMAIL_TEMPLATES = {
  CONTACT_CONFIRMATION: 'contact_confirmation',
  CONTACT_RECEIVED: 'contact_received',
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password_reset',
}

export async function sendEmail(to, templateId, variables = {}) {
  const template = getTemplate(templateId)
  const html = renderTemplate(template, variables)

  try {
    const response = await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject: template.subject,
        html,
        variables,
      },
    })

    return response
  } catch (error) {
    console.error('Erro ao enviar email:', error)
    throw error
  }
}

function getTemplate(templateId) {
  const templates = {
    contact_confirmation: {
      subject: 'Recebemos sua mensagem - Seravie Experiences',
      template: `
        <h2>Obrigado pelo contato!</h2>
        <p>Olá {{name}},</p>
        <p>Recebemos sua mensagem e em breve entraremos em contato.</p>
        <p>Informações da sua mensagem:</p>
        <ul>
          <li>Email: {{email}}</li>
          <li>Data: {{date}}</li>
        </ul>
        <p>Atenciosamente,<br>Seravie Experiences</p>
      `,
    },
    contact_received: {
      subject: 'Nova mensagem de contato - {{name}}',
      template: `
        <h2>Nova mensagem recebida</h2>
        <p><strong>Nome:</strong> {{name}}</p>
        <p><strong>Email:</strong> {{email}}</p>
        <p><strong>Telefone:</strong> {{phone}}</p>
        <p><strong>Mensagem:</strong></p>
        <p>{{message}}</p>
        <p><a href="{{adminUrl}}">Responder no Admin</a></p>
      `,
    },
    welcome: {
      subject: 'Bem-vindo à Seravie Experiences',
      template: `
        <h2>Bem-vindo!</h2>
        <p>Olá {{name}},</p>
        <p>Estamos felizes em tê-lo conosco!</p>
        <p><a href="{{loginUrl}}">Acessar sua conta</a></p>
      `,
    },
  }

  return templates[templateId] || templates.welcome
}

function renderTemplate(template, variables) {
  let html = template.template

  Object.entries(variables).forEach(([key, value]) => {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value)
  })

  return html
}

// Funções auxiliares
export async function sendContactConfirmation(name, email) {
  return sendEmail(email, EMAIL_TEMPLATES.CONTACT_CONFIRMATION, {
    name,
    date: new Date().toLocaleDateString('pt-BR'),
  })
}

export async function sendContactNotification(name, email, message, adminUrl) {
  return sendEmail(
    'admin@seravie.com',
    EMAIL_TEMPLATES.CONTACT_RECEIVED,
    {
      name,
      email,
      message,
      adminUrl,
    }
  )
}

export { EMAIL_TEMPLATES }
