/**
 * Unit tests for FileUploadZone (the transform "editor" / file picker)
 * Covers: empty state render, file ready state, remove file button, format badges
 */
class RO { observe() {} unobserve() {} disconnect() {} }
;(globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || RO
if (typeof Element !== 'undefined') {
  if (!(Element.prototype as any).hasPointerCapture) (Element.prototype as any).hasPointerCapture = () => false
  if (!(Element.prototype as any).releasePointerCapture) (Element.prototype as any).releasePointerCapture = () => {}
  if (!(Element.prototype as any).scrollIntoView) (Element.prototype as any).scrollIntoView = () => {}
}

// react-dropzone uses the File API heavily; jsdom satisfies it
jest.mock('react-dropzone', () => {
  const actual = jest.requireActual('react-dropzone')
  return actual
})

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import transformReducer, { setUploadedFileInfo } from '@/modules/transform/store/transformSlice'
import { FileUploadZone } from '@/modules/transform/components/file-upload-zone'

const dashboardReducer = (state = {}, action: any) => state

function makeStore(preloadedState?: any) {
  return configureStore({
    reducer: { transform: transformReducer, dashboard: dashboardReducer },
    preloadedState,
  })
}

function renderWithStore(preloadedState?: any) {
  const store = makeStore(preloadedState)
  return {
    ...render(
      <Provider store={store}>
        <FileUploadZone />
      </Provider>
    ),
    store,
  }
}

describe('FileUploadZone — transform editor', () => {
  it('renders "Upload your ERP data file" prompt in empty state', () => {
    renderWithStore()
    expect(screen.getByText(/Upload your ERP data file/i)).toBeInTheDocument()
  })

  it('renders Choose File button in empty state', () => {
    renderWithStore()
    expect(screen.getByRole('button', { name: /choose file/i })).toBeInTheDocument()
  })

  it('shows supported format badges: CSV, Excel, JSON, Parquet', () => {
    renderWithStore()
    expect(screen.getByText('CSV')).toBeInTheDocument()
    expect(screen.getByText('Excel')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
    expect(screen.getByText('Parquet')).toBeInTheDocument()
  })

  it('displays max file size hint text', () => {
    renderWithStore()
    expect(screen.getByText(/maximum file size: 100mb/i)).toBeInTheDocument()
  })

  it('renders file-ready state when uploadedFileInfo is set', () => {
    renderWithStore({
      transform: {
        ...makeStore().getState().transform,
        uploadedFileInfo: { name: 'sales_data.csv', size: 2048, type: 'text/csv' },
      },
    })
    expect(screen.getByText('sales_data.csv')).toBeInTheDocument()
    expect(screen.getByText('Ready to transform')).toBeInTheDocument()
  })

  it('shows file size formatted correctly (2 KB for 2048 bytes)', () => {
    renderWithStore({
      transform: {
        ...makeStore().getState().transform,
        uploadedFileInfo: { name: 'data.csv', size: 2048, type: 'text/csv' },
      },
    })
    expect(screen.getByText('2 KB')).toBeInTheDocument()
  })

  it('remove button clears uploadedFileInfo in store (state assertion)', () => {
    const { store } = renderWithStore({
      transform: {
        ...makeStore().getState().transform,
        uploadedFileInfo: { name: 'sales_data.csv', size: 1024, type: 'text/csv' },
      },
    })
    // Confirm file is loaded
    expect(store.getState().transform.uploadedFileInfo).not.toBeNull()
    // The remove button is the only button in file-ready state
    const removeBtn = screen.getByRole('button')
    fireEvent.click(removeBtn)
    // After removal, store should have cleared uploadedFileInfo
    expect(store.getState().transform.uploadedFileInfo).toBeNull()
  })
})
