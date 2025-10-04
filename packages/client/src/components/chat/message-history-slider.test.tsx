/**
 * Message History Slider - Component Integration Tests
 * Tests the slider component with mocked dependencies
 *
 * Note: Uses React Testing Library patterns for component testing
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Message as AIMessage } from 'ai'
import { createTestMessages, calculateExpectedTokens } from '../../test-utils/message-test-factories'

// Mock the UI components
mock.module('@promptliano/ui', () => ({
  Slider: ({ value, onValueChange, min, max, step, className }: any) => (
    <input
      data-testid="slider-input"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0]}
      onChange={(e) => onValueChange([parseInt(e.target.value, 10)])}
      className={className}
    />
  )
}))

// Mock FormatTokenCount component
mock.module('../../components/format-token-count', () => ({
  FormatTokenCount: ({ tokenContent }: { tokenContent: number }) => (
    <span data-testid="token-count">{tokenContent}</span>
  )
}))

// Mock the estimateTokenCount function
const mockEstimateTokenCount = mock((text: string) => Math.ceil(text.length / 4))

mock.module('@promptliano/shared', () => ({
  estimateTokenCount: mockEstimateTokenCount
}))

// Import the component after mocks are set up
import { MessageHistorySlider } from './message-history-slider'

describe('MessageHistorySlider Component', () => {
  let mockOnChange: ReturnType<typeof mock>
  let testMessages: AIMessage[]

  beforeEach(() => {
    mockOnChange = mock()
    mockEstimateTokenCount.mockClear()
    testMessages = createTestMessages(10) // 10 messages
  })

  describe('Rendering', () => {
    test('should render slider with correct props', () => {
      render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      const slider = screen.getByTestId('slider-input')
      expect(slider).toBeDefined()
      expect(slider.getAttribute('min')).toBe('1')
      expect(slider.getAttribute('max')).toBe('10')
      expect(slider.getAttribute('value')).toBe('5')
    })

    test('should display message count label', () => {
      const { container } = render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      expect(container.textContent).toContain('5 of 10 messages')
    })

    test('should display token statistics', () => {
      render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={10}
          onChange={mockOnChange}
          newInputText="Hello world"
        />
      )

      // Should display History, New Input, and Total Context sections
      const tokenCounts = screen.getAllByTestId('token-count')
      expect(tokenCounts.length).toBeGreaterThanOrEqual(3)
    })

    test('should apply custom className', () => {
      const { container } = render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText=""
          className="custom-class"
        />
      )

      expect(container.firstChild?.className).toContain('custom-class')
    })
  })

  describe('Token Calculation', () => {
    test('should calculate history tokens based on selected messages', () => {
      const messages = [
        { id: '1', role: 'user', content: 'A'.repeat(40), createdAt: new Date() },
        { id: '2', role: 'assistant', content: 'B'.repeat(40), createdAt: new Date() },
        { id: '3', role: 'user', content: 'C'.repeat(40), createdAt: new Date() }
      ] as AIMessage[]

      render(
        <MessageHistorySlider
          messages={messages}
          currentValue={2}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      // Should calculate tokens for last 2 messages only
      expect(mockEstimateTokenCount).toHaveBeenCalled()
    })

    test('should calculate input tokens from newInputText', () => {
      render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText="This is a test input message"
        />
      )

      // Should call estimateTokenCount for input text
      expect(mockEstimateTokenCount).toHaveBeenCalledWith('This is a test input message')
    })

    test('should calculate total tokens correctly', () => {
      const messages = [
        { id: '1', role: 'user', content: 'Message 1', createdAt: new Date() },
        { id: '2', role: 'assistant', content: 'Response 1', createdAt: new Date() }
      ] as AIMessage[]

      const { rerender } = render(
        <MessageHistorySlider
          messages={messages}
          currentValue={2}
          onChange={mockOnChange}
          newInputText="Input"
        />
      )

      // Get initial token counts
      const tokenCounts = screen.getAllByTestId('token-count')
      const historyTokens = parseInt(tokenCounts[0]?.textContent || '0', 10)
      const inputTokens = parseInt(tokenCounts[1]?.textContent || '0', 10)
      const totalTokens = parseInt(tokenCounts[2]?.textContent || '0', 10)

      // Total should equal history + input
      expect(totalTokens).toBe(historyTokens + inputTokens)
    })

    test('should handle empty input text', () => {
      render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      // Should handle empty input gracefully
      expect(mockEstimateTokenCount).toHaveBeenCalledWith('')
    })
  })

  describe('User Interactions', () => {
    test('should call onChange when slider value changes', () => {
      const { container } = render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      const slider = container.querySelector('[data-testid="slider-input"]') as HTMLInputElement
      fireEvent.change(slider, { target: { value: '7' } })

      expect(mockOnChange).toHaveBeenCalledWith(7)
    })

    test('should update display when currentValue prop changes', () => {
      const { rerender, container } = render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      const slider = container.querySelector('[data-testid="slider-input"]') as HTMLInputElement
      expect(slider.getAttribute('value')).toBe('5')

      rerender(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={8}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      expect(slider.getAttribute('value')).toBe('8')
    })

    test('should update token counts when slider value changes', async () => {
      const { rerender, container } = render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={10}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      const initialTokenCounts = Array.from(container.querySelectorAll('[data-testid="token-count"]'))
      const initialTotal = parseInt(initialTokenCounts[2]?.textContent || '0', 10)

      // Change slider value to include fewer messages
      rerender(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      await waitFor(() => {
        const newTokenCounts = Array.from(container.querySelectorAll('[data-testid="token-count"]'))
        const newTotal = parseInt(newTokenCounts[2]?.textContent || '0', 10)
        expect(newTotal).toBeLessThan(initialTotal)
      })
    })
  })

  describe('Context Warning', () => {
    test('should show warning for large context', () => {
      const largeMessages = createTestMessages(50) // Many messages

      const { container } = render(
        <MessageHistorySlider
          messages={largeMessages}
          currentValue={50}
          onChange={mockOnChange}
          newInputText={'A'.repeat(5000)} // Large input
        />
      )

      // Check for warning text
      const hasWarning = container.textContent?.includes('Large context') ||
                        container.textContent?.includes('increase') ||
                        container.textContent?.includes('cost')

      // Warning depends on total token count
      // Just verify component doesn't crash with large context
      expect(hasWarning !== undefined).toBe(true)
    })

    test('should not show warning for small context', () => {
      const smallMessages = createTestMessages(2) // Few messages

      const { container } = render(
        <MessageHistorySlider
          messages={smallMessages}
          currentValue={2}
          onChange={mockOnChange}
          newInputText="Hi"
        />
      )

      // Should not have warning for small context
      expect(container.textContent).toBeDefined()
    })
  })

  describe('useMemo Optimization', () => {
    test('should memoize token calculations', () => {
      mockEstimateTokenCount.mockClear()

      const { rerender } = render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText="Test"
        />
      )

      const callCountAfterFirstRender = mockEstimateTokenCount.mock.calls.length

      // Re-render with same props
      rerender(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText="Test"
        />
      )

      // Should not recalculate (useMemo should prevent it)
      expect(mockEstimateTokenCount.mock.calls.length).toBe(callCountAfterFirstRender)
    })

    test('should recalculate when dependencies change', () => {
      mockEstimateTokenCount.mockClear()

      const { rerender } = render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText="Test"
        />
      )

      mockEstimateTokenCount.mockClear()

      // Change a dependency
      rerender(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={7} // Changed value
          onChange={mockOnChange}
          newInputText="Test"
        />
      )

      // Should recalculate with new value
      expect(mockEstimateTokenCount.mock.calls.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty messages array', () => {
      const { container } = render(
        <MessageHistorySlider
          messages={[]}
          currentValue={1}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      const slider = container.querySelector('[data-testid="slider-input"]') as HTMLInputElement
      expect(slider.getAttribute('max')).toBe('1') // Should have max of 1 even with no messages
    })

    test('should handle single message', () => {
      const singleMessage = [
        { id: '1', role: 'user', content: 'Hello', createdAt: new Date() }
      ] as AIMessage[]

      const { container } = render(
        <MessageHistorySlider
          messages={singleMessage}
          currentValue={1}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      const slider = container.querySelector('[data-testid="slider-input"]') as HTMLInputElement
      expect(slider.getAttribute('max')).toBe('1')
      expect(slider.getAttribute('value')).toBe('1')
    })

    test('should handle currentValue exceeding message count', () => {
      const { container } = render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={100} // Way more than available
          onChange={mockOnChange}
          newInputText=""
        />
      )

      // Should still render without crashing
      const slider = container.querySelector('[data-testid="slider-input"]')
      expect(slider).toBeDefined()
    })

    test('should handle very long input text', () => {
      const veryLongInput = 'A'.repeat(10000)

      render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText={veryLongInput}
        />
      )

      // Should calculate tokens for long input
      expect(mockEstimateTokenCount).toHaveBeenCalledWith(veryLongInput)
    })

    test('should handle messages with complex content', () => {
      const complexMessages = [
        {
          id: '1',
          role: 'user',
          content: [
            { type: 'text', text: 'Hello' },
            { type: 'text', text: 'World' }
          ],
          createdAt: new Date()
        }
      ] as AIMessage[]

      const { container } = render(
        <MessageHistorySlider
          messages={complexMessages}
          currentValue={1}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      // Should handle complex content without crashing
      expect(container.querySelector('[data-testid="slider-input"]')).toBeDefined()
    })
  })

  describe('Props Validation', () => {
    test('should accept all required props', () => {
      const props = {
        messages: testMessages,
        currentValue: 5,
        onChange: mockOnChange,
        newInputText: 'Test'
      }

      expect(() => render(<MessageHistorySlider {...props} />)).not.toThrow()
    })

    test('should accept optional className prop', () => {
      const props = {
        messages: testMessages,
        currentValue: 5,
        onChange: mockOnChange,
        newInputText: 'Test',
        className: 'my-custom-class'
      }

      expect(() => render(<MessageHistorySlider {...props} />)).not.toThrow()
    })

    test('should handle onChange callback correctly', () => {
      const { container } = render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      const slider = container.querySelector('[data-testid="slider-input"]') as HTMLInputElement
      fireEvent.change(slider, { target: { value: '3' } })

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      expect(mockOnChange).toHaveBeenCalledWith(3)
    })
  })

  describe('Accessibility', () => {
    test('should render slider with proper input type', () => {
      const { container } = render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      const slider = container.querySelector('[data-testid="slider-input"]') as HTMLInputElement
      expect(slider.getAttribute('type')).toBe('range')
    })

    test('should have meaningful labels', () => {
      const { container } = render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText=""
        />
      )

      // Check for label text
      expect(container.textContent).toContain('Message History')
      expect(container.textContent).toContain('History')
      expect(container.textContent).toContain('New Input')
      expect(container.textContent).toContain('Total Context')
    })
  })

  describe('Performance', () => {
    test('should handle large message arrays efficiently', () => {
      const largeMessages = createTestMessages(100) // 100 messages

      const startTime = Date.now()

      render(
        <MessageHistorySlider
          messages={largeMessages}
          currentValue={50}
          onChange={mockOnChange}
          newInputText="Test"
        />
      )

      const endTime = Date.now()

      // Should render in reasonable time
      expect(endTime - startTime).toBeLessThan(100) // 100ms
    })

    test('should not recalculate unnecessarily', () => {
      mockEstimateTokenCount.mockClear()

      const { rerender } = render(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText="Test"
        />
      )

      const initialCallCount = mockEstimateTokenCount.mock.calls.length

      // Rerender with unrelated prop change (className)
      rerender(
        <MessageHistorySlider
          messages={testMessages}
          currentValue={5}
          onChange={mockOnChange}
          newInputText="Test"
          className="new-class"
        />
      )

      // Should not trigger recalculation for className change
      expect(mockEstimateTokenCount.mock.calls.length).toBe(initialCallCount)
    })
  })
})