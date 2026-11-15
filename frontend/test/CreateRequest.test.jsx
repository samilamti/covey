import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/preact'
import { h } from 'preact'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'sv', changeLanguage: vi.fn() },
  }),
}))

vi.mock('lucide-preact', () => ({
  Send: () => h('span', null, 'Send'),
  MapPin: () => h('span', null, 'MapPin'),
  X: () => h('span', null, 'X'),
}))

vi.mock('../src/components/icons/WalkIcon', () => ({
  WalkIcon: () => h('span', null, 'WalkIcon'),
}))

vi.mock('../src/components/icons/WaitIcon', () => ({
  WaitIcon: () => h('span', null, 'WaitIcon'),
}))

vi.mock('../src/components/icons/FewPeopleIcon', () => ({
  FewPeopleIcon: () => h('span', null, 'FewPeopleIcon'),
}))

vi.mock('../src/components/icons/MorePeopleIcon', () => ({
  MorePeopleIcon: () => h('span', null, 'MorePeopleIcon'),
}))

vi.mock('../src/components/icons/EveryoneIcon', () => ({
  EveryoneIcon: () => h('span', null, 'EveryoneIcon'),
}))

// Spy on the global announcer — the inline role="alert" error paragraph
// stays, but Sami's a11y notes point out that an inline region mounted
// TOGETHER with its text is often skipped (VoiceOver especially). The
// reliable channel is the always-mounted announcer.
const announceSpy = vi.fn()
vi.mock('../src/context/AnnouncerContext', () => ({
  useAnnouncer: () => ({ announce: announceSpy }),
  AnnouncerProvider: ({ children }) => children,
}))

vi.mock('../src/services/requests', () => ({
  requestService: {
    create: vi.fn().mockResolvedValue({ request: { id: 'new-1', type: 'walk', status: 'open' } }),
  },
}))

const { requestService } = await import('../src/services/requests')
const { CreateRequest } = await import('../src/components/CreateRequest')

