import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { Stapper } from './Stapper'

afterEach(cleanup)

test('het getal tikt niet bij openen, wel na een wijziging (ook terug naar het begin)', () => {
  const toon = (waarde: number) => <Stapper naam="eters" icoon="x" waarde={waarde} wijzig={() => {}} />
  const { rerender } = render(toon(2))
  const getal = () => screen.getByLabelText('eters')
  expect(getal().classList.contains('tik')).toBe(false)
  rerender(toon(3))
  expect(getal().classList.contains('tik')).toBe(true)
  rerender(toon(2))
  expect(getal().classList.contains('tik')).toBe(true)
})
