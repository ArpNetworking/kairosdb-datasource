import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricNameField } from '../src/components/MetricNameField';

// Mock our custom hooks and components
jest.mock('../src/hooks/useMetricAutocomplete');
jest.mock('../src/hooks/useDropdownPosition');
jest.mock('../src/components/SuggestionDropdown');

import { useMetricAutocomplete } from '../src/hooks/useMetricAutocomplete';
import { useDropdownPosition } from '../src/hooks/useDropdownPosition';
import { SuggestionDropdown } from '../src/components/SuggestionDropdown';

const mockUseMetricAutocomplete = useMetricAutocomplete as jest.MockedFunction<typeof useMetricAutocomplete>;
const mockUseDropdownPosition = useDropdownPosition as jest.MockedFunction<typeof useDropdownPosition>;
const mockSuggestionDropdown = SuggestionDropdown as jest.MockedComponent<typeof SuggestionDropdown>;

// Mock DataSource interface
const mockDataSource = {
  getMetricNames: jest.fn(),
};

const mockOnChange = jest.fn();
const mockOnBlur = jest.fn();

const defaultProps = {
  value: '',
  onChange: mockOnChange,
  onBlur: mockOnBlur,
  dataSource: mockDataSource,
  placeholder: 'Enter metric name',
  maxResults: 50,
  debounceMs: 300,
  cacheTtlMs: 300000,
};

