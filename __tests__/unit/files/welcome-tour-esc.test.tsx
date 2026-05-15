/**
 * P0-6: WelcomeTour — Esc key handler
 */
jest.mock('@reactour/tour', () => {
  const React = require('react')
  return {
    TourProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useTour: () => ({
      setIsOpen: jest.fn(),
      setCurrentStep: jest.fn(),
      isOpen: false,
    }),
  }
})

import { fireEvent, render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { WelcomeTour } from '@/modules/onboarding/components/welcome-tour'

describe('P0-6: WelcomeTour Esc handler', () => {
  it('calls onSkip when Escape is pressed while tour is open', () => {
    const onSkip = jest.fn()
    render(
      <WelcomeTour
        isOpen={true}
        currentStep={0}
        setCurrentStep={jest.fn()}
        onComplete={jest.fn()}
        onSkip={onSkip}
      />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('does NOT call onSkip when Escape pressed while tour is closed', () => {
    const onSkip = jest.fn()
    render(
      <WelcomeTour
        isOpen={false}
        currentStep={0}
        setCurrentStep={jest.fn()}
        onComplete={jest.fn()}
        onSkip={onSkip}
      />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onSkip).not.toHaveBeenCalled()
  })

  it('does NOT call onSkip for non-Escape keys', () => {
    const onSkip = jest.fn()
    render(
      <WelcomeTour
        isOpen={true}
        currentStep={0}
        setCurrentStep={jest.fn()}
        onComplete={jest.fn()}
        onSkip={onSkip}
      />
    )
    fireEvent.keyDown(document, { key: 'Enter' })
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(onSkip).not.toHaveBeenCalled()
  })
})
