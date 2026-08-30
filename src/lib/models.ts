/**
 * The OpenRouter models offered in Settings.
 *
 * This list mirrors the Allowed Models on the deployment's own key. OpenRouter
 * rejects anything outside it, so offering a model that is not here produces a
 * request that can only fail — which is why the catalogue is not simply "good
 * models on OpenRouter" but "models this key is permitted to call".
 *
 * One catalogue rather than two hand-kept lists: the photo analyser needs a
 * model that accepts image input and the assistant does not, and keeping those
 * as separate arrays is how a text-only model ends up in the vision picker and
 * fails on every capture. `vision` decides which picker a model appears in, and
 * the same flag drives the warning shown when a slug is typed by hand.
 *
 * Three of the key's allowed models are absent on purpose. Llama Nemotron Embed
 * VL and Llama Nemotron Rerank VL are an embedding and a reranking model, and
 * Nemotron 3.5 Content Safety is a classifier: none of them answers a chat
 * completion, so neither NOVA nor photo analysis can use them.
 *
 * Notes describe modality and context rather than price — that moves too fast
 * to hard-code, and these are the free tiers anyway.
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
    slug: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    vision: true,
    note: 'text, image, video, audio · 300K',
  },
  {
    slug: 'minimax/minimax-m3:free',
    vision: true,
    note: 'text, image, video · 1M',
  },
  {
    slug: 'google/gemma-4-31b-it:free',
    vision: true,
    note: 'text, image, video · 262K',
  },
  {
    slug: 'google/gemma-4-26b-a4b-it:free',
    vision: true,
    note: 'text, image, video · tools · 256K',
  },
  {
    slug: 'thinkingmachines/inkling:free',
    vision: true,
    note: 'multimodal MoE · 1M',
  },
  {
    slug: 'thinkingmachines/inkling-small:free',
    vision: true,
    note: 'multimodal, smaller · 1M',
  },

  // ── text-only: tool calling and long context, no image input ──
  {
    slug: 'z-ai/glm-5.2:free',
    vision: false,
    note: 'text · tools · 1M',
  },
  {
    slug: 'nvidia/nemotron-3.5-lightning:free',
    vision: false,
    note: 'text · tools · 1M',
  },
  {
    slug: 'openrouter/owl-alpha',
    vision: false,
    note: 'text · agentic, tools · 1M',
  },
  {
    slug: 'nvidia/nemotron-3-super-120b-a12b:free',
    vision: false,
    note: 'text · 120B MoE',
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
