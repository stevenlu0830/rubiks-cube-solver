import { CONTACTS, contactText, type Contact } from './contacts.ts'
import './info.css'

const PANEL_ID = 'info-panel'
const TITLE_ID = 'info-title'

/** What the app is built with, shown as tags. */
const TECH_STACK = [
  'React',
  'TypeScript',
  'Vite',
  'three.js',
  'React Three Fiber',
  'cubejs (Kociemba solver, 3x3)',
  'IDA* search (2x2)',
  'Web Workers',
  'Vitest',
  'Playwright',
]

/**
 * An ⓘ button that opens a small window in the middle of the screen about
 * the app and who made it. Like the settings menu, it's a browser "popover":
 * tapping outside it or pressing Escape closes it, with no code.
 */
export function InfoButton({
  contacts = CONTACTS,
}: {
  /** Who to get in touch with; tests can pass their own. */
  contacts?: readonly Contact[]
}) {
  return (
    <>
      <button
        type="button"
        className="header-button header-icon-button"
        popoverTarget={PANEL_ID}
        aria-label="About this app"
      >
        <InfoIcon />
      </button>
      <div
        id={PANEL_ID}
        className="info-panel"
        popover="auto"
        role="dialog"
        aria-labelledby={TITLE_ID}
      >
        <div className="info-panel-top">
          <h2 id={TITLE_ID}>About</h2>
          <button
            type="button"
            className="info-close"
            popoverTarget={PANEL_ID}
            popoverTargetAction="hide"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>
        <p>
          Solve a 2x2 or 3x3 Rubik's Cube: paint a 3D cube to match yours, or
          scan it with your camera. Then follow animated, step-by-step moves to
          solve it, even offline.
        </p>

        <h3>Tech stack</h3>
        <ul className="tech-stack">
          {TECH_STACK.map((tech) => (
            <li key={tech}>{tech}</li>
          ))}
        </ul>

        <h3>Contact</h3>
        <dl className="contacts">
          {contacts.map(({ name, url }) => (
            <div key={name} className="contact">
              <dt>{name}</dt>
              <dd>
                {url ? (
                  <a
                    href={url}
                    {...(url.startsWith('mailto:')
                      ? {}
                      : { target: '_blank', rel: 'noreferrer' })}
                  >
                    {contactText(url)}
                  </a>
                ) : (
                  <span className="contact-placeholder">[placeholder]</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  )
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="7.4" r="1.5" fill="currentColor" />
      <path
        d="M12 11.2v6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
