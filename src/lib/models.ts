/**
 * The OpenRouter models offered in Settings.
 *
 * One catalogue rather than two hand-kept lists: the photo analyser needs a
 * model that accepts image input and the assistant does not, and keeping those
 * as separate arrays is how a text-only model ends up in the vision picker and
 * fails on every capture. Here `vision` decides which picker a model appears
 * in, and the same flag drives the warning shown when a slug is typed by hand.
 *
 * OpenRouter adds models constantly, so this is a starting point, not a limit —
 * both pickers accept any slug you type. Notes describe modality and context
 * rather than price, which moves too fast to hard-code.
 */
export interface ModelOption {
  slug: string
  /** accepts image input, so it can analyse a photograph */
  vision: boolean
  /** short note shown beside the slug */
  note: string
}

export const OPENROUTER_CATALOGUE: ModelOption[] = [
  // ── multimodal: usable for photos and for NOVA ──
  {
    slug: 'anthropic/claude-sonnet-5',
    vision: true,
    note: 'text, image, files · 1M',
  },
  {
    slug: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    vision: true,
    note: 'text, image, video, audio · 300K',
  },
  {
    slug: 'thinkingmachines/inkling',
    vision: true,
    note: 'multimodal MoE · 1M',
  },
  {
    slug: 'thinkingmachines/inkling-small',
    vision: true,
    note: 'multimodal, smaller · 1M',
  },
  {
    slug: 'xiaomi/mimo-v2.5',
    vision: true,
    note: 'omnimodal · 1M',
  },
  {
    slug: 'google/gemini-3.7-flash',
    vision: true,
    note: 'multimodal · 1M',
  },
  {
    slug: 'z-ai/glm-4.6v',
    vision: true,
    note: 'vision-language · 128K',
  },

  // ── text-only: tool calling and long context, no image input ──
  {
    slug: 'z-ai/glm-5.2',
    vision: false,
    note: 'text · tools · 1M',
  },
  {
    slug: 'nvidia/nemotron-3.5-lightning',
    vision: false,
    note: 'text · tools · 262K',
  },
  {
    slug: 'z-ai/glm-5.3',
    vision: false,
    note: 'text · tools · 1M',
  },
  {
    slug: 'z-ai/glm-4.7',
    vision: false,
    note: 'text · tools · 200K',
  },
]

/** Only these can be given a photograph. */
export const VISION_MODELS = OPENROUTER_CATALOGUE.filter((m) => m.vision)

/** Everything works for NOVA — it only ever sends text. */
export const CHAT_MODELS = OPENROUTER_CATALOGUE

/** True when the slug is one we know rejects images. */
export function isTextOnly(slug: string): boolean {
  const hit = OPENROUTER_CATALOGUE.find((m) => m.slug === slug.trim())
  return hit ? !hit.vision : false
}
