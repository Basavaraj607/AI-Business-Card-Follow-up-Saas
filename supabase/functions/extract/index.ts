import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('VITE_GEMINI_API_KEY') || ''
    const visionKey = Deno.env.get('VISION_API_KEY') || Deno.env.get('GOOGLE_VISION_API_KEY') || ''

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing environment variables on server' }), { status: 500, headers: corsHeaders })
    }

    // 1. Verify JWT — get the real user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401, headers: corsHeaders })
    }

    // 2. Get their tenant_id from profiles (server-side, trusted)
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('tenant_id, email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Failed to retrieve user tenant profile' }), { status: 404, headers: corsHeaders })
    }

    const body = await req.json().catch(() => ({}))
    const { storagePath, text: clientOcrText } = body

    if (!storagePath) {
      return new Response(JSON.stringify({ error: 'Missing storagePath parameter' }), { status: 400, headers: corsHeaders })
    }

    // Get public URL of the uploaded card image
    const { data: { publicUrl } } = adminClient.storage.from('card-images').getPublicUrl(storagePath)

    // 3. Run OCR on the uploaded card image
    let ocrText = clientOcrText || ''
    if (!ocrText && visionKey) {
      try {
        const visionRes = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                image: { source: { imageUri: publicUrl } },
                features: [{ type: 'TEXT_DETECTION' }]
              }
            ]
          })
        })
        if (visionRes.ok) {
          const visionData = await visionRes.json()
          ocrText = visionData.responses?.[0]?.fullTextAnnotation?.text || ''
        }
      } catch (err) {
        console.warn('Google Vision OCR failed, falling back:', err)
      }
    }

    // 4. Run Gemini to structure the output (Supports multimodal image parsing if OCR text is empty)
    let extracted: any = null
    if (geminiKey) {
      try {
        const hasOcr = ocrText && ocrText.trim().length > 0
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`
        
        let contents = []
        if (hasOcr) {
          contents = [
            {
              parts: [
                {
                  text: `Extract contact details from the following raw OCR text of a business card. Look for full name, email address, phone number, company name, job title, website url, and LinkedIn profile URL. If a field cannot be found, set it to an empty string. Recommend a lead status of 'hot', 'warm', or 'cold' based on the card notes. Format the output as JSON according to the schema.\n\nOCR Text:\n${ocrText}`
                }
              ]
            }
          ]
        } else {
          // Fetch image bytes to pass directly to Gemini
          const imgRes = await fetch(publicUrl)
          const imgBlob = await imgRes.blob()
          const imgBytes = new Uint8Array(await imgBlob.arrayBuffer())
          const base64Data = btoa(imgBytes.reduce((data, byte) => data + String.fromCharCode(byte), ''))
          
          contents = [
            {
              parts: [
                {
                  text: "Extract contact details from this business card image. Look for full name, email address, phone number, company name, job title, website url, and LinkedIn profile URL. If a field cannot be found, set it to an empty string. Recommend a lead status of 'hot', 'warm', or 'cold' based on the card notes. Format the output as JSON according to the schema."
                },
                {
                  inlineData: {
                    mimeType: imgBlob.type || 'image/jpeg',
                    data: base64Data
                  }
                }
              ]
            }
          ]
        }

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  name: { type: 'STRING', description: 'Full name of the contact' },
                  email: { type: 'STRING', description: 'Email address' },
                  phone: { type: 'STRING', description: 'Phone number' },
                  company: { type: 'STRING', description: 'Company name' },
                  title: { type: 'STRING', description: 'Job title' },
                  website: { type: 'STRING', description: 'Company website URL' },
                  linkedin: { type: 'STRING', description: 'LinkedIn URL' },
                  lead_status: { type: 'STRING', description: 'hot, warm, or cold' }
                },
                required: ['name']
              }
            }
          })
        })

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json()
          const textResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
          if (textResult) {
            extracted = JSON.parse(textResult)
          }
        }
      } catch (err) {
        console.warn('Gemini parser failed:', err)
      }
    }

    // Client/regex fallback if Gemini was unavailable or errored out
    if (!extracted) {
      extracted = {
        name: 'Scanned Contact',
        email: '',
        phone: '',
        company: '',
        title: '',
        website: '',
        linkedin: '',
        lead_status: 'warm'
      }
    }

    // 5. Upsert company if present
    let companyId: string | null = null
    if (extracted.company) {
      try {
        const { data: company, error: cErr } = await adminClient
          .from('companies')
          .upsert({
            tenant_id: profile.tenant_id,
            name: extracted.company,
          }, { onConflict: 'tenant_id,name' })
          .select('id')
          .single()
        
        if (!cErr && company) {
          companyId = company.id
        }
      } catch (err) {
        console.warn('Failed to upsert company:', err)
      }
    }

    // 6. Insert contact — tenant_id and created_by always populated from server
    const { data: contact, error: insErr } = await adminClient
      .from('contacts')
      .insert({
        tenant_id: profile.tenant_id,
        created_by: user.id,
        company_id: companyId,
        full_name: extracted.name || 'Scanned Contact',
        email: extracted.email || null,
        phone: extracted.phone || null,
        role: extracted.title || null,
        raw_ocr_text: ocrText || 'Direct Multimodal Parse',
        ai_structured: extracted,
        lead_status: extracted.lead_status || 'warm',
        card_image_path: storagePath,
        card_image_url: publicUrl
      })
      .select()
      .single()

    if (insErr) {
      throw insErr
    }

    return new Response(JSON.stringify(contact), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || err }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
