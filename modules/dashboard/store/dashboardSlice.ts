import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { DashboardState } from '@/modules/dashboard/types/dashboard.types'

// Re-export for backwards compatibility
export type { DashboardState } from '@/modules/dashboard/types/dashboard.types'


const initialState: DashboardState = {
  totalTransformations: 0,
  successRate: 0,
  activeConnections: 0,
  recentActivity: [],
  systemHealth: {
    api: "healthy",
    database: "healthy",
    storage: "healthy",
  },
}

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    updateMetrics: (state, action: PayloadAction<Partial<DashboardState>>) => {
      Object.assign(state, action.payload)
    },
    addActivity: (state, action: PayloadAction<DashboardState["recentActivity"][0]>) => {
      state.recentActivity.unshift(action.payload)
      if (state.recentActivity.length > 10) {
        state.recentActivity.pop()
      }
    },
    updateSystemHealth: (state, action: PayloadAction<DashboardState["systemHealth"]>) => {
      state.systemHealth = action.payload
    },
  },
})

export const { updateMetrics, addActivity, updateSystemHealth } = dashboardSlice.actions
export default dashboardSlice.reducer
