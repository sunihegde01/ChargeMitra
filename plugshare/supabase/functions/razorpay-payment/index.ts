import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type PaymentAction =
  | { action: 'create-order'; session_id: string }
  | {
    action: 'verify-payment'
    session_id: string
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
  }

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

async function makeHmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function makeSignature(orderId: string, paymentId: string, secret: string): Promise<string> {
  return makeHmac(`${orderId}|${paymentId}`, secret)
}

async function razorpayRequest(
  path: string,
  keyId: string,
  keySecret: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const result = await response.json() as Record<string, unknown>
  if (!response.ok) {
    const error = result.error
    const description = error && typeof error === 'object' && 'description' in error
      ? error.description
      : `Razorpay request failed (HTTP ${response.status}).`
    throw new Error(typeof description === 'string' ? description : 'Razorpay request failed.')
  }
  return result
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const razorpayKeyId = Deno.env.get('RAZORPAY_KEY_ID')
  const razorpayKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase function secrets are not configured.' }, 503)
  }

  if (request.headers.has('x-razorpay-signature')) {
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
    if (!webhookSecret) return jsonResponse({ error: 'Razorpay webhook secret is not configured.' }, 503)
    const rawBody = await request.text()
    const suppliedSignature = request.headers.get('x-razorpay-signature') ?? ''
    const expectedSignature = await makeHmac(rawBody, webhookSecret)
    if (!constantTimeEqual(expectedSignature, suppliedSignature.toLowerCase())) {
      return jsonResponse({ error: 'Razorpay webhook signature verification failed.' }, 401)
    }

    let payload: {
      event?: unknown
      payload?: { payment?: { entity?: Record<string, unknown> } }
    }
    try {
      payload = JSON.parse(rawBody) as typeof payload
    } catch {
      return jsonResponse({ error: 'Webhook body must be valid JSON.' }, 400)
    }
    if (payload.event !== 'payment.captured') return jsonResponse({ received: true })

    const payment = payload.payload?.payment?.entity
    if (
      !payment
      || typeof payment.id !== 'string'
      || typeof payment.order_id !== 'string'
      || payment.status !== 'captured'
      || payment.currency !== 'INR'
      || typeof payment.amount !== 'number'
    ) {
      return jsonResponse({ error: 'Captured payment details are incomplete.' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: session, error: sessionError } = await admin
      .from('charging_sessions')
      .select('id,final_amount,payment_status,razorpay_payment_id')
      .eq('razorpay_order_id', payment.order_id)
      .maybeSingle()
    if (sessionError) return jsonResponse({ error: 'Could not load the payment session.' }, 500)
    if (!session) return jsonResponse({ error: 'No charging session matches this Razorpay order.' }, 404)
    if (Math.round(Number(session.final_amount) * 100) !== payment.amount) {
      return jsonResponse({ error: 'Captured payment amount does not match the final bill.' }, 400)
    }
    if (session.payment_status === 'PAID') {
      return jsonResponse({
        received: true,
        status: 'PAID',
        duplicate_payment: session.razorpay_payment_id !== payment.id,
      })
    }
    const { error: updateError } = await admin
      .from('charging_sessions')
      .update({ payment_status: 'PAID', razorpay_payment_id: payment.id })
      .eq('id', session.id)
      .eq('razorpay_order_id', payment.order_id)
    if (updateError) return jsonResponse({ error: 'Could not record the captured payment.' }, 500)
    return jsonResponse({ received: true, status: 'PAID' })
  }

  if (!razorpayKeyId || !razorpayKeySecret) {
    return jsonResponse({ error: 'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to Supabase secrets.' }, 503)
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Sign in before paying this bill.' }, 401)
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return jsonResponse({ error: 'Your session expired. Sign in again.' }, 401)

  let action: PaymentAction
  try {
    action = await request.json() as PaymentAction
  } catch {
    return jsonResponse({ error: 'Request body must be valid JSON.' }, 400)
  }
  if (!action || typeof action.session_id !== 'string' || !action.session_id) {
    return jsonResponse({ error: 'A charging session ID is required.' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: session, error: sessionError } = await admin
    .from('charging_sessions')
    .select('id,booking_id,status,final_amount,payment_status,razorpay_order_id,razorpay_payment_id')
    .eq('id', action.session_id)
    .maybeSingle()
  if (sessionError) return jsonResponse({ error: 'Could not load the charging session.' }, 500)
  if (!session) return jsonResponse({ error: 'Charging session not found.' }, 404)

  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('owner_id')
    .eq('id', session.booking_id)
    .maybeSingle()
  if (bookingError) return jsonResponse({ error: 'Could not verify the bill owner.' }, 500)
  if (booking?.owner_id !== user.id) return jsonResponse({ error: 'Only the booking owner can pay this bill.' }, 403)
  if (session.status !== 'STOPPED' || session.final_amount === null) {
    return jsonResponse({ error: 'Payment is available after the charging session has ended and its final amount is calculated.' }, 409)
  }

  const amountPaise = Math.round(Number(session.final_amount) * 100)
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    return jsonResponse({ error: 'This bill amount is invalid for online payment.' }, 400)
  }

  if (action.action === 'create-order') {
    if (session.payment_status === 'PAID') {
      return jsonResponse({ error: 'This bill has already been paid.' }, 409)
    }

    let orderId = session.razorpay_order_id as string | null
    if (!orderId) {
      try {
        const order = await razorpayRequest('/orders', razorpayKeyId, razorpayKeySecret, {
          method: 'POST',
          body: JSON.stringify({
            amount: amountPaise,
            currency: 'INR',
            receipt: session.id,
            notes: { charging_session_id: session.id },
          }),
        })
        if (typeof order.id !== 'string' || order.amount !== amountPaise || order.currency !== 'INR') {
          return jsonResponse({ error: 'Razorpay returned an invalid order.' }, 502)
        }
        orderId = order.id
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : 'Could not create a Razorpay order.' }, 502)
      }

      const { data: savedOrder, error: updateError } = await admin
        .from('charging_sessions')
        .update({ payment_status: 'PENDING', razorpay_order_id: orderId, razorpay_payment_id: null })
        .eq('id', session.id)
        .neq('payment_status', 'PAID')
        .is('razorpay_order_id', null)
        .select('razorpay_order_id')
        .maybeSingle()
      if (updateError) return jsonResponse({ error: 'Could not save the payment order. Try again.' }, 500)
      if (savedOrder?.razorpay_order_id) {
        orderId = savedOrder.razorpay_order_id
      } else {
        const { data: currentSession, error: currentError } = await admin
          .from('charging_sessions')
          .select('payment_status,razorpay_order_id')
          .eq('id', session.id)
          .maybeSingle()
        if (currentError) return jsonResponse({ error: 'Could not confirm the payment order. Try again.' }, 500)
        if (currentSession?.payment_status === 'PAID') return jsonResponse({ error: 'This bill has already been paid.' }, 409)
        if (!currentSession?.razorpay_order_id) return jsonResponse({ error: 'Could not save the payment order. Try again.' }, 500)
        orderId = currentSession.razorpay_order_id
      }
    }

    return jsonResponse({
      key_id: razorpayKeyId,
      order_id: orderId,
      amount: amountPaise,
      currency: 'INR',
      name: 'ChargeMitra',
      description: 'Charging session bill',
    })
  }

  if (action.action === 'verify-payment') {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: suppliedSignature } = action
    if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof suppliedSignature !== 'string') {
      return jsonResponse({ error: 'Razorpay payment details are incomplete.' }, 400)
    }
    if (session.payment_status === 'PAID') {
      if (session.razorpay_payment_id !== paymentId) {
        return jsonResponse({ error: 'This bill was already paid with a different payment.' }, 409)
      }
      return jsonResponse({ status: 'PAID', message: 'Payment has already been verified.' })
    }
    if (session.payment_status !== 'PENDING' || session.razorpay_order_id !== orderId) {
      return jsonResponse({ error: 'This payment order does not match the session bill.' }, 409)
    }

    const expectedSignature = await makeSignature(orderId, paymentId, razorpayKeySecret)
    if (!constantTimeEqual(expectedSignature, suppliedSignature.toLowerCase())) {
      return jsonResponse({ error: 'Razorpay payment signature verification failed.' }, 400)
    }

    try {
      let payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`, razorpayKeyId, razorpayKeySecret)
      if (payment.order_id !== orderId || payment.amount !== amountPaise || payment.currency !== 'INR') {
        return jsonResponse({ error: 'The payment amount or order does not match this bill.' }, 400)
      }
      if (payment.status === 'authorized') {
        payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, razorpayKeyId, razorpayKeySecret, {
          method: 'POST',
          body: JSON.stringify({ amount: amountPaise, currency: 'INR' }),
        })
      }
      if (payment.status !== 'captured') {
        return jsonResponse({ error: 'Razorpay has not captured this payment yet.' }, 409)
      }

      const { error: updateError } = await admin
        .from('charging_sessions')
        .update({ payment_status: 'PAID', razorpay_payment_id: paymentId })
        .eq('id', session.id)
        .eq('razorpay_order_id', orderId)
      if (updateError) return jsonResponse({ error: 'Payment was captured, but its status could not be saved. Contact support with payment ID ' + paymentId + '.' }, 500)
      return jsonResponse({ status: 'PAID', payment_id: paymentId, message: 'Payment verified successfully.' })
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'Could not verify the Razorpay payment.' }, 502)
    }
  }

  return jsonResponse({ error: 'Unsupported payment action.' }, 400)
})
