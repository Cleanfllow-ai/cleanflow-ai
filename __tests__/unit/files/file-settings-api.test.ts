/**
 * Unit tests for modules/files/api/file-settings-api.ts
 * Covers: getSettingsPresets, getSettingsPreset, createSettingsPreset,
 *         updateSettingsPreset, deleteSettingsPreset, getAuth
 */

jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

jest.mock('@/modules/files/api/file-upload-api', () => ({
  makeRequest: jest.fn(),
}))

import {
  getSettingsPresets,
  getSettingsPreset,
  createSettingsPreset,
  updateSettingsPreset,
  deleteSettingsPreset,
  getAuth,
} from '@/modules/files/api/file-settings-api'
import { makeRequest } from '@/modules/files/api/file-upload-api'

const mockMakeRequest = makeRequest as jest.Mock

afterEach(() => {
  mockMakeRequest.mockReset()
})

// ─── getAuth ─────────────────────────────────────────────────────────────────
describe('getAuth', () => {
  it('returns idToken from localStorage', async () => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue(JSON.stringify({ idToken: 'id-tok-123', accessToken: 'acc-tok' })),
      },
      writable: true,
    })

    const token = await getAuth()
    expect(token).toBe('id-tok-123')
  })

  it('falls back to accessToken when idToken is missing', async () => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue(JSON.stringify({ accessToken: 'acc-tok' })),
      },
      writable: true,
    })

    const token = await getAuth()
    expect(token).toBe('acc-tok')
  })

  it('returns empty string when localStorage is empty', async () => {
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: jest.fn().mockReturnValue(null) },
      writable: true,
    })

    // Also clear any global fallback
    delete (window as any).__AUTH_TOKEN__

    const token = await getAuth()
    expect(token).toBe('')
  })

  it('returns empty string on malformed JSON', async () => {
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: jest.fn().mockReturnValue('not-json') },
      writable: true,
    })

    delete (window as any).__AUTH_TOKEN__

    const token = await getAuth()
    expect(token).toBe('')
  })

  it('falls back to __AUTH_TOKEN__ global', async () => {
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: jest.fn().mockReturnValue(null) },
      writable: true,
    })
    ;(window as any).__AUTH_TOKEN__ = 'global-tok'

    const token = await getAuth()
    expect(token).toBe('global-tok')

    delete (window as any).__AUTH_TOKEN__
  })
})

// ─── getSettingsPresets ──────────────────────────────────────────────────────
describe('getSettingsPresets', () => {
  it('calls makeRequest with /settings endpoint', async () => {
    mockMakeRequest.mockResolvedValue({ presets: [{ preset_id: 'p1', preset_name: 'Default' }], count: 1 })

    const result = await getSettingsPresets('tok')
    expect(mockMakeRequest).toHaveBeenCalledWith('/settings', 'tok', { method: 'GET' })
    expect(result.presets).toHaveLength(1)
    expect(result.count).toBe(1)
  })

  it('falls back to getAuth when no token provided', async () => {
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: jest.fn().mockReturnValue(JSON.stringify({ idToken: 'auto-tok' })) },
      writable: true,
    })
    mockMakeRequest.mockResolvedValue({ presets: [], count: 0 })

    await getSettingsPresets()
    expect(mockMakeRequest).toHaveBeenCalledWith('/settings', 'auto-tok', { method: 'GET' })
  })
})

// ─── getSettingsPreset ───────────────────────────────────────────────────────
describe('getSettingsPreset', () => {
  it('calls makeRequest with /settings/{id}', async () => {
    mockMakeRequest.mockResolvedValue({ preset_id: 'p1', preset_name: 'Custom', config: {} })

    const result = await getSettingsPreset('p1', 'tok')
    expect(mockMakeRequest).toHaveBeenCalledWith('/settings/p1', 'tok', { method: 'GET' })
    expect(result.preset_id).toBe('p1')
  })
})

// ─── createSettingsPreset ────────────────────────────────────────────────────
describe('createSettingsPreset', () => {
  it('sends POST with preset data', async () => {
    mockMakeRequest.mockResolvedValue({ preset_id: 'p-new', message: 'Created' })

    const result = await createSettingsPreset(
      { preset_name: 'My Preset', config: { rules: [] }, is_default: false },
      'tok'
    )
    expect(mockMakeRequest).toHaveBeenCalledWith(
      '/settings',
      'tok',
      {
        method: 'POST',
        body: JSON.stringify({ preset_name: 'My Preset', config: { rules: [] }, is_default: false }),
      }
    )
    expect(result.preset_id).toBe('p-new')
  })
})

// ─── updateSettingsPreset ────────────────────────────────────────────────────
describe('updateSettingsPreset', () => {
  it('sends PUT with updates to /settings/{id}', async () => {
    mockMakeRequest.mockResolvedValue({ message: 'Updated' })

    const result = await updateSettingsPreset('p1', { preset_name: 'Renamed' }, 'tok')
    expect(mockMakeRequest).toHaveBeenCalledWith(
      '/settings/p1',
      'tok',
      {
        method: 'PUT',
        body: JSON.stringify({ preset_name: 'Renamed' }),
      }
    )
    expect(result.message).toBe('Updated')
  })

  it('can update config only', async () => {
    mockMakeRequest.mockResolvedValue({ message: 'Updated' })

    await updateSettingsPreset('p1', { config: { threshold: 0.8 } }, 'tok')
    const body = JSON.parse(mockMakeRequest.mock.calls[0][2].body)
    expect(body.config).toEqual({ threshold: 0.8 })
    expect(body.preset_name).toBeUndefined()
  })
})

// ─── deleteSettingsPreset ────────────────────────────────────────────────────
describe('deleteSettingsPreset', () => {
  it('sends DELETE to /settings/{id}', async () => {
    mockMakeRequest.mockResolvedValue({ message: 'Deleted' })

    const result = await deleteSettingsPreset('p1', 'tok')
    expect(mockMakeRequest).toHaveBeenCalledWith('/settings/p1', 'tok', { method: 'DELETE' })
    expect(result.message).toBe('Deleted')
  })
})
