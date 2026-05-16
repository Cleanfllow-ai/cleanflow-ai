/**
 * Unit tests for TransformConfiguration (column mapping UI)
 * Covers: ERP/entity dropdowns, auto-detect toggle, AI auto-map button, transform button loading state
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO
if (typeof Element !== 'undefined') {
  if (!(Element.prototype as any).hasPointerCapture) (Element.prototype as any).hasPointerCapture = () => false
  if (!(Element.prototype as any).releasePointerCapture) (Element.prototype as any).releasePointerCapture = () => {}
  if (!(Element.prototype as any).scrollIntoView) (Element.prototype as any).scrollIntoView = () => {}
}

jest.mock('@/modules/dashboard/store/dashboardSlice', () => ({
  addActivity: jest.fn((payload: any) => ({ type: 'dashboard/addActivity', payload })),
}))

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import transformReducer, {
  setAutoDetect,
  setSelectedErp,
  setSelectedEntity,
  setUploadedFileInfo,
  setLoading,
} from '@/modules/transform/store/transformSlice'
import { TransformConfiguration } from '@/modules/transform/components/transform-configuration'

// Dashboard slice stub
const dashboardReducer = (state = { recentActivity: [], totalTransformations: 0, successRate: 0, activeConnections: 0, systemHealth: { api: 'healthy', database: 'healthy', storage: 'healthy' } }, action: any) => state

function makeStore(preloadedState?: any) {
  return configureStore({
    reducer: { transform: transformReducer, dashboard: dashboardReducer },
    preloadedState,
  })
}

function renderWithStore(preloadedState?: any) {
  const store = makeStore(preloadedState)
  const ui = (
    <Provider store={store}>
      <TransformConfiguration />
    </Provider>
  )
  return { ...render(ui), store }
}

describe('TransformConfiguration — column mapping UI', () => {
  it('renders the configuration card with Transform Configuration heading', () => {
    renderWithStore()
    expect(screen.getByText('Transform Configuration')).toBeInTheDocument()
  })

  it('renders Auto-Detection toggle and it is ON by default', () => {
    renderWithStore()
    expect(screen.getByText('Auto-Detection')).toBeInTheDocument()
    // The Switch renders with role="switch" when autoDetect=true
    const toggle = screen.getByRole('switch')
    expect(toggle).toBeInTheDocument()
    expect(toggle).toHaveAttribute('data-state', 'checked')
  })

  it('ERP and entity selects are hidden when auto-detect is enabled', () => {
    renderWithStore() // autoDetect: true by default
    expect(screen.queryByText('ERP System')).not.toBeInTheDocument()
    expect(screen.queryByText('Entity Type')).not.toBeInTheDocument()
  })

  it('ERP and entity selects appear when auto-detect is disabled', () => {
    renderWithStore({ transform: { ...makeStore().getState().transform, autoDetect: false } })
    expect(screen.getByText('ERP System')).toBeInTheDocument()
    expect(screen.getByText('Entity Type')).toBeInTheDocument()
  })

  it('renders Transform Data button', () => {
    renderWithStore()
    expect(screen.getByRole('button', { name: /transform data/i })).toBeInTheDocument()
  })

  it('Transform Data button is disabled while isLoading=true', () => {
    renderWithStore({ transform: { ...makeStore().getState().transform, isLoading: true } })
    const btn = screen.getByRole('button', { name: /transforming/i })
    expect(btn).toBeDisabled()
  })

  it('Transform Data button does nothing (no dispatch) when uploadedFileInfo is null', async () => {
    const { store } = renderWithStore()
    const spy = jest.spyOn(store, 'dispatch')
    const btn = screen.getByRole('button', { name: /transform data/i })
    await act(async () => { fireEvent.click(btn) })
    // setLoading(true) must NOT have been dispatched because uploadedFileInfo is null
    expect(spy).not.toHaveBeenCalledWith(setLoading(true))
    spy.mockRestore()
  })

  it('clicking toggle flips autoDetect in store (state assertion)', () => {
    const { store } = renderWithStore()
    // Default: autoDetect=true, toggle is checked
    expect(store.getState().transform.autoDetect).toBe(true)
    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)
    // After click, autoDetect should be false
    expect(store.getState().transform.autoDetect).toBe(false)
  })

  it('renders Output Format selector with JSON default', () => {
    renderWithStore()
    expect(screen.getByText('Output Format')).toBeInTheDocument()
    // The trigger shows the current value
    expect(screen.getByText('JSON')).toBeInTheDocument()
  })

  it('shows High Performance and Template Mapping badges', () => {
    renderWithStore()
    expect(screen.getByText('High Performance')).toBeInTheDocument()
    expect(screen.getByText('Template Mapping')).toBeInTheDocument()
  })
})
