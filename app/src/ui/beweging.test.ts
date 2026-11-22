import { expect, test } from 'vitest'
import { beslis } from './beweging'

test('beslis: ver genoeg of snel genoeg gesleept', () => {
  expect(beslis(101, 0)).toBe('erbij')
  expect(beslis(-101, 0)).toBe('nee')
  expect(beslis(30, 600)).toBe('erbij')
  expect(beslis(-30, -600)).toBe('nee')
  expect(beslis(50, 100)).toBeNull()
  expect(beslis(100, 0)).toBeNull()
})
