/**
 * Unit tests: mapSettingsErrorToToast — 6 DQ-preset failure modes
 *
 * F1  SETTINGS_RULE_SPEC_INVALID   422 → "Rule definition is invalid."    [Edit]
 * F2  SETTINGS_PRESET_NAME_TAKEN   409 → "Preset name already used."      [Rename]
 * F3  SETTINGS_PRESET_STALE        409 → "Someone changed this preset."   [Refresh]
 * F4  SETTINGS_COLUMN_NOT_FOUND    422 → "Rule references missing column." [Edit]
 * F5  SETTINGS_PRESET_IN_USE       409 → "...running DQ job."             [Retry]
 * F6  SETTINGS_PERMISSION_DENIED   403 → "Only admins can delete presets." [Contact Admin]
 *
 * Also verifies:
 *   - stable toastId per code for dedup
 *   - action callbacks are invoked correctly
 *   - fallback for generic / server errors
 */

import {
  mapSettingsErrorToToast,
  SETTINGS_ERROR_CODES,
} from '@/modules/settings/error-toast'
import { ApiError } from '@/modules/shared/api-error'

// ── helpers ──────────────────────────────────────────────────────────────────

function apiErr(
  status: number,
  message: string,
  code?: string,
): ApiError {
  return new ApiError({ status, message, code })
}

// ── F1: SETTINGS_RULE_SPEC_INVALID ───────────────────────────────────────────

