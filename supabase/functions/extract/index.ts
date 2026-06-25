import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

// Gemini model version configuration
const GEMINI_MODEL = 'gemini-2.5-flash';

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
    const { storagePath, text: clientOcrText, geminiApiKey, action } = body
    
    // Key resolution priority: client-supplied key override, then server-side default secret.
    // Removed VITE_GEMINI_API_KEY to prevent leakage.
    const geminiKey = geminiApiKey || Deno.env.get('GEMINI_API_KEY') || '';

    if (action === 'test-key') {
      if (!geminiKey) {
        return new Response(JSON.stringify({ error: 'Missing Gemini API key' }), { status: 400, headers: corsHeaders })
      }
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Respond with the word "Success" if you can read this.'
                  }
                ]
              }
            ]
          })
        })

        if (geminiRes.ok) {
          const data = await geminiRes.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text
          if (text && text.toLowerCase().includes('success')) {
            return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          } else {
            console.error('Gemini key test: Unexpected response payload:', JSON.stringify(data))
            return new Response(JSON.stringify({ error: 'Unexpected response from Gemini API' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }
        } else {
          const errText = await geminiRes.text()
          console.error(`Gemini key test failed. HTTP Status: ${geminiRes.status}. Error body: ${errText}`)
          return new Response(JSON.stringify({ error: `Gemini API returned HTTP ${geminiRes.status}: ${errText}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      } catch (err: any) {
        console.error('Gemini key test threw exception:', err)
        return new Response(JSON.stringify({ error: err.message || err }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    if (action === 'generate-followup') {
      const { systemPrompt, userPrompt } = body
      if (!geminiKey) {
        return new Response(JSON.stringify({ error: 'Missing Gemini API key' }), { status: 400, headers: corsHeaders })
      }
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
              }
            ]
          })
        })

        if (geminiRes.ok) {
          const data = await geminiRes.json()
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            return new Response(JSON.stringify({ text }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          } else {
            console.error('Gemini follow-up: Unexpected response payload:', JSON.stringify(data))
            return new Response(JSON.stringify({ error: 'Unexpected response from Gemini API' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
          }
        } else {
          const errText = await geminiRes.text()
          console.error(`Gemini follow-up failed. HTTP Status: ${geminiRes.status}. Error body: ${errText}`)
          return new Response(JSON.stringify({ error: `Gemini API returned HTTP ${geminiRes.status}: ${errText}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      } catch (err: any) {
        console.error('Gemini follow-up threw exception:', err)
        return new Response(JSON.stringify({ error: err.message || err }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

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
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`
        
        let contents = []
        if (hasOcr) {
          contents = [
            {
              parts: [
                {
                  text: `Extract contact details from the following raw OCR text of a business card. The OCR text might be messy, garbled, or contain stray punctuation/prefixes (e.g. noise like "or " before a name, or weird brackets like "[<.]" near a phone number). Please clean up and normalize these fields.
Look for:
- name: Full name of the contact. Clean up any weird prefixes like "or " or brackets.
- email: Email address.
- phone: Phone number. Clean up spaces, brackets, or weird symbols.
- company: Company name.
- title: Job title.
- website: Company website URL.
- linkedin: LinkedIn profile URL.
- lead_status: Recommended lead status of 'hot', 'warm', or 'cold' based on the card notes.

If a field cannot be found, set it to an empty string. If the name is missing, try to deduce it from the email prefix or use 'Scanned Contact'. Format the output as JSON according to the schema.

OCR Text:
${ocrText}`
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
            
            // Check if extracted has any useful information.
            // If it is empty or only has default/fallback values, we'll run fallback regex parser.
            const hasName = extracted.name && extracted.name.trim().length > 0 && extracted.name !== 'Scanned Contact';
            const hasInfo = (extracted.email && extracted.email.trim().length > 0) ||
                            (extracted.phone && extracted.phone.trim().length > 0) ||
                            (extracted.company && extracted.company.trim().length > 0) ||
                            (extracted.title && extracted.title.trim().length > 0);
            
            if (!hasName && !hasInfo) {
              console.warn("Gemini returned empty or default data. Treating as extraction failure.");
              extracted = null;
            }
          } else {
            console.error('Gemini extraction succeeded but text is empty. Response:', JSON.stringify(geminiData))
          }
        } else {
          const errText = await geminiRes.text()
          console.error(`Gemini extraction API failed. HTTP Status: ${geminiRes.status}. Error body: ${errText}`)
        }
      } catch (err) {
        console.error('Gemini extraction parsing failed with exception:', err)
      }
    }

    // Client/regex fallback if Gemini was unavailable or errored out
    if (!extracted) {
      console.warn("Gemini extraction was unavailable or failed. Using server-side regex parser fallback.")
      const lines = (ocrText || "")
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      const parsed: any = {
        name: '',
        email: '',
        phone: '',
        company: '',
        title: '',
        website: '',
        linkedin: '',
        lead_status: 'warm'
      };

      // 1. Extract Email
      const emailRegex = /[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/i;
      for (const line of lines) {
        const match = line.match(emailRegex);
        if (match) {
          parsed.email = match[0];
          break;
        }
      }

      // 2. Extract Phone
      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
      for (const line of lines) {
        const match = line.match(phoneRegex);
        if (match) {
          parsed.phone = match[0];
          break;
        }
      }

      // 3. Extract Website
      const webRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,6})(?:\/[^\s]*)?/i;
      for (const line of lines) {
        if (line.includes('@')) continue;
        const match = line.match(webRegex);
        if (match) {
          parsed.website = match[0];
          break;
        }
      }

      // 4. Extract LinkedIn
      const liRegex = /(?:linkedin\.com\/in\/|linkedin\.com\/pub\/)?([a-zA-Z0-9-]{3,100})/i;
      for (const line of lines) {
        if (line.toLowerCase().includes('linkedin')) {
          const match = line.match(liRegex);
          if (match) {
            parsed.linkedin = line.startsWith('http') ? line : `https://linkedin.com/in/${match[1]}`;
            break;
          }
        }
      }

      // 5. Deduce Name and Title
      const nameExclusionRegex = /[0-9]|@|\.com|\.org|\.net|\.co|www\.|http|address|street|rd\.|st\.|blvd|suite|floor/i;
      const potentialLines = lines.filter(line => !nameExclusionRegex.test(line));

      if (potentialLines.length > 0) {
        parsed.name = potentialLines[0];
      }

      // Job title keywords
      const titleKeywords = [
        'manager', 'director', 'engineer', 'founder', 'ceo', 'cto', 'cfo', 'vp',
        'vice president', 'president', 'consultant', 'specialist', 'developer',
        'architect', 'designer', 'lead', 'head'
      ];
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (titleKeywords.some(keyword => lowerLine.includes(keyword))) {
          parsed.title = line;
          break;
        }
      }

      if (!parsed.title && potentialLines.length > 1) {
        parsed.title = potentialLines[1];
      }

      // Company name from email
      if (parsed.email) {
        const domain = parsed.email.split('@')[1];
        const companyPart = domain.split('.')[0];
        const commonProviders = ['gmail', 'yahoo', 'outlook', 'hotmail', 'aol', 'icloud', 'protonmail', 'zoho'];
        if (!commonProviders.includes(companyPart.toLowerCase())) {
          parsed.company = companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
        }
      }

      if (!parsed.company && potentialLines.length > 2) {
        parsed.company = potentialLines[2];
      }

      if (!parsed.name) {
        parsed.name = parsed.email ? parsed.email.split('@')[0] : 'Scanned Contact';
      }

      extracted = parsed;
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
        linkedin_url: extracted.linkedin || null,
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
