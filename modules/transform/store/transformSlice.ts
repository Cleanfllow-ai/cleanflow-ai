import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

interface TransformState {
  isLoading: boolean
  uploadedFile: File | null
  transformResult: any | null
  error: string | null
  supportedErps: string[]
  supportedEntities: string[]
  selectedErp: string | null
  selectedEntity: string | null
  autoDetect: boolean
}

const initialState: TransformState = {
  isLoading: false,
  uploadedFile: null,
  transformResult: null,
  error: null,
  supportedErps: [
    "Oracle Fusion",
    "SAP ERP",
    "Microsoft Dynamics",
    "NetSuite",
    "Workday",
    "Infor M3",
    "Infor LN",
    "Epicor Kinetic",
    "QAD ERP",
    "IFS Cloud",
    "Sage Intacct",
  ],
  supportedEntities: ["sales_orders", "customers", "invoices", "purchase_orders", "inventory_items"],
  selectedErp: null,
  selectedEntity: null,
  autoDetect: true,
}

const transformSlice = createSlice({
  name: "transform",
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
    setUploadedFile: (state, action: PayloadAction<File | null>) => {
      state.uploadedFile = action.payload
    },
    setTransformResult: (state, action: PayloadAction<any>) => {
      state.transformResult = action.payload
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload
    },
    setSelectedErp: (state, action: PayloadAction<string | null>) => {
      state.selectedErp = action.payload
    },
    setSelectedEntity: (state, action: PayloadAction<string | null>) => {
      state.selectedEntity = action.payload
    },
    setAutoDetect: (state, action: PayloadAction<boolean>) => {
      state.autoDetect = action.payload
    },
    resetTransform: (state) => {
      state.uploadedFile = null
      state.transformResult = null
      state.error = null
      state.isLoading = false
    },
  },
})

export const {
  setLoading,
  setUploadedFile,
  setTransformResult,
  setError,
  setSelectedErp,
  setSelectedEntity,
  setAutoDetect,
  resetTransform,
} = transformSlice.actions

export default transformSlice.reducer
