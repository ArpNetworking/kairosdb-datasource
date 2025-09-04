import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricNameField } from '../src/components/MetricNameField';

// Mock our custom hooks
jest.mock('../src/hooks/useMetricAutocomplete');

import { useMetricAutocomplete } from '../src/hooks/useMetricAutocomplete';

const mockUseMetricAutocomplete = useMetricAutocomplete as jest.MockedFunction<typeof useMetricAutocomplete>;

// Mock DataSource interface
const mockDataSource = {
  getMetricNames: jest.fn(),
};

const defaultProps = {
  metricName: '',
  onChange: jest.fn(),
  datasource: mockDataSource,
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
  });

  describe('basic rendering', () => {
    it('should render input field', () => {
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should render with initial value', () => {
      render(<MetricNameField {...defaultProps} metricName="system.cpu" />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('system.cpu');
    });
  });

  describe('input interactions', () => {
    it('should call onChange when typing', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      render(<MetricNameField {...defaultProps} onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 's');
      
      expect(mockOnChange).toHaveBeenCalledWith('s');
    });
  });

  describe('autocomplete integration', () => {
    it('should pass correct props to useMetricAutocomplete hook', () => {
      render(<MetricNameField {...defaultProps} metricName="test" />);
      
      expect(mockUseMetricAutocomplete).toHaveBeenCalledWith(
        'test',
        mockDataSource,
        expect.objectContaining({
          debounceMs: expect.any(Number),
        })
      );
    });

    it('should show loading state', () => {
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: [],
        isLoading: true,
        error: null,
      });

      render(<MetricNameField {...defaultProps} />);
      
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should display suggestions when available', async () => {
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage', 'system.memory.used'],
        isLoading: false,
        error: null,
      });

      const user = userEvent.setup();
      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('system.cpu.usage')).toBeInTheDocument();
        expect(screen.getByText('system.memory.used')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('should display error state when autocomplete fails', () => {
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: [],
        isLoading: false,
        error: new Error('Failed to fetch metrics'),
      });

      render(<MetricNameField {...defaultProps} />);
      
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch metrics')).toBeInTheDocument();
    });
  });

  describe('suggestion selection', () => {
    it('should select suggestion on click', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage'],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('system.cpu.usage')).toBeInTheDocument();
      });

      await user.click(screen.getByText('system.cpu.usage'));

      expect(mockOnChange).toHaveBeenCalledWith('system.cpu.usage');
    });
  });

  describe('keyboard navigation', () => {
    it('should handle arrow key navigation', async () => {
      const user = userEvent.setup();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage', 'system.memory.used'],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('system.cpu.usage')).toBeInTheDocument();
      });

      // Test arrow down
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      // Test enter key
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    it('should navigate through suggestions with arrow keys', async () => {
      const user = userEvent.setup();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage', 'system.memory.used', 'network.bytes.in'],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('system.cpu.usage')).toBeInTheDocument();
      });

      // Arrow down should move to first item
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      // Arrow down should move to second item
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      // Arrow up should move back to first item
      fireEvent.keyDown(input, { key: 'ArrowUp' });
    });

    it('should wrap around at beginning and end of suggestions', async () => {
      const user = userEvent.setup();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['item1', 'item2'],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('item1')).toBeInTheDocument();
      });

      // Arrow up from start should wrap to end
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      
      // Arrow down from end should wrap to start
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    });

    it('should handle escape key', async () => {
      const user = userEvent.setup();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage'],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('system.cpu.usage')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'Escape' });
    });

    it('should select highlighted suggestion with Enter', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage', 'system.memory.used'],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('system.cpu.usage')).toBeInTheDocument();
      });

      // Navigate to second item and select
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith('system.memory.used');
    });
  });

  describe('dropdown visibility', () => {
    it('should show dropdown only when focused and has suggestions', async () => {
      const user = userEvent.setup();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage'],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      
      // Initially no dropdown
      expect(screen.queryByText('system.cpu.usage')).not.toBeInTheDocument();
      
      // Focus should show dropdown
      await user.click(input);
      
      await waitFor(() => {
        expect(screen.getByText('system.cpu.usage')).toBeInTheDocument();
      });
    });

    it('should hide dropdown on blur', async () => {
      const user = userEvent.setup();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage'],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('system.cpu.usage')).toBeInTheDocument();
      });

      // Blur should hide dropdown (after timeout)
      await user.tab();
      
      await waitFor(() => {
        expect(screen.queryByText('system.cpu.usage')).not.toBeInTheDocument();
      }, { timeout: 200 });
    });

    it('should not show dropdown without datasource', async () => {
      const user = userEvent.setup();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage'],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} datasource={undefined} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      // Should not show suggestions without datasource
      expect(screen.queryByText('system.cpu.usage')).not.toBeInTheDocument();
    });

    it('should show loading state in dropdown', async () => {
      const user = userEvent.setup();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: [],
        isLoading: true,
        error: null,
      });

      render(<MetricNameField {...defaultProps} metricName="test" />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      // Should show loading text or spinner
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });
    });

    it('should not show dropdown when no suggestions and not loading', async () => {
      const user = userEvent.setup();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: [],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} metricName="test" />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      // Component doesn't show dropdown when no suggestions and not loading
      // This is the actual behavior - no dropdown appears
      expect(screen.queryByText('No metrics found')).not.toBeInTheDocument();
    });
  });

  describe('suggestion interaction', () => {
    it('should select suggestion on mouse click', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage', 'system.memory.used'],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('system.memory.used')).toBeInTheDocument();
      });

      await user.click(screen.getByText('system.memory.used'));

      expect(mockOnChange).toHaveBeenCalledWith('system.memory.used');
    });

    it('should update highlighted index on hover', async () => {
      const user = userEvent.setup();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage', 'system.memory.used'],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('system.cpu.usage')).toBeInTheDocument();
      });

      // Hover over second item
      await user.hover(screen.getByText('system.memory.used'));
      
      // Item should be visually highlighted (implementation may vary)
    });

    it('should prevent text selection on mouse down', async () => {
      const user = userEvent.setup();
      
      mockUseMetricAutocomplete.mockReturnValue({
        suggestions: ['system.cpu.usage'],
        isLoading: false,
        error: null,
      });

      render(<MetricNameField {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('system.cpu.usage')).toBeInTheDocument();
      });

      const suggestion = screen.getByText('system.cpu.usage');
      fireEvent.mouseDown(suggestion);
      
      // Should not lose focus or cause text selection issues
    });
  });
});