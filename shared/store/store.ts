import { configureStore } from "@reduxjs/toolkit"
import { type TypedUseSelectorHook, useDispatch, useSelector } from "react-redux"
import dashboardSlice from "@/modules/dashboard/store/dashboardSlice"
import apiSlice from "@/shared/store/apiSlice"
import transformSlice from "@/modules/transform/store/transformSlice"
import filesReducer from "@/modules/files/store/filesSlice"

export const store = configureStore({
  reducer: {
    dashboard: dashboardSlice,
    api: apiSlice,
    transform: transformSlice,
    files: filesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST"],
      },
    }),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
