import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

interface ApiEndpoint {
  id: string
  name: string
  method: "GET" | "POST"
  path: string
  description: string
  parameters?: Array<{
    name: string
    type: string
    required: boolean
    description: string
  }>
}

interface ApiState {
  endpoints: ApiEndpoint[]
  selectedEndpoint: string | null
  requestHistory: Array<{
    id: string
    endpoint: string
    method: string
    timestamp: string
    status: number
    responseTime: number
  }>
}

const initialState: ApiState = {
  endpoints: [
    {
      id: "health",
      name: "Health Check",
      method: "GET",
      path: "/health",
      description: "Check API health status",
    },
    {
      id: "transform",
      name: "Transform Data",
      method: "POST",
      path: "/transform",
      description: "Transform JSON data to CDF format",
      parameters: [
        { name: "auto_select_erp", type: "boolean", required: false, description: "Auto-detect ERP system" },
        { name: "auto_select_entity", type: "boolean", required: false, description: "Auto-detect entity type" },
        { name: "entity", type: "string", required: false, description: "Entity type" },
        { name: "erp", type: "string", required: false, description: "ERP system" },
        { name: "data", type: "array", required: true, description: "Data to transform" },
      ],
    },
    {
      id: "transform-file",
      name: "Transform File",
      method: "POST",
      path: "/transform/file",
      description: "Transform uploaded file to CDF format",
    },
    {
      id: "analyze",
      name: "Analyze File",
      method: "POST",
      path: "/analyze",
      description: "Analyze uploaded file and provide insights",
    },
  ],
  selectedEndpoint: null,
  requestHistory: [],
}

const apiSlice = createSlice({
  name: "api",
  initialState,
  reducers: {
    selectEndpoint: (state, action: PayloadAction<string>) => {
      state.selectedEndpoint = action.payload
    },
    addRequest: (state, action: PayloadAction<ApiState["requestHistory"][0]>) => {
      state.requestHistory.unshift(action.payload)
      if (state.requestHistory.length > 50) {
        state.requestHistory.pop()
      }
    },
  },
})

export const { selectEndpoint, addRequest } = apiSlice.actions
export default apiSlice.reducer
