import { useRef, useState } from 'react'
import { IconTrash, IconUpload } from '@/components/icons'
import { Button, Field, Input, Modal, cx } from '@/components/ui'
import { useStore } from '@/lib/store'

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, setSettings, resetAll, importState } = useStore()
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

  const kcalFromMacros =
    settings.proteinGoal * 4 + settings.carbGoal * 4 + settings.fatGoal * 9
  const mismatch = Math.abs(kcalFromMacros - settings.calorieGoal) > settings.calorieGoal * 0.08

  return (
    <Modal open={open} onClose={onClose} title="Settings" subtitle="Everything is stored in this browser.">
      <div className="space-y-5">
        <Field label="Your name" hint="Only used to say hello.">
          <Input
            value={settings.name}
            onChange={(e) => setSettings({ name: e.target.value })}
            placeholder="Alex"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['calorieGoal', 'Daily calories', 'kcal'],
              ['proteinGoal', 'Protein', 'g'],
              ['carbGoal', 'Carbs', 'g'],
              ['fatGoal', 'Fat', 'g'],
            ] as const
          ).map(([key, label, unit]) => (
            <Field key={key} label={`${label} (${unit})`}>
              <Input
                type="number"
                min={0}
                value={settings[key]}
                onChange={(e) => setSettings({ [key]: Math.max(0, Number(e.target.value)) })}
              />
            </Field>
          ))}
        </div>

        <p
          className={cx(
            'rounded-2xl px-3.5 py-2.5 text-[13px]',
            mismatch
              ? 'border border-amber-300/25 bg-amber-300/10 text-amber-100'
              : 'bg-white/5 text-white/45',
          )}
        >
          Your macro targets add up to {Math.round(kcalFromMacros)} kcal
          {mismatch ? ` — that is off your ${settings.calorieGoal} kcal goal.` : '. Nicely balanced.'}
        </p>

        <Field
          label="Anthropic API key"
          hint="Optional. Stored only in this browser and sent only to api.anthropic.com, so photos get analysed by Claude instead of the built-in food table."
        >
          <Input
            type="password"
            value={settings.apiKey}
            onChange={(e) => setSettings({ apiKey: e.target.value })}
            placeholder="sk-ant-…"
            autoComplete="off"
          />
        </Field>

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