describe('F1 — SETTINGS_RULE_SPEC_INVALID', () => {
  it('maps to "Rule definition is invalid." with Edit action', () => {
    const onEdit = jest.fn()
    const desc = mapSettingsErrorToToast(
      apiErr(422, 'rule_spec[0] missing required field', SETTINGS_ERROR_CODES.RULE_SPEC_INVALID),
      { onEdit },
    )
    expect(desc.title).toBe('Rule definition is invalid.')
    expect(desc.variant).toBe('destructive')
    expect(desc.action?.label).toBe('Edit')
    desc.action?.onClick()
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('includes the reason from the error message in description', () => {
    const desc = mapSettingsErrorToToast(
      apiErr(422, 'rule_spec must be a list, got str', SETTINGS_ERROR_CODES.RULE_SPEC_INVALID),
      {},
    )
    expect(desc.description).toContain('rule_spec must be a list')
  })

  it('has stable toastId settings-SETTINGS_RULE_SPEC_INVALID', () => {
    const desc = mapSettingsErrorToToast(
      apiErr(422, 'bad spec', SETTINGS_ERROR_CODES.RULE_SPEC_INVALID),
      {},
    )
    expect(desc.toastId).toBe(`settings-${SETTINGS_ERROR_CODES.RULE_SPEC_INVALID}`)
  })

  it('omits action when no onEdit provided', () => {
    const desc = mapSettingsErrorToToast(
      apiErr(422, 'bad spec', SETTINGS_ERROR_CODES.RULE_SPEC_INVALID),
      {},
    )
    expect(desc.action).toBeUndefined()
  })
})

// ── F2: SETTINGS_PRESET_NAME_TAKEN ───────────────────────────────────────────

describe('F2 — SETTINGS_PRESET_NAME_TAKEN', () => {
  it('maps to "Preset name already used." with Rename action', () => {
    const onRename = jest.fn()
    const desc = mapSettingsErrorToToast(
      apiErr(409, "A preset named 'My Preset' already exists", SETTINGS_ERROR_CODES.PRESET_NAME_TAKEN),
      { onRename },
    )
    expect(desc.title).toBe('Preset name already used. Pick another.')
    expect(desc.variant).toBe('destructive')
    expect(desc.action?.label).toBe('Rename')
    desc.action?.onClick()
    expect(onRename).toHaveBeenCalledTimes(1)
  })

  it('has stable toastId for dedup', () => {
    const desc = mapSettingsErrorToToast(
      apiErr(409, 'name taken', SETTINGS_ERROR_CODES.PRESET_NAME_TAKEN),
      {},
    )
    expect(desc.toastId).toBe(`settings-${SETTINGS_ERROR_CODES.PRESET_NAME_TAKEN}`)
  })
})

// ── F3: SETTINGS_PRESET_STALE ────────────────────────────────────────────────

describe('F3 — SETTINGS_PRESET_STALE', () => {
  it('maps to "Someone changed this preset. Refresh." with Refresh action', () => {
    const onRefresh = jest.fn()
    const desc = mapSettingsErrorToToast(
      apiErr(409, 'Someone changed this preset.', SETTINGS_ERROR_CODES.PRESET_STALE),
      { onRefresh },
    )
    expect(desc.title).toBe('Someone changed this preset. Refresh.')
    expect(desc.variant).toBe('default')
    expect(desc.action?.label).toBe('Refresh')
    desc.action?.onClick()
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('uses default window.location.reload when no onRefresh provided', () => {
    // Just confirm no crash and Refresh action exists
    const desc = mapSettingsErrorToToast(
      apiErr(409, 'stale', SETTINGS_ERROR_CODES.PRESET_STALE),
      {},
    )
    expect(desc.action?.label).toBe('Refresh')
    // Should not throw when invoked in test (window.location.reload is not defined)
    expect(() => desc.action?.onClick()).not.toThrow()
  })

  it('has stable toastId for dedup', () => {
    const desc = mapSettingsErrorToToast(
      apiErr(409, 'stale', SETTINGS_ERROR_CODES.PRESET_STALE),
      {},
    )
    expect(desc.toastId).toBe(`settings-${SETTINGS_ERROR_CODES.PRESET_STALE}`)
  })
})

// ── F4: SETTINGS_COLUMN_NOT_FOUND ────────────────────────────────────────────

describe('F4 — SETTINGS_COLUMN_NOT_FOUND', () => {
  it('maps to "Rule references missing column: {col}." with Edit action', () => {
    const onEdit = jest.fn()
    const desc = mapSettingsErrorToToast(
      apiErr(422, 'Rule references missing column: invoice_date', SETTINGS_ERROR_CODES.COLUMN_NOT_FOUND),
      { onEdit },
    )
    expect(desc.title).toContain('invoice_date')
    expect(desc.variant).toBe('destructive')
    expect(desc.action?.label).toBe('Edit')
    desc.action?.onClick()
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('includes column name extracted from message', () => {
    const desc = mapSettingsErrorToToast(
      apiErr(422, 'Rule references missing column: amount_usd', SETTINGS_ERROR_CODES.COLUMN_NOT_FOUND),
      {},
    )
    expect(desc.title).toContain('amount_usd')
  })

  it('has stable toastId for dedup', () => {
    const desc = mapSettingsErrorToToast(
      apiErr(422, 'Rule references missing column: x', SETTINGS_ERROR_CODES.COLUMN_NOT_FOUND),
      {},
    )
    expect(desc.toastId).toBe(`settings-${SETTINGS_ERROR_CODES.COLUMN_NOT_FOUND}`)
  })
})

// ── F5: SETTINGS_PRESET_IN_USE ───────────────────────────────────────────────

describe('F5 — SETTINGS_PRESET_IN_USE', () => {
  it('maps to "running DQ job" toast with Retry action', () => {
    const onRetry = jest.fn()
    const desc = mapSettingsErrorToToast(
      apiErr(409, 'This preset is being used by a running DQ job.', SETTINGS_ERROR_CODES.PRESET_IN_USE),
      { onRetry },
    )
    expect(desc.title).toContain('running DQ job')
    expect(desc.variant).toBe('default')
    expect(desc.action?.label).toBe('Retry')
    desc.action?.onClick()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('omits action when no onRetry provided', () => {
    const desc = mapSettingsErrorToToast(
      apiErr(409, 'preset in use', SETTINGS_ERROR_CODES.PRESET_IN_USE),
      {},
    )
    expect(desc.action).toBeUndefined()
  })

  it('has stable toastId for dedup', () => {
    const desc = mapSettingsErrorToToast(
      apiErr(409, 'in use', SETTINGS_ERROR_CODES.PRESET_IN_USE),
      {},
    )
    expect(desc.toastId).toBe(`settings-${SETTINGS_ERROR_CODES.PRESET_IN_USE}`)
  })
})

// ── F6: SETTINGS_PERMISSION_DENIED ───────────────────────────────────────────

describe('F6 — SETTINGS_PERMISSION_DENIED', () => {
  it('maps to "Only admins can delete presets." with Contact Admin action', () => {
    const desc = mapSettingsErrorToToast(
      apiErr(403, 'Only admins can delete presets.', SETTINGS_ERROR_CODES.PERMISSION_DENIED),
      {},
    )
    expect(desc.title).toBe('Only admins can delete presets.')
    expect(desc.variant).toBe('destructive')
    expect(desc.action?.label).toBe('Contact Admin')
  })

  it('also maps plain 403 without code to permission-denied toast', () => {
    const desc = mapSettingsErrorToToast(
      apiErr(403, 'Permission denied: settings admin role required'),
      {},
    )
    expect(desc.title).toBe('Only admins can delete presets.')
    expect(desc.action?.label).toBe('Contact Admin')
  })

  it('has stable toastId for dedup', () => {
    const desc = mapSettingsErrorToToast(
      apiErr(403, 'Forbidden', SETTINGS_ERROR_CODES.PERMISSION_DENIED),
      {},
    )
    expect(desc.toastId).toBe(`settings-${SETTINGS_ERROR_CODES.PERMISSION_DENIED}`)
  })
})

// ── Dedup: all 6 codes have distinct toastIds ─────────────────────────────────

describe('Toast ID dedup', () => {
  it('all 6 error codes produce distinct toastIds', () => {
    const errors = [
      apiErr(422, 'x', SETTINGS_ERROR_CODES.RULE_SPEC_INVALID),
      apiErr(409, 'x', SETTINGS_ERROR_CODES.PRESET_NAME_TAKEN),
      apiErr(409, 'x', SETTINGS_ERROR_CODES.PRESET_STALE),
      apiErr(422, 'Rule references missing column: x', SETTINGS_ERROR_CODES.COLUMN_NOT_FOUND),
      apiErr(409, 'x', SETTINGS_ERROR_CODES.PRESET_IN_USE),
      apiErr(403, 'x', SETTINGS_ERROR_CODES.PERMISSION_DENIED),
    ]
    const ids = errors.map(e => mapSettingsErrorToToast(e, {}).toastId)
    expect(new Set(ids).size).toBe(6)
  })

  it('same error fired twice produces the same toastId (dedup works)', () => {
    const err = apiErr(422, 'bad', SETTINGS_ERROR_CODES.RULE_SPEC_INVALID)
    const id1 = mapSettingsErrorToToast(err, {}).toastId
    const id2 = mapSettingsErrorToToast(err, {}).toastId
    expect(id1).toBe(id2)
  })
})

// ── Server error and generic fallback ─────────────────────────────────────────

describe('Fallback handling', () => {
  it('maps 500 to server-error toast with Retry when onRetry provided', () => {
    const onRetry = jest.fn()
    const desc = mapSettingsErrorToToast(apiErr(500, 'Internal Server Error'), { onRetry })
    expect(desc.title).toContain('Server error')
    expect(desc.action?.label).toBe('Retry')
  })

  it('maps plain Error to generic toast', () => {
    const desc = mapSettingsErrorToToast(new Error('boom'), {})
    expect(desc.title).toBe('Error')
    expect(desc.description).toBe('boom')
    expect(desc.toastId).toBe('settings-unknown-error')
  })

  it('maps unknown object to generic toast', () => {
    const desc = mapSettingsErrorToToast("unexpected string error", {})
    expect(desc.title).toBe('Error')
  })
})
