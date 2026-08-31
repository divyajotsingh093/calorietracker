import { PROXY_URL, readAccessCode } from '@/lib/serverKey'

/**
 * One place where every OpenRouter request goes out, so failures are legible.
 *
 * Free endpoints are the constraint that shapes all of this. A free OpenRouter
 * account gets 50 requests a day (1,000 once the account holds $10 of credit),
 * 20 a minute, and a request that fails still spends one of them. So this layer
 * reports the real status and message rather than a generic failure, remembers
 * the quota headers so the app can say how many are left, and does not retry a
 * rate-limited request — a retry there spends another of the same allowance to
 * get the same answer.
 */

export interface Quota {
  /** requests left in the current window, when the response said */
  remaining: number | null
  /** when the window resets, epoch ms */
  reset: number | null
  at: number
}

let lastQuota: Quota | null = null

/** The most recent quota reading, or null before any request. */
export function quota(): Quota | null {
  return lastQuota
}

function readQuota(headers: Headers): void {
  const remaining = headers.get('x-ratelimit-remaining')
  const reset = headers.get('x-ratelimit-reset')
  if (remaining == null && reset == null) return
  const r = Number(reset)
  lastQuota = {
    remaining: remaining == null ? null : Number(remaining),
    // OpenRouter sends epoch milliseconds; treat a small number as seconds
    reset: Number.isFinite(r) ? (r > 1e11 ? r : r * 1000) : null,
    at: Date.now(),
  }
}

export class OpenRouterError extends Error {
  readonly status: number
  /** true when the daily or per-minute allowance is spent */
  readonly rateLimited: boolean
  /** true when this model has no endpoint that can serve the request */
  readonly unsupported: boolean

  constructor(status: number, message: string) {
    super(message)
    this.name = 'OpenRouterError'
    this.status = status
    this.rateLimited = status === 429
    this.unsupported =
      status === 404 ||
      /no endpoints|not support|no allowed providers/i.test(message)
  }
}

function friendly(status: number, message: string): string {
  if (status === 429) {
    const q = lastQuota
    const when =
      q?.reset && q.reset > Date.now()
        ? ` Resets ${new Date(q.reset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
        : ''
    return `Out of OpenRouter requests for now — free keys get 50 a day and 20 a minute.${when} Adding $10 of credit raises it to 1,000 a day.`
  }
  if (status === 401 || status === 403) {
    return `OpenRouter rejected the key (${status}). Check it in Settings, or that the deployment's key is still valid.`
  }
  if (status === 402) return 'That model needs credit on the OpenRouter account.'
  if (status >= 500) return `OpenRouter or the model provider is down (${status}). ${message}`
  return message || `Request failed (${status})`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface CallOptions {
  /** empty means go through this deployment's proxy instead */
  apiKey: string
  body: Record<string, unknown>
}

/**
 * POST a chat completion and return the parsed body.
 *
 * Retries once on a 5xx, because a provider blip is worth a second try. Never
 * retries a 429: the allowance is already spent and a retry spends another.
 */
export async function callOpenRouter(opts: CallOptions): Promise<Record<string, unknown>> {
  const viaProxy = !opts.apiKey.trim()
  const url = viaProxy ? PROXY_URL : 'https://openrouter.ai/api/v1/chat/completions'
  const headers: Record<string, string> = viaProxy
    ? { 'content-type': 'application/json', 'x-nova-access': readAccessCode() }
    : {
        'content-type': 'application/json',
        authorization: `Bearer ${opts.apiKey.trim()}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Nourish meal tracker',
      }

  let last: OpenRouterError | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(opts.body) })
    readQuota(res.headers)

    let json: Record<string, unknown> = {}
    try {
      json = (await res.json()) as Record<string, unknown>
    } catch {
      json = {}
    }
    const err = json.error as { message?: string } | undefined

    if (res.ok && !err?.message) return json

    const status = res.ok ? 502 : res.status
    last = new OpenRouterError(status, friendly(status, err?.message ?? ''))
    // a provider blip is worth one more try; a spent allowance is not
    if (status < 500 || attempt === 1) throw last
    await sleep(700)
  }
  throw last ?? new OpenRouterError(500, 'Request failed')
}

export interface Diagnosis {
  ok: boolean
  detail: string
}

/**
 * One real request, so a failure names itself.
 *
 * "OpenRouter issues" covers a spent daily allowance, a rejected key, a model
 * the key is not allowed to call and a provider outage, and they need different
 * answers. This asks the configured model to reply with one word and reports
 * exactly what came back, including how much of the allowance is left.
 */
export async function testConnection(apiKey: string, model: string): Promise<Diagnosis> {
  try {
    await callOpenRouter({
      apiKey,
      body: {
        model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
      },
    })
    const q = quota()
    const left =
      q?.remaining != null ? ` ${q.remaining} requests left on this key.` : ''
    return { ok: true, detail: `${model} answered.${left}` }
  } catch (e) {
    if (e instanceof OpenRouterError) {
      return { ok: false, detail: `${e.message} (HTTP ${e.status})` }
    }
    return {
      ok: false,
      detail:
        e instanceof Error
          ? e.message
          : 'The request did not complete. Check the network and try again.',
    }
  }
}
