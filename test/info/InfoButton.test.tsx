import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CONTACTS, contactText } from '../../src/info/contacts.ts'
import { InfoButton } from '../../src/info/InfoButton.tsx'

// The test browser can't open popovers, so the window stays hidden here, and
// hidden, it has no name from its title (the end-to-end tests open it for
// real): reach in regardless.
const panel = () => screen.getByRole('dialog', { hidden: true })

describe('the About window', () => {
  it('opens from the ⓘ button', () => {
    render(<InfoButton />)
    const button = screen.getByRole('button', { name: 'About this app' })
    expect(button).toHaveAttribute('popovertarget', panel().id)
    expect(
      within(panel()).getByRole('button', { name: 'Close', hidden: true }),
    ).toHaveAttribute('popovertargetaction', 'hide')
  })

  it('says what the app does and what it is built with', () => {
    render(<InfoButton />)
    expect(panel()).toHaveTextContent(/scan it with your camera/)
    const tech = within(panel()).getAllByRole('listitem', { hidden: true })
    expect(tech.map((item) => item.textContent)).toEqual(
      expect.arrayContaining(['React', 'TypeScript', 'Vite', 'three.js']),
    )
  })

  it('shows "[placeholder]" for each contact not filled in yet', () => {
    render(<InfoButton contacts={CONTACTS.map((c) => ({ ...c, url: '' }))} />)
    for (const name of ['GitHub', 'LinkedIn', 'Email', 'Personal Profile']) {
      const row = within(panel()).getByText(name).closest('.contact')!
      expect(row).toHaveTextContent(`${name}[placeholder]`)
    }
    expect(
      within(panel()).queryByRole('link', { hidden: true }),
    ).not.toBeInTheDocument()
  })

  it('links contacts once filled in: pages in a new tab, email in the mail app', () => {
    render(
      <InfoButton
        contacts={[
          { name: 'GitHub', url: 'https://github.com/someone' },
          { name: 'Email', url: 'mailto:someone@example.com' },
        ]}
      />,
    )
    const github = within(panel()).getByRole('link', {
      name: 'github.com/someone',
      hidden: true,
    })
    expect(github).toHaveAttribute('href', 'https://github.com/someone')
    expect(github).toHaveAttribute('target', '_blank')
    expect(github).toHaveAttribute('rel', 'noreferrer')

    const email = within(panel()).getByRole('link', {
      name: 'someone@example.com',
      hidden: true,
    })
    expect(email).toHaveAttribute('href', 'mailto:someone@example.com')
    expect(email).not.toHaveAttribute('target')
  })
})

describe('contactText', () => {
  it.each([
    ['https://github.com/someone', 'github.com/someone'],
    ['https://www.linkedin.com/in/someone/', 'linkedin.com/in/someone'],
    ['http://someone.dev', 'someone.dev'],
    ['mailto:someone@example.com', 'someone@example.com'],
  ])('shows %s as %s', (url, text) => {
    expect(contactText(url)).toBe(text)
  })
})
