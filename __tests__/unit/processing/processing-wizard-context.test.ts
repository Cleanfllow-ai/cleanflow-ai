/**
 * Unit tests for ProcessingWizardProvider (WizardContext.tsx)
 * Covers: step navigation, column toggles, custom rule add/remove,
 *         rule toggling, session-state persistence helpers
 */
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { ProcessingWizardProvider, useProcessingWizard } from '@/modules/processing/components/WizardContext'

// Provide sessionStorage stub (jsdom has it but we explicitly clear between tests)
beforeEach(() => sessionStorage.clear())

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(ProcessingWizardProvider, null, children)

describe('WizardContext — initialisation', () => {
  it('starts on columns step in existing mode', () => {
    const { result } = renderHook(() => useProcessingWizard(), { wrapper })
    expect(result.current.step).toBe('columns')
    expect(result.current.mode).toBe('existing')
  })

  it('initializeWithFile sets uploadId, fileName, columns', () => {
    const { result } = renderHook(() => useProcessingWizard(), { wrapper })
    act(() => {
      result.current.initializeWithFile('uid-001', 'sales.csv', ['col_a', 'col_b'], 'tok-xyz')
    })
    expect(result.current.uploadId).toBe('uid-001')
    expect(result.current.fileName).toBe('sales.csv')
    expect(result.current.allColumns).toEqual(['col_a', 'col_b'])
    expect(result.current.selectedColumns).toEqual(['col_a', 'col_b'])
    expect(result.current.authToken).toBe('tok-xyz')
  })
})

describe('WizardContext — step navigation', () => {
  it('nextStep advances from columns to profiling (existing mode)', () => {
    const { result } = renderHook(() => useProcessingWizard(), { wrapper })
    act(() => result.current.initializeWithFile('u1', 'f.csv', [], 'tok'))
    act(() => result.current.nextStep())
    expect(result.current.step).toBe('profiling')
  })

  it('prevStep goes back from profiling to columns', () => {
    const { result } = renderHook(() => useProcessingWizard(), { wrapper })
    act(() => result.current.initializeWithFile('u1', 'f.csv', [], 'tok'))
    act(() => result.current.nextStep()) // columns → profiling
    act(() => result.current.prevStep()) // profiling → columns
    expect(result.current.step).toBe('columns')
  })

  it('prevStep does not go before first step', () => {
    const { result } = renderHook(() => useProcessingWizard(), { wrapper })
    act(() => result.current.initializeWithFile('u1', 'f.csv', [], 'tok'))
    act(() => result.current.prevStep())
    expect(result.current.step).toBe('columns')
  })

  it('initializeNew sets mode=new and step=source', () => {
    const { result } = renderHook(() => useProcessingWizard(), { wrapper })
    act(() => result.current.initializeNew('tok-new'))
    expect(result.current.mode).toBe('new')
    expect(result.current.step).toBe('source')
  })
})

describe('WizardContext — column management', () => {
  it('toggleColumn deselects a selected column', () => {
    const { result } = renderHook(() => useProcessingWizard(), { wrapper })
    act(() => result.current.initializeWithFile('u1', 'f.csv', ['col_a', 'col_b'], 'tok'))
    act(() => result.current.toggleColumn('col_a'))
    expect(result.current.selectedColumns).not.toContain('col_a')
    expect(result.current.selectedColumns).toContain('col_b')
  })

  it('toggleColumn re-selects a deselected column', () => {
    const { result } = renderHook(() => useProcessingWizard(), { wrapper })
    act(() => result.current.initializeWithFile('u1', 'f.csv', ['col_a'], 'tok'))
    act(() => result.current.toggleColumn('col_a'))  // deselect
    act(() => result.current.toggleColumn('col_a'))  // re-select
    expect(result.current.selectedColumns).toContain('col_a')
  })
})

describe('WizardContext — custom rules', () => {
  it('addCustomRule appends to customRules', () => {
    const { result } = renderHook(() => useProcessingWizard(), { wrapper })
    act(() => {
      result.current.addCustomRule({
        rule_id: 'CUST_1',
        rule_name: 'My Rule',
        column: 'email',
        code: 'return True',
      } as any)
    })
    expect(result.current.customRules).toHaveLength(1)
    expect(result.current.customRules[0].rule_id).toBe('CUST_1')
  })

  it('removeCustomRule removes the matching rule', () => {
    const { result } = renderHook(() => useProcessingWizard(), { wrapper })
    act(() => {
      result.current.addCustomRule({ rule_id: 'CUST_1', rule_name: 'R1', column: 'x', code: '' } as any)
      result.current.addCustomRule({ rule_id: 'CUST_2', rule_name: 'R2', column: 'y', code: '' } as any)
    })
    act(() => result.current.removeCustomRule('CUST_1'))
    expect(result.current.customRules).toHaveLength(1)
    expect(result.current.customRules[0].rule_id).toBe('CUST_2')
  })
})

describe('WizardContext — rule toggling', () => {
  it('toggleRule flips global rule selected state', () => {
    const { result } = renderHook(() => useProcessingWizard(), { wrapper })
    act(() => {
      result.current.setGlobalRules([
        { rule_id: 'R1', rule_name: 'Null Check', category: 'auto', selected: true },
      ])
    })
    act(() => result.current.toggleRule('R1'))
    expect(result.current.globalRules[0].selected).toBe(false)
  })
})

describe('WizardContext — reset', () => {
  it('reset clears all state back to initial', () => {
    const { result } = renderHook(() => useProcessingWizard(), { wrapper })
    act(() => result.current.initializeWithFile('u1', 'f.csv', ['col_a'], 'tok'))
    act(() => result.current.reset())
    expect(result.current.uploadId).toBe('')
    expect(result.current.allColumns).toEqual([])
    expect(result.current.customRules).toEqual([])
  })
})
