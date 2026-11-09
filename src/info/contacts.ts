export interface Contact {
  name: string
  /** https://… for a page, mailto:… for email, or '' while not filled in. */
  url: string
}

/**
 * How to get in touch, shown in the About window. Fill in a `url` to make it
 * a link; until then it shows "[placeholder]".
 */
export const CONTACTS: readonly Contact[] = [
  { name: 'Email', url: 'mailto:stevenlu0830@gmail.com' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/in/stevenlu0830' },
  { name: 'GitHub', url: 'https://github.com/stevenlu0830' },
  { name: 'Personal Profile', url: 'https://stevenlu0830.github.io' },
]

/** A link's address as people read it: no https://, mailto:, www. or end slash. */
export function contactText(url: string): string {
  return url
    .replace(/^(https?:\/\/|mailto:)/, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
}