describe('CreateRequest', () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.clearAllMocks()
    announceSpy.mockClear()
    // Mock geolocation
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((success) =>
          success({ coords: { latitude: 59.33, longitude: 18.07 } })
        ),
      },
      configurable: true,
    })
  })

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it('renders the submit button', () => {
    const { getByText } = render(<CreateRequest />)
    expect(getByText('requests.send')).toBeTruthy()
  })

  it('renders walk and wait type buttons', () => {
    const { getByText } = render(<CreateRequest />)
    expect(getByText('requests.types.walk')).toBeTruthy()
    expect(getByText('requests.types.wait')).toBeTruthy()
  })

  it('has walk selected by default', () => {
    const { getByText } = render(<CreateRequest />)
    const walkBtn = getByText('requests.types.walk').closest('button')
    expect(walkBtn.className).toContain('bg-indigo-50')
  })

  it('clicking wait selects wait type', async () => {
    const { getByText } = render(<CreateRequest />)
    await fireEvent.click(getByText('requests.types.wait'))
    expect(getByText('requests.types.wait').closest('button').className).toContain('bg-indigo-50')
    expect(getByText('requests.types.walk').closest('button').className).not.toContain('bg-indigo-50')
  })

  it('renders all three eligibility tier options', () => {
    const { getByText } = render(<CreateRequest />)
    expect(getByText('requests.tiers.sameDemographics')).toBeTruthy()
    expect(getByText('requests.tiers.verifiedGuardians')).toBeTruthy()
    expect(getByText('requests.tiers.anyMember')).toBeTruthy()
  })

  it('exposes the type choice as a named radiogroup with the current pick', async () => {
    // The visual cue for the selected card is Tailwind's indigo background,
    // which assistive tech cannot see. Marking each card role="radio"
    // + aria-checked turns the group into something a screen reader can
    // announce as "Type of help, radio group, Walk, selected" and keeps
    // the semantics honest when the user swaps selection.
    const { getByRole, getAllByRole } = render(<CreateRequest />)
    const group = getByRole('radiogroup', { name: 'requests.type' })
    expect(group).toBeDefined()
    const radios = getAllByRole('radio').filter((el) => group.contains(el))
    expect(radios).toHaveLength(2)
    // Default is walk — exactly one radio checked.
    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
    // Switching selection updates aria-checked on both.
    await fireEvent.click(radios.find((r) => r.textContent.includes('requests.types.wait')))
    const checkedAfter = radios.filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checkedAfter).toHaveLength(1)
    expect(checkedAfter[0].textContent).toContain('requests.types.wait')
  })

  it('exposes the eligibility tier as a labelled radiogroup', async () => {
    // The group has a visible section label — tie it to the group via
    // aria-labelledby so a screen reader announces the group with its
    // real name ("Who can help you?") instead of an unnamed group.
    const { getByRole, getAllByRole } = render(<CreateRequest />)
    const group = getByRole('radiogroup', { name: 'requests.eligibility' })
    expect(group).toBeDefined()
    const radios = getAllByRole('radio').filter((el) => group.contains(el))
    expect(radios).toHaveLength(3)
    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checked).toHaveLength(1)
    expect(checked[0].textContent).toContain('requests.tiers.sameDemographics')
    // Picking another tier moves aria-checked.
    await fireEvent.click(radios.find((r) => r.textContent.includes('requests.tiers.anyMember')))
    const checkedAfter = radios.filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checkedAfter).toHaveLength(1)
    expect(checkedAfter[0].textContent).toContain('requests.tiers.anyMember')
  })

  it('moves the type choice with arrow keys and keeps one tab stop', async () => {
    // role="radio" tells a screen reader that arrow keys change the choice,
    // so they must; and only the checked radio may sit in the tab order.
    const { getByRole, getAllByRole } = render(<CreateRequest />)
    const group = getByRole('radiogroup', { name: 'requests.type' })
    const [walk, wait] = getAllByRole('radio').filter((el) => group.contains(el))
    expect([walk.tabIndex, wait.tabIndex]).toEqual([0, -1])

    walk.focus()
    await fireEvent.keyDown(walk, { key: 'ArrowRight' })
    expect(wait.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(wait)
    expect([walk.tabIndex, wait.tabIndex]).toEqual([-1, 0])

    // Wraps around at the end of the group.
    await fireEvent.keyDown(wait, { key: 'ArrowDown' })
    expect(walk.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(walk)
  })

  it('moves the tier choice with arrow keys in both directions', async () => {
    const { getByRole, getAllByRole } = render(<CreateRequest />)
    const group = getByRole('radiogroup', { name: 'requests.eligibility' })
    const radios = getAllByRole('radio').filter((el) => group.contains(el))
    radios[0].focus()
    await fireEvent.keyDown(radios[0], { key: 'ArrowUp' })
    expect(radios[2].getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(radios[2])
    await fireEvent.keyDown(radios[2], { key: 'ArrowDown' })
    expect(radios[0].getAttribute('aria-checked')).toBe('true')
    // Any other key leaves the choice alone.
    await fireEvent.keyDown(radios[0], { key: 'a' })
    expect(radios[0].getAttribute('aria-checked')).toBe('true')
  })

  it('swaps left and right in a right-to-left layout', async () => {
    document.dir = 'rtl'
    try {
      // Three options, so going the wrong way lands somewhere else.
      const { getByRole, getAllByRole } = render(<CreateRequest />)
      const group = getByRole('radiogroup', { name: 'requests.eligibility' })
      const radios = getAllByRole('radio').filter((el) => group.contains(el))
      await fireEvent.keyDown(radios[0], { key: 'ArrowLeft' })
      expect(radios[1].getAttribute('aria-checked')).toBe('true')
      await fireEvent.keyDown(radios[1], { key: 'ArrowRight' })
      expect(radios[0].getAttribute('aria-checked')).toBe('true')
    } finally {
      document.dir = ''
    }
  })

  it('wires the message textarea to its own label', () => {
    // A <label> sitting next to a <textarea> is only an accessible name
    // when `for=id` ties them together — a sibling label is ignored. Without
    // this, screen readers announce an unnamed textarea, so the user has
    // no idea what to type.
    const { getByLabelText } = render(<CreateRequest />)
    // The matched node is the textarea, not the label — if the association
    // is missing the query throws and the test fails.
    const textarea = getByLabelText(/requests\.message/)
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('gives each CreateRequest its own message id', () => {
    // Two instances must not share an id — the first label would then name
    // the second textarea and vice versa.
    const { container } = render(
      <div>
        <CreateRequest />
        <CreateRequest />
      </div>
    )
    const textareas = container.querySelectorAll('textarea')
    expect(textareas).toHaveLength(2)
    expect(textareas[0].id).toBeTruthy()
    expect(textareas[1].id).toBeTruthy()
    expect(textareas[0].id).not.toBe(textareas[1].id)
  })

  it('announces a failed submission as an assertive alert', async () => {
    // The only visual sign of a failed submission is a small red line at the
    // bottom of the form; without role="alert" a screen reader user taps
    // Send, nothing speaks, and they have no idea their request did not go
    // through. assertive because the user just took an action and is waiting
    // on its result — a polite announcement would stack behind other speech
    // and could be missed entirely. WCAG 4.1.3 Status Messages.
    requestService.create.mockRejectedValueOnce(new Error('requests.errorFull'))
    const { getByText, getByRole } = render(<CreateRequest />)

    await fireEvent.click(getByText('requests.send'))

    const alert = await waitFor(() => getByRole('alert'))
    expect(alert.textContent).toContain('requests.errorFull')
    expect(alert.getAttribute('aria-live')).toBe('assertive')
  })

  it('submitting calls requestService.create', async () => {
    const onCreated = vi.fn()
    const { getByText } = render(<CreateRequest onCreated={onCreated} />)

    await fireEvent.click(getByText('requests.send'))

    await waitFor(() => {
      expect(requestService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'walk',
          eligibilityTier: 'same_demographics',
        })
      )
    })
  })

  /* ── Geolocation states ── */

  it('shows "location attached" when geolocation succeeds', async () => {
    const { getByText } = render(<CreateRequest />)
    await waitFor(() => {
      expect(getByText('requests.locationAttached')).toBeTruthy()
    })
  })

  it('submits pickupLat/pickupLng from geolocation on success', async () => {
    const onCreated = vi.fn()
    const { getByText } = render(<CreateRequest onCreated={onCreated} />)
    // Wait for geo to resolve then submit
    await waitFor(() => expect(getByText('requests.locationAttached')).toBeTruthy())
    await fireEvent.click(getByText('requests.send'))
    await waitFor(() => {
      expect(requestService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          pickupLat: 59.33,
          pickupLng: 18.07,
        })
      )
    })
  })

  it('shows LocationBanner when geolocation is denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_success, error) =>
          error({ code: 1 })
        ),
      },
      configurable: true,
    })
    const { getByText } = render(<CreateRequest />)
    await waitFor(() => {
      expect(getByText('location.denied')).toBeTruthy()
    })
  })

  it('shows LocationBanner when geolocation is unavailable', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_success, error) =>
          error({ code: 2 })
        ),
      },
      configurable: true,
    })
    const { getByText } = render(<CreateRequest />)
    await waitFor(() => {
      expect(getByText('location.unavailable')).toBeTruthy()
    })
  })

  it('shows retry button in LocationBanner on geo error', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_success, error) =>
          error({ code: 1 })
        ),
      },
      configurable: true,
    })
    const { getByText } = render(<CreateRequest />)
    await waitFor(() => {
      expect(getByText('location.retry')).toBeTruthy()
    })
  })

  it('routes a failed submit through the global announcer as assertive', async () => {
    // The inline role="alert" paragraph is mounted together with its text,
    // which VoiceOver often skips. The announcer is the reliable channel.
    // Assertive — the user just tried to send; a quiet polite update would
    // leave them staring at a form that didn't submit with no idea why.
    requestService.create.mockRejectedValueOnce(new Error('no network'))
    const { getByText } = render(<CreateRequest />)
    await fireEvent.click(getByText('requests.send'))
    await waitFor(() => expect(announceSpy).toHaveBeenCalledWith('no network', { assertive: true }))
  })

  it('does not announce anything on a successful submit', async () => {
    // Success hands off to PostCreateMap, which announces its own banner.
    // Double-announcing here would re-read nothing useful.
    const { getByText } = render(<CreateRequest onCreated={vi.fn()} />)
    await fireEvent.click(getByText('requests.send'))
    await waitFor(() => expect(requestService.create).toHaveBeenCalled())
    expect(announceSpy).not.toHaveBeenCalled()
  })

  it('submits null coords when geolocation fails', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_success, error) =>
          error({ code: 1 })
        ),
      },
      configurable: true,
    })
    const onCreated = vi.fn()
    const { getByText } = render(<CreateRequest onCreated={onCreated} />)
    await waitFor(() => expect(getByText('location.denied')).toBeTruthy())
    await fireEvent.click(getByText('requests.send'))
    await waitFor(() => {
      expect(requestService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          pickupLat: null,
          pickupLng: null,
        })
      )
    })
  })
})
