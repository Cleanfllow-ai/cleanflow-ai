/**
 * Unit tests for modules/dashboard/store/dashboardSlice.ts
 * Covers: Redux reducers — updateMetrics, addActivity, updateSystemHealth
 */
import reducer, {
  updateMetrics,
  addActivity,
  updateSystemHealth,
} from '@/modules/dashboard/store/dashboardSlice'
import type { DashboardState } from '@/modules/dashboard/types/dashboard.types'

const makeInitialState = (): DashboardState => ({
  totalTransformations: 0,
  successRate: 0,
  activeConnections: 0,
  recentActivity: [],
  systemHealth: {
    api: 'healthy',
    database: 'healthy',
    storage: 'healthy',
  },
})

describe('dashboardSlice — initialState', () => {
  it('returns the correct initial state', () => {
    const state = reducer(undefined, { type: '@@init' })
    expect(state).toEqual(makeInitialState())
  })
})

describe('updateMetrics', () => {
  it('updates totalTransformations', () => {
    const state = reducer(makeInitialState(), updateMetrics({ totalTransformations: 42 }))
    expect(state.totalTransformations).toBe(42)
    // Other fields unchanged
    expect(state.successRate).toBe(0)
    expect(state.activeConnections).toBe(0)
  })

  it('updates multiple metrics at once', () => {
    const state = reducer(
      makeInitialState(),
      updateMetrics({ totalTransformations: 10, successRate: 95.5, activeConnections: 3 })
    )
    expect(state.totalTransformations).toBe(10)
    expect(state.successRate).toBe(95.5)
    expect(state.activeConnections).toBe(3)
  })

  it('preserves recentActivity when updating metrics', () => {
    const existing = makeInitialState()
    existing.recentActivity = [
      { id: '1', type: 'upload', status: 'success', timestamp: '2026-01-01', details: 'test' },
    ]
    const state = reducer(existing, updateMetrics({ totalTransformations: 5 }))
    expect(state.recentActivity).toHaveLength(1)
    expect(state.recentActivity[0].id).toBe('1')
  })

  it('handles empty payload without mutation', () => {
    const state = reducer(makeInitialState(), updateMetrics({}))
    expect(state).toEqual(makeInitialState())
  })
})

describe('addActivity', () => {
  const activity = {
    id: 'act-1',
    type: 'upload' as const,
    status: 'success' as const,
    timestamp: '2026-04-16T10:00:00Z',
    details: 'Uploaded test.csv',
  }

  it('prepends activity to the beginning', () => {
    const state = reducer(makeInitialState(), addActivity(activity))
    expect(state.recentActivity).toHaveLength(1)
    expect(state.recentActivity[0]).toEqual(activity)
  })

  it('preserves order — newest first', () => {
    let state = reducer(makeInitialState(), addActivity({ ...activity, id: 'a1' }))
    state = reducer(state, addActivity({ ...activity, id: 'a2' }))
    state = reducer(state, addActivity({ ...activity, id: 'a3' }))
    expect(state.recentActivity.map((a) => a.id)).toEqual(['a3', 'a2', 'a1'])
  })

  it('caps at 10 activities — removes oldest', () => {
    let state = makeInitialState()
    for (let i = 1; i <= 12; i++) {
      state = reducer(state, addActivity({ ...activity, id: `act-${i}` }))
    }
    expect(state.recentActivity).toHaveLength(10)
    // newest is first
    expect(state.recentActivity[0].id).toBe('act-12')
    // oldest remaining is act-3 (act-1 and act-2 were popped)
    expect(state.recentActivity[9].id).toBe('act-3')
  })

  it('handles all activity types', () => {
    const types: Array<'transform' | 'upload' | 'download'> = ['transform', 'upload', 'download']
    let state = makeInitialState()
    for (const type of types) {
      state = reducer(state, addActivity({ ...activity, id: type, type }))
    }
    expect(state.recentActivity).toHaveLength(3)
  })

  it('handles all status types', () => {
    const statuses: Array<'success' | 'error' | 'pending'> = ['success', 'error', 'pending']
    let state = makeInitialState()
    for (const status of statuses) {
      state = reducer(state, addActivity({ ...activity, id: status, status }))
    }
    expect(state.recentActivity).toHaveLength(3)
  })
})

describe('updateSystemHealth', () => {
  it('updates all health indicators', () => {
    const newHealth = { api: 'down' as const, database: 'degraded' as const, storage: 'healthy' as const }
    const state = reducer(makeInitialState(), updateSystemHealth(newHealth))
    expect(state.systemHealth).toEqual(newHealth)
  })

  it('replaces entire health object, not merge', () => {
    const state = reducer(
      makeInitialState(),
      updateSystemHealth({ api: 'degraded', database: 'down', storage: 'down' })
    )
    expect(state.systemHealth.api).toBe('degraded')
    expect(state.systemHealth.database).toBe('down')
    expect(state.systemHealth.storage).toBe('down')
  })

  it('does not affect other state fields', () => {
    const existing = makeInitialState()
    existing.totalTransformations = 100
    const state = reducer(existing, updateSystemHealth({ api: 'down', database: 'down', storage: 'down' }))
    expect(state.totalTransformations).toBe(100)
  })
})
