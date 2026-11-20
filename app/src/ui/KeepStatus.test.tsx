import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { KeepStatusMelding } from './KeepStatus'
import { NepRepo } from './nepRepo'

afterEach(() => { cleanup(); vi.useRealTimers() })

test('status ok:false toont de mislukt-melding', () => {
  render(<KeepStatusMelding repo={new NepRepo()} vastgezetOp={null} begin={{ tijd: '2026-11-21T10:00:00Z', ok: false, melding: 'RuntimeError: login', weken: [] }} />)
  expect(screen.getByText('Keep bijwerken mislukt: RuntimeError: login')).toBeTruthy()
})

test('na vastzetten pollen tot de status nieuwer is', async () => {
  vi.useFakeTimers()
  const repo = new NepRepo()
  repo.status_ = { tijd: '2026-11-21T09:00:00Z', ok: true, melding: '', weken: [] }
  render(<KeepStatusMelding repo={repo} vastgezetOp="2026-11-21T10:00:00Z" begin={repo.status_} />)
  expect(screen.getByText('Keep bijwerken…')).toBeTruthy()
  repo.status_ = { tijd: '2026-11-21T10:00:40Z', ok: true, melding: '', weken: [] }
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(screen.getByText('Staat in Keep ✓')).toBeTruthy()
})
