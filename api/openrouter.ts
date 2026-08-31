/**
 * Server-side OpenRouter proxy, so the app works without anyone pasting a key.
 *
 * The key lives in the OPENROUTER_API_KEY environment variable on Vercel and is
 * never sent to the browser. It cannot be shipped any other way: this is a
 * static client-side app, so a key in the source or in a VITE_ variable ends up
 * inside the JavaScript bundle that every visitor downloads.
 *
 * The browser still talks to OpenRouter directly when someone has entered their
 * own key in Settings — that path costs the household nothing and needs no
 * server. This endpoint is only the fallback.
 *
 * Set OPENROUTER_API_KEY in Vercel → Settings → Environment Variables.
 * Optionally set NOVA_ACCESS_CODE to require a shared code, since anything that
 * can reach this URL can otherwise spend the key's credits.
 */
export const config = { runtime: 'edge' }

const UPSTREAM = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Models this endpoint will call. Mirrors src/lib/models.ts, which in turn
 * mirrors the Allowed Models on the key — OpenRouter rejects anything else, so
 * a slug outside this set can only produce a failed request.
 *
 * The list is also the abuse guard: an open passthrough lets a caller name the
 * most expensive model on the platform and bill it to whoever owns the key.
 */
const ALLOWED = new Set([
  // multimodal
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'minimax/minimax-m3:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'thinkingmachines/inkling:free',
  'thinkingmachines/inkling-small:free',
  // text
  'z-ai/glm-5.2:free',
  'nvidia/nemotron-3.5-lightning:free',
  'openrouter/owl-alpha',
  'nvidia/nemotron-3-super-120b-a12b:free',
])

const MAX_TOKENS = 4000
const MAX_BODY_BYTES = 256 * 1024

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

export default async function handler(req: Request): Promise<Response> {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  const code = process.env.NOVA_ACCESS_CODE?.trim()

  // GET is the probe: the app asks once whether a server key exists, and falls
  // back to its on-device engine when it does not.
  if (req.method === 'GET') {
    return json({ configured: Boolean(key), needsCode: Boolean(code) })
  }
  if (req.method !== 'POST') return json({ error: { message: 'Use POST' } }, 405)

  if (!key) {
    return json(
      { error: { message: 'No server key configured. Add your own in Settings.' } },
      503,
    )
  }
  if (code && req.headers.get('x-nova-access') !== code) {
    return json({ error: { message: 'Wrong or missing access code.' } }, 401)
  }

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) {
    return json({ error: { message: 'Request too large.' } }, 413)
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return json({ error: { message: 'Body must be JSON.' } }, 400)
  }

  const model = String(body.model ?? '')
  if (!ALLOWED.has(model)) {
    return json({ error: { message: `Model ${model || '(none)'} is not available here.` } }, 400)
  }

  // Forward only the fields the app actually sends, with the token budget
  // capped — never the caller's whole body.
  const forwarded: Record<string, unknown> = {
    model,
    messages: body.messages,
    max_tokens: Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS),
  }
  for (const k of [
    'tools',
    'tool_choice',
    'reasoning',
    'response_format',
    'frequency_penalty',
    'presence_penalty',
    'temperature',
  ] as const) {
    if (body[k] !== undefined) forwarded[k] = body[k]
  }

  const upstream = await fetch(UPSTREAM, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
      'HTTP-Referer': new URL(req.url).origin,
      'X-Title': 'Nourish meal tracker',
    },
    body: JSON.stringify(forwarded),
  })

  // Pass the rate-limit headers through. Free keys allow 50 requests a day, and
  // without these the browser cannot tell "out of allowance until midnight"
  // from "something broke" — which are very different things to a reader.
  const out = new Headers({
    'content-type': upstream.headers.get('content-type') ?? 'application/json',
    'cache-control': 'no-store',
  })
  for (const h of ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']) {
    const v = upstream.headers.get(h)
    if (v) out.set(h, v)
  }

  return new Response(upstream.body, { status: upstream.status, headers: out })
}
