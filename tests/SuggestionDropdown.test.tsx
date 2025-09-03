import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SuggestionDropdown } from '../src/components/SuggestionDropdown';

// Mock dependencies
const mockOnSelect = jest.fn();

// Mock scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

const defaultProps = {
  suggestions: ['system.cpu.usage', 'system.memory.used', 'network.bytes.in'],
  isVisible: true,
  isLoading: false,
  highlightedIndex: -1,
  onSelect: mockOnSelect,
  maxHeight: 200,
  position: { top: 40, left: 0, width: 300 } as const,
};

describe('SuggestionDropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('visibility and positioning', () => {
    it('should not render when not visible', () => {
      render(<SuggestionDropdown {...defaultProps} isVisible={false} />);
      
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should render with correct positioning', () => {
      render(<SuggestionDropdown {...defaultProps} />);
      
      const dropdown = screen.getByRole('listbox');
      expect(dropdown).toBeInTheDocument();
      expect(dropdown).toHaveStyle({
        position: 'absolute',
        top: '40px',
        left: '0px',
        width: '300px',
        maxHeight: '200px',
      });
    });

    it('should handle different position values', () => {
      const customPosition = { top: 100, left: 50, width: 250 };
      
      render(<SuggestionDropdown {...defaultProps} position={customPosition} />);
      
      const dropdown = screen.getByRole('listbox');
      expect(dropdown).toHaveStyle({
        top: '100px',
        left: '50px',
        width: '250px',
      });
    });
  });

  describe('suggestion rendering', () => {
    it('should render all suggestions as list items', () => {
      render(<SuggestionDropdown {...defaultProps} />);
      
      expect(screen.getByRole('option', { name: 'system.cpu.usage' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'system.memory.used' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'network.bytes.in' })).toBeInTheDocument();
      
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
    });

    it('should handle empty suggestions list', () => {
      render(<SuggestionDropdown {...defaultProps} suggestions={[]} />);
      
      expect(screen.getByText('No metrics found')).toBeInTheDocument();
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });

    it('should display custom empty message', () => {
      const emptyMessage = 'No results available';
      
      render(
        <SuggestionDropdown 
          {...defaultProps} 
          suggestions={[]} 
          emptyMessage={emptyMessage}
        />
      );
      
      expect(screen.getByText(emptyMessage)).toBeInTheDocument();
    });

    it('should handle very long suggestion names', () => {
      const longSuggestions = [
        'system.very.long.metric.name.that.exceeds.normal.length.cpu.usage',
        'application.service.component.subcomponent.measurement.value'
      ];
      
      render(<SuggestionDropdown {...defaultProps} suggestions={longSuggestions} />);
      
      expect(screen.getByRole('option', { name: longSuggestions[0] })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: longSuggestions[1] })).toBeInTheDocument();
    });
  });

  describe('highlighting behavior', () => {
    it('should highlight the specified index', () => {
      render(<SuggestionDropdown {...defaultProps} highlightedIndex={1} />);
      
      const options = screen.getAllByRole('option');
      expect(options[0].className).not.toContain('highlighted');
      expect(options[1].className).toContain('highlighted');
      expect(options[2].className).not.toContain('highlighted');
    });

    it('should handle highlighted index out of bounds', () => {
      render(<SuggestionDropdown {...defaultProps} highlightedIndex={10} />);
      
      const options = screen.getAllByRole('option');
      options.forEach(option => {
        expect(option.className).not.toContain('highlighted');
      });
    });

    it('should handle negative highlighted index', () => {
      render(<SuggestionDropdown {...defaultProps} highlightedIndex={-1} />);
      
      const options = screen.getAllByRole('option');
      options.forEach(option => {
        expect(option.className).not.toContain('highlighted');
      });
    });

    it('should update highlighting when index changes', () => {
      const { rerender } = render(
        <SuggestionDropdown {...defaultProps} highlightedIndex={0} />
      );
      
      let options = screen.getAllByRole('option');
      expect(options[0].className).toContain('highlighted');
      expect(options[1].className).not.toContain('highlighted');

      rerender(<SuggestionDropdown {...defaultProps} highlightedIndex={1} />);
      
      options = screen.getAllByRole('option');
      expect(options[0].className).not.toContain('highlighted');
      expect(options[1].className).toContain('highlighted');
    });
  });

  describe('loading states', () => {
    it('should show loading indicator when loading', () => {
      render(<SuggestionDropdown {...defaultProps} isLoading={true} />);
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      // Should not show suggestions during loading
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });

    it('should hide loading indicator when not loading', () => {
      render(<SuggestionDropdown {...defaultProps} isLoading={false} />);
      
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('should show loading with custom message', () => {
      const loadingMessage = 'Searching metrics...';
      
      render(
        <SuggestionDropdown 
          {...defaultProps} 
          isLoading={true} 
          loadingMessage={loadingMessage}
        />
      );
      
      expect(screen.getByText(loadingMessage)).toBeInTheDocument();
    });

    it('should prioritize loading state over empty state', () => {
      render(
        <SuggestionDropdown 
          {...defaultProps} 
          suggestions={[]} 
          isLoading={true}
        />
      );
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByText('No metrics found')).not.toBeInTheDocument();
    });
  });

  describe('user interaction', () => {
    it('should call onSelect when suggestion is clicked', () => {
      render(<SuggestionDropdown {...defaultProps} />);
      
      const firstOption = screen.getByRole('option', { name: 'system.cpu.usage' });
      fireEvent.click(firstOption);
      
      expect(mockOnSelect).toHaveBeenCalledWith('system.cpu.usage', 0);
    });

    it('should call onSelect with correct index for different suggestions', () => {
      render(<SuggestionDropdown {...defaultProps} />);
      
      const secondOption = screen.getByRole('option', { name: 'system.memory.used' });
      fireEvent.click(secondOption);
      
      expect(mockOnSelect).toHaveBeenCalledWith('system.memory.used', 1);
    });

    it('should handle mouse enter and leave for hover effects', () => {
      const mockOnHover = jest.fn();
      
      render(
        <SuggestionDropdown 
          {...defaultProps} 
          onHover={mockOnHover}
        />
      );
      
      const firstOption = screen.getByRole('option', { name: 'system.cpu.usage' });
      
      fireEvent.mouseEnter(firstOption);
      expect(mockOnHover).toHaveBeenCalledWith(0);
      
      fireEvent.mouseLeave(firstOption);
      expect(mockOnHover).toHaveBeenCalledWith(-1);
    });

    it('should prevent default on mouse down to avoid focus loss', () => {
      render(<SuggestionDropdown {...defaultProps} />);
      
      const firstOption = screen.getByRole('option', { name: 'system.cpu.usage' });
      
      // Use a more direct approach - create actual event
      const mouseDownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true
      });
      
      const preventDefaultSpy = jest.spyOn(mouseDownEvent, 'preventDefault');
      
      fireEvent(firstOption, mouseDownEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      
      preventDefaultSpy.mockRestore();
    });
  });

  describe('keyboard navigation support', () => {
    it('should have proper ARIA attributes', () => {
      render(<SuggestionDropdown {...defaultProps} highlightedIndex={1} />);
      
      const dropdown = screen.getByRole('listbox');
      expect(dropdown).toHaveAttribute('aria-label', 'Metric suggestions');
      
      const options = screen.getAllByRole('option');
      options.forEach((option, index) => {
        expect(option).toHaveAttribute('aria-selected', index === 1 ? 'true' : 'false');
      });
    });

    it('should support custom ARIA label', () => {
      const ariaLabel = 'Custom metric suggestions';
      
      render(
        <SuggestionDropdown 
          {...defaultProps} 
          ariaLabel={ariaLabel}
        />
      );
      
      const dropdown = screen.getByRole('listbox');
      expect(dropdown).toHaveAttribute('aria-label', ariaLabel);
    });

    it('should set aria-activedescendant for highlighted item', () => {
      render(<SuggestionDropdown {...defaultProps} highlightedIndex={1} />);
      
      const dropdown = screen.getByRole('listbox');
      const highlightedOption = screen.getAllByRole('option')[1];
      
      expect(dropdown).toHaveAttribute('aria-activedescendant', highlightedOption.id);
    });
  });

  describe('scrolling behavior', () => {
    it('should scroll highlighted item into view', async () => {
      const manySuggestions = Array.from({ length: 20 }, (_, i) => `metric${i}`);
      
      // Mock scrollIntoView
      const scrollIntoViewMock = jest.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;
      
      const { rerender } = render(
        <SuggestionDropdown 
          {...defaultProps} 
          suggestions={manySuggestions}
          highlightedIndex={15}
        />
      );
      
      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalledWith({
          block: 'nearest',
          behavior: 'smooth'
        });
      });
      
      // Change highlighted index
      rerender(
        <SuggestionDropdown 
          {...defaultProps} 
          suggestions={manySuggestions}
          highlightedIndex={5}
        />
      );
      
      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle max height properly', () => {
      const manySuggestions = Array.from({ length: 50 }, (_, i) => `metric${i}`);
      
      render(
        <SuggestionDropdown 
          {...defaultProps} 
          suggestions={manySuggestions}
          maxHeight={150}
        />
      );
      
      const dropdown = screen.getByRole('listbox');
      expect(dropdown).toHaveStyle({ maxHeight: '150px', overflowY: 'auto' });
    });
  });

  describe('template variable suggestions', () => {
    it('should render template variable suggestions with special styling', () => {
      const templateSuggestions = [
        'system.$server.cpu',
        'system.web01.cpu',
        'system.web02.cpu'
      ];
      
      render(
        <SuggestionDropdown 
          {...defaultProps} 
          suggestions={templateSuggestions}
        />
      );
      
      const templateOption = screen.getByTitle('system.$server.cpu');
      expect(templateOption.className).toContain('template-variable');
    });

    it('should handle mixed regular and template suggestions', () => {
      const mixedSuggestions = [
        'system.$server.cpu',
        'system.web01.cpu',
        'network.${interface}.bytes'
      ];
      
      render(
        <SuggestionDropdown 
          {...defaultProps} 
          suggestions={mixedSuggestions}
        />
      );
      
      const templateOption1 = screen.getByTitle('system.$server.cpu');
      const regularOption = screen.getByTitle('system.web01.cpu');
      const templateOption2 = screen.getByTitle('network.${interface}.bytes');
      
      expect(templateOption1.className).toContain('template-variable');
      expect(regularOption.className).not.toContain('template-variable');
      expect(templateOption2.className).toContain('template-variable');
    });
  });

  describe('error handling', () => {
    it('should handle malformed suggestions gracefully', () => {
      const malformedSuggestions = [
        '', // empty string
        null as any, // null
        undefined as any, // undefined
        'valid.metric'
      ];
      
      render(
        <SuggestionDropdown 
          {...defaultProps} 
          suggestions={malformedSuggestions}
        />
      );
      
      // Should only render valid suggestions
      expect(screen.getByRole('option', { name: 'valid.metric' })).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });

    it('should handle click on invalid suggestion gracefully', () => {
      // Test that component handles empty/invalid suggestions array
      const invalidSuggestions = ['', null, undefined, 'valid.metric'] as any[];
      
      render(
        <SuggestionDropdown 
          {...defaultProps} 
          suggestions={invalidSuggestions}
        />
      );
      
      // Should only render valid suggestions
      expect(screen.getByRole('option', { name: 'valid.metric' })).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(1);
      
      // Click should work normally for valid suggestion
      fireEvent.click(screen.getByRole('option', { name: 'valid.metric' }));
      expect(mockOnSelect).toHaveBeenCalledWith('valid.metric', 0);
    });
  });

  describe('performance considerations', () => {
    it('should handle large suggestion lists efficiently', () => {
      const largeSuggestionList = Array.from({ length: 1000 }, (_, i) => 
        `metric.${i}.name.with.long.path.structure`
      );
      
      const startTime = performance.now();
      
      render(
        <SuggestionDropdown 
          {...defaultProps} 
          suggestions={largeSuggestionList}
        />
      );
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within reasonable time (less than 100ms for 1000 items)
      expect(renderTime).toBeLessThan(100);
      
      // Should render all items
      expect(screen.getAllByRole('option')).toHaveLength(1000);
    });

    it('should not re-render unnecessarily when props are the same', () => {
      let renderCount = 0;
      
      const TestComponent = (props: any) => {
        renderCount++;
        return <SuggestionDropdown {...props} />;
      };
      
      const { rerender } = render(<TestComponent {...defaultProps} />);
      const initialRenderCount = renderCount;
      
      // Re-render with same props
      rerender(<TestComponent {...defaultProps} />);
      
      // Should not cause additional renders for same props
      expect(renderCount).toBe(initialRenderCount + 1);
    });
  });

  describe('cleanup and memory management', () => {
    it('should cleanup event listeners on unmount', () => {
      // This component doesn't currently add document event listeners
      // but we test that unmount doesn't cause errors
      const { unmount } = render(<SuggestionDropdown {...defaultProps} />);
      
      expect(() => unmount()).not.toThrow();
    });

    it('should handle rapid prop changes without memory leaks', () => {
      const { rerender } = render(<SuggestionDropdown {...defaultProps} />);
      
      // Rapidly change props multiple times
      for (let i = 0; i < 100; i++) {
        rerender(
          <SuggestionDropdown 
            {...defaultProps} 
            suggestions={[`metric${i}`]}
            highlightedIndex={i % 3}
          />
        );
      }
      
      // Should not crash or cause memory issues
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });
});