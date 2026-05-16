/**
 * Unit tests for transform Redux slice (transformSlice.ts)
 * Covers: all reducers, initial state, state transitions for submit/poll/error
 */
import reducer, {
  setLoading,
  setUploadedFileInfo,
  setTransformResult,
  setError,
  setSelectedErp,
  setSelectedEntity,
  setAutoDetect,
  resetTransform,
} from '@/modules/transform/store/transformSlice'

const INITIAL = reducer(undefined, { type: '@@init' })

describe('transformSlice — initialState', () => {
  it('returns expected initial state', () => {
    expect(INITIAL.isLoading).toBe(false)
    expect(INITIAL.uploadedFileInfo).toBeNull()
    expect(INITIAL.transformResult).toBeNull()
    expect(INITIAL.error).toBeNull()
    expect(INITIAL.autoDetect).toBe(true)
    expect(INITIAL.selectedErp).toBeNull()
    expect(INITIAL.selectedEntity).toBeNull()
  })

  it('has default supported ERPs list (non-empty)', () => {
    expect(INITIAL.supportedErps.length).toBeGreaterThan(0)
    expect(INITIAL.supportedErps).toContain('NetSuite')
  })

  it('has default supported entities list (non-empty)', () => {
    expect(INITIAL.supportedEntities.length).toBeGreaterThan(0)
    expect(INITIAL.supportedEntities).toContain('sales_orders')
  })
})

describe('setLoading — submit transform (isLoading transition)', () => {
  it('sets isLoading to true', () => {
    const state = reducer(INITIAL, setLoading(true))
    expect(state.isLoading).toBe(true)
  })

  it('sets isLoading back to false after poll resolves', () => {
    let state = reducer(INITIAL, setLoading(true))
    state = reducer(state, setLoading(false))
    expect(state.isLoading).toBe(false)
  })

  it('does not mutate other fields when toggling loading', () => {
    const withFile = reducer(INITIAL, setUploadedFileInfo({ name: 'x.csv', size: 100, type: 'text/csv' }))
    const state = reducer(withFile, setLoading(true))
    expect(state.uploadedFileInfo).not.toBeNull()
    expect(state.uploadedFileInfo!.name).toBe('x.csv')
  })
})

describe('setTransformResult — poll status update', () => {
  it('stores transform result', () => {
    const result = { success: true, row_count: 42, message: 'ok', data: [] }
    const state = reducer(INITIAL, setTransformResult(result))
    expect(state.transformResult).toEqual(result)
  })

  it('can overwrite a previous result (re-run)', () => {
    const first = { success: true, row_count: 10, data: [] }
    const second = { success: true, row_count: 20, data: [] }
    let state = reducer(INITIAL, setTransformResult(first))
    state = reducer(state, setTransformResult(second))
    expect(state.transformResult.row_count).toBe(20)
  })
})

describe('setError — error toast path', () => {
  it('stores error message', () => {
    const state = reducer(INITIAL, setError('Transformation failed'))
    expect(state.error).toBe('Transformation failed')
  })

  it('clears error when set to null', () => {
    let state = reducer(INITIAL, setError('Some error'))
    state = reducer(state, setError(null))
    expect(state.error).toBeNull()
  })

  it('isLoading resets to false after setLoading(false) following an error', () => {
    let state = reducer(INITIAL, setLoading(true))
    state = reducer(state, setError('Transformation failed'))
    state = reducer(state, setLoading(false))
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe('Transformation failed')
  })
})

describe('setSelectedErp + setSelectedEntity', () => {
  it('stores selected ERP', () => {
    const state = reducer(INITIAL, setSelectedErp('NetSuite'))
    expect(state.selectedErp).toBe('NetSuite')
  })

  it('stores selected entity', () => {
    const state = reducer(INITIAL, setSelectedEntity('customers'))
    expect(state.selectedEntity).toBe('customers')
  })

  it('can clear ERP selection', () => {
    let state = reducer(INITIAL, setSelectedErp('SAP ERP'))
    state = reducer(state, setSelectedErp(null))
    expect(state.selectedErp).toBeNull()
  })
})

describe('setAutoDetect', () => {
  it('toggles auto-detect off', () => {
    const state = reducer(INITIAL, setAutoDetect(false))
    expect(state.autoDetect).toBe(false)
  })

  it('toggles auto-detect back on', () => {
    let state = reducer(INITIAL, setAutoDetect(false))
    state = reducer(state, setAutoDetect(true))
    expect(state.autoDetect).toBe(true)
  })
})

describe('resetTransform', () => {
  it('clears uploadedFileInfo, result, error, loading', () => {
    let state = reducer(INITIAL, setUploadedFileInfo({ name: 'a.csv', size: 1, type: 'text/csv' }))
    state = reducer(state, setTransformResult({ success: true }))
    state = reducer(state, setError('boom'))
    state = reducer(state, setLoading(true))
    state = reducer(state, resetTransform())
    expect(state.uploadedFileInfo).toBeNull()
    expect(state.transformResult).toBeNull()
    expect(state.error).toBeNull()
    expect(state.isLoading).toBe(false)
  })

  it('preserves supportedErps and supportedEntities after reset', () => {
    const state = reducer(INITIAL, resetTransform())
    expect(state.supportedErps).toEqual(INITIAL.supportedErps)
    expect(state.supportedEntities).toEqual(INITIAL.supportedEntities)
  })
})
