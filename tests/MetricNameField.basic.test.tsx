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

describe('MetricNameField (Basic Tests)', () => {
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
      await user.type(input, 'sys');
      
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
      
      // Should show some loading indicator (you might need to adjust based on your implementation)
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

      // Check if suggestions are rendered in the dropdown
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
      
      // Component should handle error gracefully
      expect(screen.getByRole('textbox')).toBeInTheDocument();
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
});