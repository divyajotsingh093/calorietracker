import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/ProfileBits'
import { IconCamera, IconCheck, IconSparkle, IconTrash, IconUpload, IconX } from '@/components/icons'
import { Button, Card, Chip, Empty, Field, FieldGroup, Input, Select, Tag, cx, type as t } from '@/components/ui'
import { PORTION_SCALE, type PortionSize } from '@/data/foods'
import { longDate, todayISO } from '@/lib/date'
import { SLOTS, SLOT_META } from '@/lib/slots'
import { useStore } from '@/lib/store'
import { useServerKey } from '@/lib/serverKey'
import { analyzePhoto, compressImage, visionReady, type Analysis } from '@/lib/vision'
import type { MealSlot } from '@/types'

type Stage = 'capture' | 'review'

export function Snap({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { state, scoped, addPhoto, removePhoto } = useStore()
  const [stage, setStage] = useState<Stage>('capture')
  const [image, setImage] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const [portion, setPortion] = useState<PortionSize>('medium')
  const [slot, setSlot] = useState<MealSlot>(guessSlot())
  const [who, setWho] = useState<string>(() => scoped[0]?.id ?? '')
  const [date, setDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Analysis | null>(null)
  const [cameraOn, setCameraOn] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const server = useServerKey()
  const hasVision = visionReady(state.settings, server.configured)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  useEffect(() => stopCamera, [])

  const startCamera = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setCameraOn(true)
      // The <video> mounts with cameraOn, so attach on the next frame.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
      })
    } catch {
      setError(
        'Could not open the camera. Check the browser permission, or upload a photo from the gallery instead.',
      )
    }
  }

  const shoot = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    setImage(canvas.toDataURL('image/jpeg', 0.72))
    stopCamera()
    setStage('review')
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      setImage(await compressImage(file))
      setStage('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.')
    }
  }

  const analyse = async () => {
    if (!(hasVision && image) && !hint.trim()) {
      setError('The on-device estimate needs a hint — list what is on the plate.')
      return
    }
    setBusy(true)
    setError('')
    try {
      setResult(await analyzePhoto(image ?? '', state.settings, hint, portion, server.configured))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    stopCamera()
    setImage(null)
    setResult(null)
    setHint('')
    setError('')
    setStage('capture')
  }

  const log = () => {
    if (!result) return
    addPhoto({
      profileId: who || state.profiles[0].id,
      date,
      slot,
      image: image ?? undefined,
      label: result.label || 'Meal',
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      fibre: result.fibre,
      source: result.source,
      note: result.note,
    })
    reset()
  }

  const patchResult = (patch: Partial<Analysis>) =>
    setResult((r) => (r ? { ...r, ...patch, source: 'manual' } : r))

  const recent = state.photos
    .filter((p) => scoped.some((x) => x.id === p.profileId))
    .slice(0, 8)

  return (
    <div className="animate-rise space-y-5">
      <div>
        <h1 className={t.displayXl}>Snap & track</h1>
        <p className="mt-0.5 text-[0.8125rem] text-muted">
          Photograph a meal and log its calories.{' '}
          {hasVision ? (
            <>
              Reading photos with{' '}
              <button
                onClick={onOpenSettings}
                className="text-accent-ink underline underline-offset-2 cursor-pointer"
              >
                {state.settings.visionProvider === 'anthropic'
                  ? 'Claude'
                  : state.settings.openrouterModel || 'OpenRouter'}
              </button>
              .
            </>
          ) : (
            <>
              Running on the built-in food table —{' '}
              <button
                onClick={onOpenSettings}
                className="text-accent-ink underline underline-offset-2 cursor-pointer"
              >
                connect Anthropic or OpenRouter
              </button>{' '}
              for real photo analysis.
            </>
          )}
        </p>
      </div>

      {error && (
        <p className="rounded-2xl border border-danger/30 bg-danger-wash px-4 py-3 text-[13px] text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Capture panel */}
        <Card className="overflow-hidden">
          <div className="relative aspect-[4/3] w-full bg-panel">
            {cameraOn ? (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="size-full object-cover"
                />
                <div className="absolute inset-0 flex items-end justify-center gap-3 bg-gradient-to-t from-bg to-transparent p-5">
                  <Button variant="ghost" onClick={stopCamera}>
                    <IconX width={17} height={17} /> Cancel
                  </Button>
                  <button
                    onClick={shoot}
                    aria-label="Take photo"
                    className="grid size-16 place-items-center rounded-full border-4 border-invert bg-invert/25 backdrop-blur transition hover:bg-fill-strong active:scale-95 cursor-pointer"
                  >
                    <span className="size-11 rounded-full bg-invert" />
                  </button>
                </div>
              </>
            ) : image ? (
              <>
                <img src={image} alt="Captured meal" className="size-full object-cover" />
                <button
                  onClick={reset}
                  aria-label="Discard photo"
                  className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-ink/45 text-soft backdrop-blur transition hover:bg-bg cursor-pointer"
                >
                  <IconX width={18} height={18} />
                </button>
              </>
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-4 p-6 text-center">
                <span className="animate-float text-5xl">📸</span>
                <p className="max-w-xs text-[0.8125rem] text-muted">
                  Point the camera at your plate, or pick a photo you already took.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={startCamera}>
                    <IconCamera width={18} height={18} /> Open camera
                  </Button>
                  <Button variant="soft" onClick={() => fileRef.current?.click()}>
                    <IconUpload width={17} height={17} /> Upload photo
                  </Button>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />

          {stage === 'review' && (
            <div className="space-y-4 border-t border-line p-4 sm:p-5">
              <Field
                label={hasVision ? 'Anything worth mentioning?' : 'What is on the plate?'}
                hint={
                  hasVision
                    ? 'Optional. Portion hints like “large bowl” sharpen the estimate.'
                    : 'Comma-separated, e.g. “grilled chicken, rice, salad” or “150g salmon, broccoli”.'
                }
              >
                <Input
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder={
                    hasVision ? 'Cooked in olive oil, restaurant portion…' : 'chicken, rice, salad'
                  }
                  onKeyDown={(e) => e.key === 'Enter' && void analyse()}
                />
              </Field>

              {!hasVision && (
                <FieldGroup label="Portion size">
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(PORTION_SCALE) as PortionSize[]).map((p) => (
                      <Chip key={p} active={portion === p} onClick={() => setPortion(p)}>
                        {p}
                      </Chip>
                    ))}
                  </div>
                </FieldGroup>
              )}

              <Button
                variant="primary"
                className="w-full"
                disabled={busy}
                onClick={() => void analyse()}
              >
                <IconSparkle width={17} height={17} />
                {busy ? 'Analysing…' : result ? 'Re-analyse' : 'Estimate calories'}
              </Button>
            </div>
          )}
        </Card>

        {/* Result panel */}
        <Card className="p-4 sm:p-5">
          {result ? (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-lg font-semibold capitalize tracking-tight">
                  {result.label}
                </h2>
                <p className="mt-1 text-[0.8125rem] text-muted">{result.note}</p>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ['calories', 'kcal', 'text-accent-ink'],
                    ['protein', 'protein', 'text-protein'],
                    ['carbs', 'carbs', 'text-carbs'],
                    ['fat', 'fat', 'text-fat'],
                  ] as const
                ).map(([key, label, colour]) => (
                  <div key={key} className="rounded-2xl bg-fill p-2 text-center">
                    <input
                      type="number"
                      min={0}
                      value={result[key]}
                      onChange={(e) => patchResult({ [key]: Number(e.target.value) } as never)}
                      className={cx(
                        'w-full bg-transparent text-center font-display text-xl font-bold tabular-nums outline-none',
                        colour,
                      )}
                    />
                    <div className="text-[10px] uppercase tracking-[0.08em] text-faint">
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {result.items.length > 0 && (
                <div>
                  <h3 className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-muted">
                    Detected
                  </h3>
                  <ul className="space-y-1.5">
                    {result.items.map((i, idx) => (
                      <li
                        key={`${i.name}-${idx}`}
                        className="flex items-center gap-3 rounded-xl bg-fill px-3 py-2 text-sm"
                      >
                        <span className="flex-1 capitalize text-ink">{i.name}</span>
                        <span className="text-[12px] tabular-nums text-faint">{i.grams} g</span>
                        <span className="text-[13px] tabular-nums text-accent-ink">
                          {i.calories} kcal
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {state.profiles.length > 1 && (
                <FieldGroup label="Who ate it">
                  <div className="flex flex-wrap gap-2">
                    {state.profiles.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setWho(p.id)}
                        className={cx(
                          'flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[13px] transition cursor-pointer',
                          who === p.id
                            ? 'bg-invert text-on-accent font-medium'
                            : 'glass text-muted hover:text-ink',
                        )}
                      >
                        <Avatar profile={p} size="sm" />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </FieldGroup>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Meal">
                  <Select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
                    {SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {SLOT_META[s].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Date">
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" onClick={reset}>
                  Discard
                </Button>
                <Button variant="primary" className="flex-1" onClick={log}>
                  <IconCheck width={17} height={17} /> Log {result.calories} kcal to{' '}
                  {SLOT_META[slot].label.toLowerCase()}
                </Button>
              </div>
            </div>
          ) : (
            <Empty
              emoji="🥄"
              title="No estimate yet"
              hint={
                stage === 'capture'
                  ? 'Take or upload a photo to get started.'
                  : 'Describe the plate, then hit estimate.'
              }
            />
          )}
        </Card>
      </div>

      {/* History */}
      <Card className="p-4 sm:p-5">
        <h2 className={cx(t.micro, 'mb-3 text-faint')}>
          Recent snaps
        </h2>
        {recent.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {recent.map((p) => (
              <div key={p.id} className="group relative overflow-hidden rounded-2xl bg-fill">
                {p.image ? (
                  <img src={p.image} alt={p.label} className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[4/3] w-full place-items-center text-3xl opacity-40">
                    🍽️
                  </div>
                )}
                <button
                  aria-label="Delete"
                  onClick={() => removePhoto(p.id)}
                  className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-ink/45 text-soft opacity-0 backdrop-blur transition hover:text-danger group-hover:opacity-100 cursor-pointer"
                >
                  <IconTrash width={15} height={15} />
                </button>
                <div className="p-3">
                  <div className="truncate text-sm font-medium capitalize">{p.label}</div>
                  <div className="mt-1 flex items-center gap-2 text-[0.75rem] text-muted">
                    <span className="tabular-nums text-accent-ink">{p.calories} kcal</span>
                    <span>·</span>
                    <span>{SLOT_META[p.slot].label}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Tag>{state.profiles.find((x) => x.id === p.profileId)?.name ?? '—'}</Tag>
                    <Tag>{longDate(p.date)}</Tag>
                    <Tag>{p.source === 'ai' ? 'AI' : p.source === 'estimate' ? 'estimate' : 'manual'}</Tag>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-[0.8125rem] text-faint">
            Meals you snap show up here and count towards the day&apos;s total.
          </p>
        )}
      </Card>
    </div>
  )
}

function guessSlot(): MealSlot {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}
