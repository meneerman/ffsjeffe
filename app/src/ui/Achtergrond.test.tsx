import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { Achtergrond } from './Achtergrond'

afterEach(cleanup)

test('de gloed volgt het scrollen via --scroll', () => {
  const { container } = render(<Achtergrond />)
  const el = container.querySelector('.achtergrond') as HTMLElement
  expect(el.style.getPropertyValue('--scroll')).toBe('0')
  Object.defineProperty(window, 'scrollY', { value: 320, configurable: true })
  act(() => {
    window.dispatchEvent(new Event('scroll'))
  })
  expect(el.style.getPropertyValue('--scroll')).toBe('320')
})
