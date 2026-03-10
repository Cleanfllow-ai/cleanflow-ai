import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { DashboardState } from '@/modules/dashboard/types/dashboard.types'

// Re-export for backwards compatibility
export type { DashboardState } from '@/modules/dashboard/types/dashboard.types'


const initialState: DashboardState = {
  totalTransformations: 0,
  successRate: 0,
  activeConnections: 0,
  recentActivity: [
    {
      id: "1",
      type: "transform",
      status: "success",
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      details: "Transformed sales_data_q4.csv - 12,450 rows processed"
    },
    {
      id: "2",
      type: "upload",
      status: "success",
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
      details: "Uploaded inventory_report.xlsx - 8.2 MB"
    },
    {
      id: "3",
      type: "transform",
      status: "error",
      timestamp: new Date(Date.now() - 32 * 60000).toISOString(),
      details: "Failed to transform customer_master.csv - Invalid date format"
    },
    {
      id: "4",
      type: "download",
      status: "success",
      timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
      details: "Downloaded cleaned_transactions.csv"
    },
    {
      id: "5",
      type: "transform",
      status: "success",
      timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
      details: "Transformed vendor_list.csv - 3,200 rows processed"
    },
    {
      id: "6",
      type: "upload",
      status: "pending",
      timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
      details: "Processing financial_report_2024.xlsx - 45 MB"
    },
    {
      id: "7",
      type: "transform",
      status: "success",
      timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
      details: "Transformed employee_data.csv - 850 rows processed"
    },
    {
      id: "8",
      type: "download",
      status: "success",
      timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
      details: "Exported DQ report for batch_upload_001"
    }
  ],
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
