import { FOOD_REF, PORTION_SCALE, type FoodRef, type PortionSize } from '@/data/foods'

export interface AnalysisItem {
  name: string
  grams: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface Analysis {
  items: AnalysisItem[]
  calories: number
  protein: number
  carbs: number
  fat: number
  label: string
  note: string
  source: 'ai' | 'estimate' | 'manual'
}

/** Downscale + JPEG-compress so photos survive localStorage's ~5 MB budget. */
export function compressImage(file: Blob, maxEdge = 720, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Canvas unavailable'))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

function score(needle: string, ref: FoodRef): number {
  const names = [ref.name, ...(ref.alias ?? [])]
  let best = 0
  for (const n of names) {
    if (n === needle) best = Math.max(best, 100)
    else if (needle.includes(n)) best = Math.max(best, 80 - (needle.length - n.length) * 0.4)
    else if (n.includes(needle) && needle.length >= 3) best = Math.max(best, 60)
  }
  return best
}

export function matchFood(term: string): FoodRef | null {
  const needle = term.trim().toLowerCase()
  if (!needle) return null
  let best: FoodRef | null = null
  let bestScore = 0
  for (const ref of FOOD_REF) {
    const s = score(needle, ref)
    if (s > bestScore) {
      bestScore = s
      best = ref
    }
  }
  return bestScore >= 55 ? best : null
}

export function searchFoods(term: string, limit = 8): FoodRef[] {
  const needle = term.trim().toLowerCase()
  if (!needle) return []
  return FOOD_REF.map((r) => ({ r, s: score(needle, r) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r)
}

function fromRef(ref: FoodRef, grams: number): AnalysisItem {
  const f = grams / 100
  return {
    name: ref.name,
    grams: Math.round(grams),
    calories: Math.round(ref.kcal * f),
    protein: Math.round(ref.protein * f * 10) / 10,
    carbs: Math.round(ref.carbs * f * 10) / 10,
    fat: Math.round(ref.fat * f * 10) / 10,
  }
}

function totals(items: AnalysisItem[]) {
  return items.reduce(
    (a, i) => ({
      calories: a.calories + i.calories,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

/**
 * Offline estimate: split what the user described into foods, match each
 * against the reference table and scale by the chosen portion size.
 */
export function estimateFromText(description: string, portion: PortionSize): Analysis {
  const parts = description
    .split(/,|\band\b|\+|\n/gi)
    .map((p) => p.trim())
    .filter(Boolean)

  const items: AnalysisItem[] = []
  const unmatched: string[] = []

  for (const part of parts) {
    // Pull an explicit gram weight if the user wrote one ("150g chicken").
    const gramMatch = part.match(/(\d+(?:\.\d+)?)\s*(g|gram|grams|ml)\b/i)
    const countMatch = part.match(/^(\d+(?:\.\d+)?)\s*(?:x\s*)?/)
    const cleaned = part.replace(/(\d+(?:\.\d+)?)\s*(g|gram|grams|ml|x)?\b/gi, ' ').trim()
    const ref = matchFood(cleaned || part)
    if (!ref) {
      unmatched.push(part)
      continue
    }
    let grams: number
    if (gramMatch) grams = Number(gramMatch[1])
    else if (countMatch && Number(countMatch[1]) > 0 && Number(countMatch[1]) <= 12)
      grams = ref.serving * Number(countMatch[1]) * PORTION_SCALE[portion]
    else grams = ref.serving * PORTION_SCALE[portion]
    items.push(fromRef(ref, grams))
  }

  const t = totals(items)
  const note = items.length
    ? unmatched.length
      ? `Estimated from the reference table. Not recognised: ${unmatched.join(', ')}.`
      : 'Estimated from the on-device reference table — adjust anything that looks off.'
    : 'Nothing matched the food table. Type the components (e.g. “chicken, rice, salad”) or enter the calories by hand.'

  return {
    items,
    ...t,
    calories: Math.round(t.calories),
    protein: Math.round(t.protein),
    carbs: Math.round(t.carbs),
    fat: Math.round(t.fat),
    label: items.length ? items.map((i) => i.name).join(', ') : description.trim() || 'Meal',
    note,
    source: 'estimate',
  }
}

const SYSTEM_PROMPT = `You are a nutrition estimator. Look at the photo of food and reply with ONLY a JSON object, no prose and no markdown fence:
{"label":"short dish name","items":[{"name":"food","grams":000,"calories":000,"protein":0,"carbs":0,"fat":0}],"note":"one short sentence on assumptions and confidence"}
Estimate portion sizes from visual cues (plate size, utensils, hands). Totals are summed from items, so make the items add up to the whole meal.`

interface AnthropicResponse {
  content?: { type: string; text?: string }[]
  error?: { message?: string }
}

/**
 * Vision analysis via the Anthropic API, using a key the user pastes into
 * Settings. The key is kept in this browser's localStorage and is sent only
 * to api.anthropic.com.
 */
export async function analyzeWithClaude(
  dataUrl: string,
  apiKey: string,
  hint: string,
): Promise<Analysis> {
  const [meta, base64] = dataUrl.split(',')
  const mediaType = /data:(.*?);/.exec(meta)?.[1] ?? 'image/jpeg'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            {
              type: 'text',
              text: hint.trim()
                ? `Extra context from the person eating it: ${hint.trim()}`
                : 'Estimate the calories and macros in this meal.',
            },
          ],
        },
      ],
    }),
  })

  const json = (await res.json()) as AnthropicResponse
  if (!res.ok) throw new Error(json.error?.message ?? `Request failed (${res.status})`)

  const text = json.content?.find((c) => c.type === 'text')?.text ?? ''
  const jsonText = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
  let parsed: { label?: string; items?: AnalysisItem[]; note?: string }
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('The model replied in an unexpected format. Try again.')
  }

  const items = (parsed.items ?? []).map((i) => ({
    name: String(i.name ?? 'item'),
    grams: Math.round(Number(i.grams) || 0),
    calories: Math.round(Number(i.calories) || 0),
    protein: Math.round((Number(i.protein) || 0) * 10) / 10,
    carbs: Math.round((Number(i.carbs) || 0) * 10) / 10,
    fat: Math.round((Number(i.fat) || 0) * 10) / 10,
  }))
  const t = totals(items)

  return {
    items,
    calories: Math.round(t.calories),
    protein: Math.round(t.protein),
    carbs: Math.round(t.carbs),
    fat: Math.round(t.fat),
    label: parsed.label ?? 'Meal',
    note: parsed.note ?? 'Analysed from the photo.',
    source: 'ai',
  }
}
