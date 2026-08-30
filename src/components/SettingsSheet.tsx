import { useRef, useState } from 'react'
import { IconTrash, IconUpload } from '@/components/icons'
import { Avatar } from '@/components/ProfileBits'
import { Button, Chip, Field, FieldGroup, Input, Modal, Select, cx } from '@/components/ui'
import { dietLabel } from '@/lib/profiles'
import { useStore } from '@/lib/store'
import { DEFAULT_OPENROUTER_MODEL, OPENROUTER_MODELS } from '@/lib/vision'
import type { VisionProvider } from '@/types'

const PROVIDERS: { id: VisionProvider; label: string; blurb: string }[] = [
  {
    id: 'offline',
    label: 'On-device',
    blurb:
      'No key, no network call. You describe the plate and a bundled table of ~65 common foods does the arithmetic.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    blurb: 'Photos go straight to api.anthropic.com and Claude reads the plate.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    blurb:
      'Photos go to openrouter.ai, which routes them to whichever vision model you pick below.',
  },
]

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, setSettings, updateProfile, resetAll, importState } = useStore()
  const { settings } = state
  const [note, setNote] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nourish-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings" subtitle="Profiles, goals and keys — all stored in this browser.">
      <div className="space-y-5">
        {state.profiles.map((profile) => {
          const kcalFromMacros =
            profile.proteinGoal * 4 + profile.carbGoal * 4 + profile.fatGoal * 9
          const mismatch = Math.abs(kcalFromMacros - profile.calorieGoal) > profile.calorieGoal * 0.1
          return (
            <div key={profile.id} className="space-y-3 rounded-2xl bg-white/5 p-3.5">
              <div className="flex items-center gap-2.5">
                <Avatar profile={profile} />
                <div className="flex-1">
                  <Input
                    value={profile.name}
                    onChange={(e) => updateProfile(profile.id, { name: e.target.value })}
                    className="!bg-transparent !border-transparent !px-0 font-display font-semibold"
                  />
                  <p className="text-[12px] text-white/40">{dietLabel(profile.diet)}</p>
                </div>
                <button
                  onClick={() =>
                    updateProfile(profile.id, {
                      diet: profile.diet === 'vegetarian' ? 'omnivore' : 'vegetarian',
                    })
                  }
                  className="rounded-full bg-white/8 px-3 py-1.5 text-[12px] text-white/60 transition hover:bg-white/15 hover:text-white cursor-pointer"
                >
                  Switch diet
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ['calorieGoal', 'Calories', 'kcal'],
                    ['proteinGoal', 'Protein', 'g'],
                    ['carbGoal', 'Carbs', 'g'],
                    ['fatGoal', 'Fat', 'g'],
                  ] as const
                ).map(([key, label, unit]) => (
                  <Field key={key} label={`${label} (${unit})`}>
                    <Input
                      type="number"
                      min={0}
                      value={profile[key]}
                      onChange={(e) =>
                        updateProfile(profile.id, { [key]: Math.max(0, Number(e.target.value)) })
                      }
                    />
                  </Field>
                ))}
              </div>

              <p
                className={cx(
                  'text-[12px]',
                  profile.calorieGoal >= 2000
                    ? 'text-orange-200'
                    : mismatch
                      ? 'text-amber-200'
                      : 'text-white/40',
                )}
              >
                {profile.calorieGoal >= 2000
                  ? `${profile.calorieGoal} kcal is at or above the 2000 ceiling.`
                  : mismatch
                    ? `Macros add up to ${Math.round(kcalFromMacros)} kcal — off the ${profile.calorieGoal} goal.`
                    : `Macros add up to ${Math.round(kcalFromMacros)} kcal. Nicely balanced.`}
              </p>
            </div>
          )
        })}

        <div className="space-y-3 border-t border-white/10 pt-4">
          <FieldGroup label="Photo analysis">
            <div className="flex flex-wrap gap-2">
              {PROVIDERS.map((p) => (
                <Chip
                  key={p.id}
                  active={settings.visionProvider === p.id}
                  onClick={() => setSettings({ visionProvider: p.id })}
                >
                  {p.label}
                </Chip>
              ))}
            </div>
          </FieldGroup>
          <p className="text-[13px] text-white/45">
            {PROVIDERS.find((p) => p.id === settings.visionProvider)?.blurb}
          </p>

          {settings.visionProvider === 'anthropic' && (
            <Field
              label="Anthropic API key"
              hint="Kept in this browser only. Get one at console.anthropic.com."
            >
              <Input
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({ apiKey: e.target.value })}
                placeholder="sk-ant-…"
                autoComplete="off"
              />
            </Field>
          )}

          {settings.visionProvider === 'openrouter' && (
            <>
              <Field
                label="OpenRouter API key"
                hint="Kept in this browser only. Get one at openrouter.ai/keys."
              >
                <Input
                  type="password"
                  value={settings.openrouterKey}
                  onChange={(e) => setSettings({ openrouterKey: e.target.value })}
                  placeholder="sk-or-v1-…"
                  autoComplete="off"
                />
              </Field>
              <Field label="Model" hint="Any vision-capable model slug on OpenRouter works.">
                <Select
                  value={
                    OPENROUTER_MODELS.includes(settings.openrouterModel)
                      ? settings.openrouterModel
                      : 'custom'
                  }
                  onChange={(e) =>
                    setSettings({
                      openrouterModel:
                        e.target.value === 'custom' ? '' : e.target.value,
                    })
                  }
                >
                  {OPENROUTER_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="custom">Something else…</option>
                </Select>
              </Field>
              {!OPENROUTER_MODELS.includes(settings.openrouterModel) && (
                <Input
                  value={settings.openrouterModel}
                  onChange={(e) => setSettings({ openrouterModel: e.target.value })}
                  placeholder={DEFAULT_OPENROUTER_MODEL}
                  autoComplete="off"
                />
              )}
            </>
          )}
        </div>

        <div className="space-y-2 border-t border-white/10 pt-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="soft" onClick={exportJson}>
              Export backup
            </Button>
            <Button size="sm" variant="soft" onClick={() => fileRef.current?.click()}>
              <IconUpload width={15} height={15} /> Import
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                if (confirmReset) {
                  resetAll()
                  setConfirmReset(false)
                  setNote('Everything reset to the starter plan.')
                } else {
                  setConfirmReset(true)
                  setNote('Tap again to wipe your plan, logs and custom dishes.')
                }
              }}
            >
              <IconTrash width={15} height={15} />
              {confirmReset ? 'Tap again to confirm' : 'Reset everything'}
            </Button>
          </div>
          {note && <p className="text-[13px] text-white/50">{note}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              const ok = importState(await file.text())
              setNote(ok ? 'Backup restored.' : 'That file did not look like a Nourish backup.')
            }}
          />
        </div>
      </div>
    </Modal>
  )
}
