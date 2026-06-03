// supabase/functions/inngest/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Inngest } from "https://esm.sh/inngest@3.15.2"
import { serve as serveInngest } from "https://esm.sh/inngest@3.15.2/deno"

// Initialize Inngest Client
const inngestClient = new Inngest({ 
  id: "cardfollowup-app",
  schemas: new Inngest.Schemas()
})

/**
 * Multi-step Workflow: Automated Relationship Follow-up Sequence
 * Starts on event: "cardfollowup/sequence.start"
 * Steps:
 * 1. Sleep for target period (default: 24h)
 * 2. Send follow-up communication
 */
const followUpWorkflow = inngestClient.createFunction(
  { id: "scheduled-followup-sequence", name: "Scheduled Follow-up Sequence" },
  { event: "cardfollowup/sequence.start" },
  async ({ event, step }) => {
    const { contactId, channel, to, subject, body, delay = "24h" } = event.data

    // Step 1: Wait before sending the message
    await step.sleep("wait-for-delay", delay)

    // Step 2: Trigger communication dispatch step
    const result = await step.run("send-communication", async () => {
      // In production, we call our send-communication worker endpoint or a database update
      console.log(`[Inngest Job Executed] Dispatched scheduled ${channel} follow-up to ${to}`);
      return { success: true, channel, to, contactId, timestamp: new Date().toISOString() };
    })

    return { status: "complete", result }
  }
)

// Configure Inngest serving handler for Deno
const inngestHandler = serveInngest({
  client: inngestClient,
  functions: [followUpWorkflow],
})

// CORS headers wrapper to allow developer sandboxes and external hooks
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-inngest-signature',
}

serve(async (req) => {
  // CORS Preflight Options
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Handle client-side events submission custom trigger route (secure event posting)
  const isSendEvent = req.headers.get('x-inngest-action') === 'send-event'
  if (req.method === 'POST' && isSendEvent) {
    try {
      const eventPayload = await req.json()
      
      const EVENT_KEY = Deno.env.get('INNGEST_EVENT_KEY') || ''
      if (!EVENT_KEY) {
        throw new Error('Missing INNGEST_EVENT_KEY in environment variables')
      }

      // Securely forward event to Inngest cloud service using backend event key
      const response = await fetch('https://inn.gs/e/' + EVENT_KEY, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Inngest API error: ${text}`)
      }

      const resData = await response.json()
      return new Response(
        JSON.stringify({ success: true, response: resData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: err.message || err }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  // Fallback default routing to Inngest handler for Dev server synchronization
  const response = await inngestHandler(req)
  
  // Attach CORS headers to response
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value)
  }

  return response
})
