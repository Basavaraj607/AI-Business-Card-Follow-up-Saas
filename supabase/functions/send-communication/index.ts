// supabase/functions/send-communication/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { channel, to, subject, body } = await req.json()

    if (!channel || !to || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: channel, to, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result;

    if (channel === 'email') {
      // ── Integration: Resend Email Ingest ──────────────────
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
      if (!RESEND_API_KEY) {
        return new Response(
          JSON.stringify({ error: 'Email sending not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: [to],
          subject: subject || 'Relationship Follow-up from CardFollowup',
          html: `<p>${body.replace(/\n/g, '<br>')}</p>`,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Resend API returned status ${res.status}: ${text}`)
      }

      result = await res.json()

    } else if (channel === 'sms') {
      // ── Integration: Twilio SMS Ingest ────────────────────
      const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || ''
      const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || ''
      const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER') || ''

      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        throw new Error('Missing Twilio credentials env variables')
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
      const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)

      const params = new URLSearchParams()
      params.append('To', to)
      params.append('From', TWILIO_PHONE_NUMBER)
      params.append('Body', body)

      const res = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`,
        },
        body: params.toString(),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Twilio API returned status ${res.status}: ${text}`)
      }

      result = await res.json()

    } else if (channel === 'whatsapp') {
      // ── Integration: Meta Cloud API WhatsApp ───────────────
      const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN') || ''
      const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID') || ''

      if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
        throw new Error('Missing Meta WhatsApp credentials env variables')
      }

      const whatsappUrl = `https://graph.facebook.com/v18.0/${META_PHONE_NUMBER_ID}/messages`

      const res = await fetch(whatsappUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: {
            body: body,
          },
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Meta WhatsApp API returned status ${res.status}: ${text}`)
      }

      result = await res.json()

    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported channel: ${channel}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, response: result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || err }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