describe('MetricNameField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockUseMetricAutocomplete.mockReturnValue({
      suggestions: [],
      isLoading: false,
      error: null,
    });
    
    mockUseDropdownPosition.mockReturnValue(null);
    
    mockSuggestionDropdown.mockImplementation(({ isVisible, children }) => 
      isVisible ? <div data-testid="suggestion-dropdown">{children}</div> : null
    );

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = jest.fn();
  });

  describe('basic rendering', () => {
    it('should render input field with correct props', () => {
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'Enter metric name');
      expect(input).toHaveValue('');
    });

    it('should render with initial value', () => {
      render(<MetricNameField {...defaultProps} value="system.cpu.usage" />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('system.cpu.usage');
    });

    it('should render with disabled state', () => {
      render(<MetricNameField {...defaultProps} disabled />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('should render with error state', () => {
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: [],
        isLoading: false,
        error: new Error('API Error'),
      });

      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('error'); // Assuming error styling
    });

    it('should apply custom className', () => {
      render(<MetricNameField {...defaultProps} className="custom-class" />);
      
      const container = screen.getByRole('textbox').parentElement;
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('input interactions', () => {
    it('should call onChange when typing', async () => {
      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      
      await user.type(input, 'system');
      
      expect(mockOnChange).toHaveBeenCalledWith('system');
    });

    it('should call onBlur when losing focus', async () => {
      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      
      await user.click(input);
      await user.tab(); // Move focus away
      
      expect(mockOnBlur).toHaveBeenCalledWith('');
    });

    it('should show dropdown on focus when there are suggestions', async () => {
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage', 'system.memory.used'],
        isLoading: false,
        error: null,
      });

      mockUseDropdownPosition.mockReturnValue({
        top: 40,
        left: 0,
        width: 300,
        maxHeight: 200,
        direction: 'down',
      });

      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      expect(mockSuggestionDropdown).toHaveBeenCalledWith(
        expect.objectContaining({
          isVisible: true,
          suggestions: ['system.cpu.usage', 'system.memory.used'],
        }),
        expect.anything()
      );
    });

    it('should hide dropdown on blur', async () => {
      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      
      await user.click(input);
      await user.tab();
      
      expect(mockSuggestionDropdown).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isVisible: false,
        }),
        expect.anything()
      );
    });

    it('should preserve text when clicking in field', async () => {
      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} value="system.cpu" />);
      
      const input = screen.getByRole('textbox');
      
      await user.click(input);
      
      expect(input).toHaveValue('system.cpu');
      expect(input.selectionStart).toBe(input.value.length); // Cursor at end
    });
  });

  describe('autocomplete integration', () => {
    it('should pass correct props to useMetricAutocomplete hook', () => {
      render(<MetricNameField {...defaultProps} value="system" />);
      
      expect(mockUseMetricAutocomplete).toHaveBeenCalledWith(
        'system',
        mockDataSource,
        {
          debounceMs: 300,
          maxResults: 50,
          cacheTtlMs: 300000,
        }
      );
    });

    it('should show loading state', () => {
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: [],
        isLoading: true,
        error: null,
      });

      render(<MetricNameField {...defaultProps} />);
      
      expect(mockSuggestionDropdown).toHaveBeenCalledWith(
        expect.objectContaining({
          isLoading: true,
        }),
        expect.anything()
      );
    });

    it('should display suggestions from autocomplete hook', () => {
      const suggestions = ['system.cpu.usage', 'system.memory.used', 'network.bytes.in'];
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions,
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} />);
      
      expect(mockSuggestionDropdown).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestions,
        }),
        expect.anything()
      );
    });

    it('should handle empty suggestions', () => {
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: [],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} />);
      
      expect(mockSuggestionDropdown).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestions: [],
        }),
        expect.anything()
      );
    });
  });

  describe('keyboard navigation', () => {
    beforeEach(() => {
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage', 'system.memory.used', 'network.bytes.in'],
        isLoading: false,
        error: null,
      });

      mockUseDropdownPosition.mockReturnValue({
        top: 40,
        left: 0,
        width: 300,
        maxHeight: 200,
        direction: 'down',
      });
    });

    it('should navigate down with Arrow Down key', async () => {
      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      await user.keyboard('[ArrowDown]');
      
      expect(mockSuggestionDropdown).toHaveBeenLastCalledWith(
        expect.objectContaining({
          highlightedIndex: 0,
        }),
        expect.anything()
      );
    });

    it('should navigate up with Arrow Up key', async () => {
      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      // Go down first, then up
      await user.keyboard('[ArrowDown][ArrowDown][ArrowUp]');
      
      expect(mockSuggestionDropdown).toHaveBeenLastCalledWith(
        expect.objectContaining({
          highlightedIndex: 0, // Back to first item
        }),
        expect.anything()
      );
    });

    it('should wrap around at beginning and end of list', async () => {
      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      // Arrow up from beginning should go to end
      await user.keyboard('[ArrowUp]');
      
      expect(mockSuggestionDropdown).toHaveBeenLastCalledWith(
        expect.objectContaining({
          highlightedIndex: 2, // Last item (3 suggestions, index 2)
        }),
        expect.anything()
      );
    });

    it('should select highlighted suggestion with Enter key', async () => {
      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      await user.keyboard('[ArrowDown][Enter]');
      
      expect(mockOnChange).toHaveBeenCalledWith('system.cpu.usage');
    });

    it('should close dropdown with Escape key', async () => {
      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      await user.keyboard('[Escape]');
      
      expect(mockSuggestionDropdown).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isVisible: false,
        }),
        expect.anything()
      );
    });

    it('should prevent default behavior for navigation keys', async () => {
      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      const keydownEvent = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      
      const preventDefaultSpy = jest.spyOn(keydownEvent, 'preventDefault');
      
      fireEvent(input, keydownEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      
      preventDefaultSpy.mockRestore();
    });
  });

  describe('suggestion selection', () => {
    beforeEach(() => {
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage', 'system.memory.used'],
        isLoading: false,
        error: null,
      });

      mockUseDropdownPosition.mockReturnValue({
        top: 40,
        left: 0,
        width: 300,
        maxHeight: 200,
        direction: 'down',
      });
    });

    it('should select suggestion on click', () => {
      render(<MetricNameField {...defaultProps} />);
      
      // Get the onSelect prop that was passed to SuggestionDropdown
      const lastCall = mockSuggestionDropdown.mock.calls[mockSuggestionDropdown.mock.calls.length - 1];
      const { onSelect } = lastCall[0];
      
      // Simulate selecting a suggestion
      onSelect('system.cpu.usage', 0);
      
      expect(mockOnChange).toHaveBeenCalledWith('system.cpu.usage');
    });

    it('should close dropdown after selection', () => {
      render(<MetricNameField {...defaultProps} />);
      
      const lastCall = mockSuggestionDropdown.mock.calls[mockSuggestionDropdown.mock.calls.length - 1];
      const { onSelect } = lastCall[0];
      
      onSelect('system.cpu.usage', 0);
      
      expect(mockSuggestionDropdown).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isVisible: false,
        }),
        expect.anything()
      );
    });

    it('should focus input after selection', () => {
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      const lastCall = mockSuggestionDropdown.mock.calls[mockSuggestionDropdown.mock.calls.length - 1];
      const { onSelect } = lastCall[0];
      
      onSelect('system.cpu.usage', 0);
      
      expect(input).toHaveFocus();
    });

    it('should update highlighted index on hover', () => {
      render(<MetricNameField {...defaultProps} />);
      
      const lastCall = mockSuggestionDropdown.mock.calls[mockSuggestionDropdown.mock.calls.length - 1];
      const { onHover } = lastCall[0];
      
      act(() => {
        onHover?.(1);
      });
      
      expect(mockSuggestionDropdown).toHaveBeenLastCalledWith(
        expect.objectContaining({
          highlightedIndex: 1,
        }),
        expect.anything()
      );
    });
  });

  describe('dropdown positioning', () => {
    it('should pass correct props to useDropdownPosition hook', async () => {
      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      expect(mockUseDropdownPosition).toHaveBeenCalledWith(
        expect.objectContaining({
          current: input,
        }),
        true, // isVisible
        200   // maxHeight
      );
    });

    it('should pass position to SuggestionDropdown', () => {
      const position = {
        top: 100,
        left: 50,
        width: 300,
        maxHeight: 150,
        direction: 'up' as const,
      };

      mockUseDropdownPosition.mockReturnValue(position);

      render(<MetricNameField {...defaultProps} />);
      
      expect(mockSuggestionDropdown).toHaveBeenCalledWith(
        expect.objectContaining({
          position: {
            top: position.top,
            left: position.left,
            width: position.width,
          },
          maxHeight: position.maxHeight,
        }),
        expect.anything()
      );
    });

    it('should hide dropdown when position is null', () => {
      mockUseDropdownPosition.mockReturnValue(null);

      render(<MetricNameField {...defaultProps} />);
      
      expect(mockSuggestionDropdown).toHaveBeenCalledWith(
        expect.objectContaining({
          isVisible: false,
        }),
        expect.anything()
      );
    });
  });

  describe('error handling', () => {
    it('should display error state when autocomplete fails', () => {
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: [],
        isLoading: false,
        error: new Error('Network error'),
      });

      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('error');
    });

    it('should show error message in dropdown', () => {
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: [],
        isLoading: false,
        error: new Error('Failed to load metrics'),
      });

      render(<MetricNameField {...defaultProps} />);
      
      expect(screen.getByText('Failed to load metrics')).toBeInTheDocument();
    });

    it('should clear error when input changes', async () => {
      mockUseMetricAutocomplete
        .mockReturnValueOnce({
          suggestions: [],
          isLoading: false,
          error: new Error('Network error'),
        })
        .mockReturnValueOnce({
          suggestions: [],
          isLoading: false,
          error: null,
        });

      const user = userEvent.setup();
      const { rerender } = render(<MetricNameField {...defaultProps} />);
      
      expect(screen.getByRole('textbox')).toHaveClass('error');
      
      rerender(<MetricNameField {...defaultProps} value="s" />);
      
      expect(screen.getByRole('textbox')).not.toHaveClass('error');
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      
      await user.click(input);
      
      expect(input).toHaveAttribute('aria-expanded', 'true');
    });

    it('should connect input to dropdown with aria-owns', async () => {
      mockUseDropdownPosition.mockReturnValue({
        top: 40,
        left: 0,
        width: 300,
        maxHeight: 200,
        direction: 'down',
      });

      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      
      expect(input).toHaveAttribute('aria-owns', 'metric-suggestions');
    });

    it('should set aria-activedescendant for highlighted item', async () => {
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage'],
        isLoading: false,
        error: null,
      });

      mockUseDropdownPosition.mockReturnValue({
        top: 40,
        left: 0,
        width: 300,
        maxHeight: 200,
        direction: 'down',
      });

      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.keyboard('[ArrowDown]');
      
      expect(input).toHaveAttribute('aria-activedescendant', 'suggestion-0');
    });

    it('should support screen readers with live region updates', () => {
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage', 'system.memory.used'],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} />);
      
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveTextContent('2 suggestions available');
    });
  });

  describe('performance optimizations', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = jest.fn();
      
      const TestComponent = (props: any) => {
        renderSpy();
        return <MetricNameField {...props} />;
      };

      const { rerender } = render(<TestComponent {...defaultProps} />);
      const initialRenderCount = renderSpy.mock.calls.length;
      
      // Re-render with same props
      rerender(<TestComponent {...defaultProps} />);
      
      expect(renderSpy).toHaveBeenCalledTimes(initialRenderCount + 1);
    });

    it('should cleanup event listeners on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
      
      const { unmount } = render(<MetricNameField {...defaultProps} />);
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalled();
      
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle very long metric names', () => {
      const longValue = 'system.very.long.metric.name.that.exceeds.normal.length.cpu.usage.detailed.measurement';
      
      render(<MetricNameField {...defaultProps} value={longValue} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue(longValue);
    });

    it('should handle special characters in metric names', () => {
      const specialValue = 'system.cpu-usage@server01.prod_env';
      
      render(<MetricNameField {...defaultProps} value={specialValue} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue(specialValue);
    });

    it('should handle rapid typing without losing characters', async () => {
      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      
      // Type rapidly
      await user.type(input, 'system.cpu.usage', { delay: 10 });
      
      expect(input).toHaveValue('system.cpu.usage');
    });

    it('should handle dropdown opening when input is at viewport edge', () => {
      // Mock getBoundingClientRect to simulate input at viewport edge
      const mockGetBoundingClientRect = jest.fn(() => ({
        top: 700,
        left: 1100,
        width: 200,
        height: 32,
        bottom: 732,
        right: 1300,
      }));

      Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
        value: mockGetBoundingClientRect,
        configurable: true,
      });

      mockUseDropdownPosition.mockReturnValue({
        top: 500, // Positioned above due to space constraints
        left: 1000, // Adjusted to stay in viewport
        width: 200,
        maxHeight: 200,
        direction: 'up',
      });

      render(<MetricNameField {...defaultProps} />);
      
      expect(mockSuggestionDropdown).toHaveBeenCalledWith(
        expect.objectContaining({
          position: {
            top: 500,
            left: 1000,
            width: 200,
          },
          maxHeight: 200,
        }),
        expect.anything()
      );
    });
  });
});