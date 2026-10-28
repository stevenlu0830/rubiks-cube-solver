import { canVibrate } from '../device/haptics.ts'
import type { Settings } from './settings.ts'
import './settings.css'

const PANEL_ID = 'settings-panel'

interface SettingsMenuProps {
  settings: Settings
  onChange: (settings: Settings) => void
}

/**
 * A gear button that opens a small panel of switches. It's a browser
 * "popover": tapping outside it or pressing Escape closes it, with no code.
 */
export function SettingsMenu({ settings, onChange }: SettingsMenuProps) {
  return (
    <>
      <button
        type="button"
        className="header-button settings-button"
        popoverTarget={PANEL_ID}
        aria-label="Settings"
      >
        <GearIcon />
      </button>
      <div
        id={PANEL_ID}
        className="settings-panel"
        popover="auto"
        role="group"
        aria-label="Settings"
      >
        <label className="setting">
          <input
            type="checkbox"
            checked={settings.letters}
            onChange={(event) =>
              onChange({ ...settings, letters: event.target.checked })
            }
          />
          <span>
            Letters on stickers
            <small>W, Y, G, B, R, O: for telling colours apart</small>
          </span>
        </label>
        {canVibrate() && (
          <label className="setting">
            <input
              type="checkbox"
              checked={settings.haptics}
              onChange={(event) =>
                onChange({ ...settings, haptics: event.target.checked })
              }
            />
            <span>
              Vibration
              <small>A buzz when you paint, and when it's solved</small>
            </span>
          </label>
        )}
      </div>
    </>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <g fill="none" stroke="currentColor">
        {/* Eight teeth: a thick ring drawn dashed. */}
        <circle
          cx="12"
          cy="12"
          r="8.6"
          strokeWidth="3.2"
          strokeDasharray="3.38"
        />
        <circle cx="12" cy="12" r="6.2" strokeWidth="2.6" />
        <circle cx="12" cy="12" r="2" strokeWidth="2" />
      </g>
    </svg>
  )
}
