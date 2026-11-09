const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sarvam-action',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function authenticate(request: Request): Promise<boolean> {
  const authorization = request.headers.get('authorization')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!authorization?.startsWith('Bearer ') || !supabaseUrl || !anonKey) return false
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization },
  })
  return response.ok
}

async function callSarvam(path: string, body: unknown): Promise<Response> {
  const apiKey = Deno.env.get('SARVAM_API_KEY')
  if (!apiKey) throw new Error('Sarvam AI is not configured. Set SARVAM_API_KEY for the Edge Function.')
  return await fetch(`https://api.sarvam.ai${path}`, {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function chat(messages: Array<{ role: string; content: string }>, maxTokens = 500): Promise<string> {
  const response = await callSarvam('/v1/chat/completions', {
    model: 'sarvam-105b',
    messages,
    max_tokens: maxTokens,
    temperature: 0.2,
  })
  if (!response.ok) throw new Error(`Sarvam chat request failed (${response.status}).`)
  const result = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> }
  const content = result.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('Sarvam returned an empty chat response.')
  return content.trim()
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  try {
    if (!await authenticate(request)) return jsonResponse({ error: 'A valid signed-in session is required.' }, 401)
  } catch {
    return jsonResponse({ error: 'Could not verify the signed-in session.' }, 502)
  }

  const action = request.headers.get('x-sarvam-action') ?? 'parse-search'
  if (action === 'transcribe') {
    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return jsonResponse({ error: 'Expected an audio file upload.' }, 400)
    }
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) return jsonResponse({ error: 'Choose a non-empty audio recording.' }, 400)
    if (file.size > 12 * 1024 * 1024) return jsonResponse({ error: 'Keep voice searches under 25 seconds.' }, 413)
    if (file.type && !file.type.startsWith('audio/')) return jsonResponse({ error: 'The upload must be an audio recording.' }, 415)

    const sarvamForm = new FormData()
    sarvamForm.append('file', file, file.name || 'charger-search.webm')
    sarvamForm.append('model', 'saaras:v4')
    sarvamForm.append('language_code', 'unknown')
    sarvamForm.append('keyterms', JSON.stringify(['EV charging', 'charger', 'Type 2', 'CCS2']))
    const apiKey = Deno.env.get('SARVAM_API_KEY')
    if (!apiKey) return jsonResponse({ error: 'Sarvam AI is not configured. Set SARVAM_API_KEY for the Edge Function.' }, 503)
    const response = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'api-subscription-key': apiKey },
      body: sarvamForm,
    })
    if (!response.ok) return jsonResponse({ error: `Sarvam speech recognition failed (${response.status}).` }, 502)
    const result = await response.json() as { transcript?: unknown; language_code?: unknown }
    if (typeof result.transcript !== 'string') return jsonResponse({ error: 'Sarvam returned an invalid transcript.' }, 502)
    return jsonResponse({ transcript: result.transcript, language_code: result.language_code ?? null })
  }

  if (action === 'explain-bill') {
    let body: {
      quantity?: unknown
      rate?: unknown
      platform_fee?: unknown
      total?: unknown
      method?: unknown
      language?: unknown
    }
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ error: 'Expected bill details as JSON.' }, 400)
    }
    const supportedLanguages: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' }
    if (typeof body.quantity !== 'number' || typeof body.rate !== 'number'
      || typeof body.total !== 'number' || !['ACTUAL', 'ESTIMATED'].includes(String(body.method))
      || typeof body.language !== 'string' || !supportedLanguages[body.language]) {
      return jsonResponse({ error: 'Bill details are incomplete or invalid.' }, 400)
    }

    try {
      const english = await chat([
        {
          role: 'system',
          content: 'Explain this EV charging bill in plain language in 2-4 short sentences. State the energy units, rate per kWh, platform fee, total, and whether energy is ACTUAL meter-based or ESTIMATED time-based. Never calculate or invent a missing fee. If platform_fee is null, say the bill data does not show a platform fee. Clarify estimated consumption is not a meter measurement. Use only the supplied data.',
        },
        { role: 'user', content: JSON.stringify({
          quantity_kwh: body.quantity,
          rate_inr_per_kwh: body.rate,
          platform_fee_inr: typeof body.platform_fee === 'number' ? body.platform_fee : null,
          total_inr: body.total,
          consumption_method: body.method,
        }) },
      ], 250)
      const languageCode = supportedLanguages[body.language]
      if (languageCode === 'en-IN') return jsonResponse({ explanation: english, language_code: languageCode })

      const translation = await callSarvam('/translate', {
        input: english,
        source_language_code: 'en-IN',
        target_language_code: languageCode,
        model: 'sarvam-translate:v1',
      })
      if (!translation.ok) return jsonResponse({ error: `Sarvam translation failed (${translation.status}).` }, 502)
      const result = await translation.json() as { translated_text?: unknown }
      if (typeof result.translated_text !== 'string' || !result.translated_text.trim()) {
        return jsonResponse({ error: 'Sarvam returned an invalid bill translation.' }, 502)
      }
      return jsonResponse({ explanation: result.translated_text, language_code: languageCode })
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'Could not explain this bill.' }, 502)
    }
  }

  if (action === 'speak') {
    let body: { text?: unknown; language?: unknown }
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ error: 'Expected text-to-speech data as JSON.' }, 400)
    }
    const languageCodes: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' }
    if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2500
      || typeof body.language !== 'string' || !languageCodes[body.language]) {
      return jsonResponse({ error: 'Text or language is invalid for speech playback.' }, 400)
    }
    try {
      const response = await callSarvam('/text-to-speech', {
        text: body.text.trim(),
        model: 'bulbul:v3',
        language_code: languageCodes[body.language],
        speaker: 'shubh',
        output_audio_codec: 'wav',
      })
      if (!response.ok) return jsonResponse({ error: `Sarvam speech generation failed (${response.status}).` }, 502)
      const result = await response.json() as { audios?: unknown }
      const audio = Array.isArray(result.audios) ? result.audios[0] : null
      if (typeof audio !== 'string') return jsonResponse({ error: 'Sarvam returned invalid speech audio.' }, 502)
      return jsonResponse({ audio })
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'Could not generate speech.' }, 502)
    }
  }

  if (action === 'support-chat') {
    let body: { messages?: unknown }
    try {
      body = await request.json()
    } catch {
      return jsonResponse({ error: 'Expected chat messages as JSON.' }, 400)
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 12) {
      return jsonResponse({ error: 'Send between 1 and 12 chat messages.' }, 400)
    }
    const messages = body.messages.flatMap((message) => {
      if (!message || typeof message !== 'object') return []
      const { role, content } = message as { role?: unknown; content?: unknown }
      if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim() || content.length > 1000) {
        return []
      }
      return [{ role, content: content.trim() }]
    })
    if (messages.length !== body.messages.length || messages[messages.length - 1]?.role !== 'user') {
      return jsonResponse({ error: 'Chat messages are invalid or the latest message is missing.' }, 400)
    }
    try {
      const answer = await chat([
        {
          role: 'system',
          content: `You are ChargeMitra Help, a support assistant for an EV charger-sharing platform. Only answer questions about ChargeMitra charger discovery, booking requests and scheduling, provider approval, charging sessions, actual meter-based vs estimated time-based bills, and pay-at-station cash/UPI payments. Use this product information: users can find chargers on the map, compare per-kWh rates, and request a booking; providers accept or decline requests and choose a charging calculation method; owners confirm the method before charging; meter-based bills use meter readings, while time-based bills are estimates based on active charging time; current payment option is pay at station (cash/UPI). Do not invent refunds, fees, policies, integrations, booking guarantees, or account actions. If the question is outside ChargeMitra or the supplied product information, politely say you can only help with ChargeMitra and recommend contacting the platform team for account-specific support. Reply in the language and script used by the user. Be concise and clear.`,
        },
        ...messages,
      ], 450)
      return jsonResponse({ answer })
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'Support chat is temporarily unavailable.' }, 502)
    }
  }

  if (action !== 'parse-search') return jsonResponse({ error: 'Unknown Sarvam action.' }, 400)

  let body: { query?: unknown }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Expected a JSON search request.' }, 400)
  }
  if (typeof body.query !== 'string' || !body.query.trim() || body.query.length > 500) {
    return jsonResponse({ error: 'Enter a search phrase up to 500 characters.' }, 400)
  }

  try {
    const content = await chat([
      {
        role: 'system',
        content: `Extract only explicitly requested EV charger search filters from the user's text. Return exactly one JSON object with these keys: location (string or null), connector_type (string or null), minimum_power_kw (number or null), date (YYYY-MM-DD string or null), time (24-hour HH:mm string or null), maximum_price_per_unit (number or null, INR per kWh). Understand Kannada, Hindi and English. Convert explicit relative dates using today's date ${new Date().toISOString().slice(0, 10)}. Do not invent missing values, explanations, or markdown.`,
      },
      { role: 'user', content: body.query.trim() },
    ], 250)
    const jsonText = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    const filters = {
      location: typeof parsed.location === 'string' ? parsed.location : null,
      connector_type: typeof parsed.connector_type === 'string' ? parsed.connector_type : null,
      minimum_power_kw: typeof parsed.minimum_power_kw === 'number' && parsed.minimum_power_kw > 0 ? parsed.minimum_power_kw : null,
      date: typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
      time: typeof parsed.time === 'string' && /^\d{2}:\d{2}$/.test(parsed.time) ? parsed.time : null,
      maximum_price_per_unit: typeof parsed.maximum_price_per_unit === 'number' && parsed.maximum_price_per_unit >= 0
        ? parsed.maximum_price_per_unit
        : null,
    }
    return jsonResponse({ filters })
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Could not interpret the charger search.',
    }, 502)
  }
})
