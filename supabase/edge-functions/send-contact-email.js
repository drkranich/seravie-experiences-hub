// Supabase Edge Function para enviar emails
// Deploy: supabase functions deploy send-contact-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const ADMIN_EMAIL = "admin@seravie.com"

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } })
  }

  try {
    const { id, name, email, message, phone } = await req.json()

    // Email para admin
    const adminEmailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "noreply@seravie.com",
        to: ADMIN_EMAIL,
        subject: `Nova mensagem de contato: ${name}`,
        html: `
          <h2>Nova mensagem de contato</h2>
          <p><strong>Nome:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${phone ? `<p><strong>Telefone:</strong> ${phone}</p>` : ""}
          <p><strong>Mensagem:</strong></p>
          <p>${message.replace(/\n/g, "<br>")}</p>
          <p><a href="https://seravie-experiences.com/admin">Responder no Admin</a></p>
        `,
      }),
    })

    // Email para visitante
    const visitorEmailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "noreply@seravie.com",
        to: email,
        subject: "Recebemos sua mensagem - Seravie Experiences",
        html: `
          <h2>Obrigado por entrar em contato!</h2>
          <p>Olá ${name},</p>
          <p>Recebemos sua mensagem e em breve entraremos em contato com você.</p>
          <p>Atenciosamente,<br>Seravie Experiences</p>
        `,
      }),
    })

    if (!adminEmailRes.ok || !visitorEmailRes.ok) {
      throw new Error("Erro ao enviar emails")
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }
})
