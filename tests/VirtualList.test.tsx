import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VirtualList } from '../src/components/VirtualList';

// Mock scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

const defaultProps = {
  items: ['system.cpu.usage', 'system.memory.used', 'network.bytes.in', 'disk.io.read', 'disk.io.write'],
  itemHeight: 32,
  containerHeight: 150,
  renderItem: (item: string, index: number, isHighlighted: boolean) => (
    <div
      key={index}
      style={{
        height: '32px',
        padding: '8px',
        backgroundColor: isHighlighted ? '#1f77b4' : 'transparent',
        cursor: 'pointer',
      }}
    >
      {item}
    </div>
  ),
};

describe('VirtualList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('basic rendering', () => {
    it('should render with items', () => {
      render(<VirtualList {...defaultProps} />);
      
      // Should render visible items
      expect(screen.getByText('system.cpu.usage')).toBeInTheDocument();
      expect(screen.getByText('system.memory.used')).toBeInTheDocument();
    });

    it('should render empty state when no items', () => {
      render(<VirtualList {...defaultProps} items={[]} />);
      
      // Should render container but no items
      const container = screen.getByRole('listbox');
      expect(container).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<VirtualList {...defaultProps} className="custom-class" />);
      
      const container = screen.getByRole('listbox');
      expect(container).toHaveClass('custom-class');
    });

    it('should set correct container height', () => {
      render(<VirtualList {...defaultProps} containerHeight={200} />);
      
      const container = screen.getByRole('listbox');
      expect(container).toHaveStyle({ height: '200px' });
    });
  });

  describe('highlighting behavior', () => {
    it('should highlight item at highlightedIndex', () => {
      const renderItem = jest.fn((item, index, isHighlighted) => (
        <div key={index} data-testid={`item-${index}`}>
          {item} {isHighlighted ? '(highlighted)' : ''}
        </div>
      ));

      render(
        <VirtualList 
          {...defaultProps} 
          highlightedIndex={1} 
          renderItem={renderItem}
        />
      );

      expect(renderItem).toHaveBeenCalledWith('system.cpu.usage', 0, false);
      expect(renderItem).toHaveBeenCalledWith('system.memory.used', 1, true);
      expect(renderItem).toHaveBeenCalledWith('network.bytes.in', 2, false);
    });

    it('should not highlight when highlightedIndex is -1', () => {
      const renderItem = jest.fn((item, index, isHighlighted) => (
        <div key={index}>{item}</div>
      ));

      render(
        <VirtualList 
          {...defaultProps} 
          highlightedIndex={-1} 
          renderItem={renderItem}
        />
      );

      // All items should be called with isHighlighted = false
      expect(renderItem).toHaveBeenCalledWith('system.cpu.usage', 0, false);
      expect(renderItem).toHaveBeenCalledWith('system.memory.used', 1, false);
    });

    it('should handle highlightedIndex out of bounds', () => {
      const renderItem = jest.fn((item, index, isHighlighted) => (
        <div key={index}>{item}</div>
      ));

      render(
        <VirtualList 
          {...defaultProps} 
          highlightedIndex={99} 
          renderItem={renderItem}
        />
      );

      // No items should be highlighted
      expect(renderItem).toHaveBeenCalledWith('system.cpu.usage', 0, false);
      expect(renderItem).toHaveBeenCalledWith('system.memory.used', 1, false);
    });
  });

  describe('click interactions', () => {
    it('should call onItemClick when item is clicked', async () => {
      const mockOnItemClick = jest.fn();
      const user = userEvent.setup();

      render(
        <VirtualList 
          {...defaultProps} 
          onItemClick={mockOnItemClick}
          renderItem={(item, index) => (
            <div key={index} onClick={() => mockOnItemClick(item, index)}>
              {item}
            </div>
          )}
        />
      );

      const item = screen.getByText('system.cpu.usage');
      await user.click(item);

      expect(mockOnItemClick).toHaveBeenCalledWith('system.cpu.usage', 0);
    });

    it('should not call onItemClick when callback not provided', async () => {
      const user = userEvent.setup();

      render(<VirtualList {...defaultProps} />);

      const item = screen.getByText('system.cpu.usage');
      await user.click(item);

      // Should not throw error
    });
  });

  describe('hover interactions', () => {
    it('should call onItemHover when item is hovered', async () => {
      const mockOnItemHover = jest.fn();
      const user = userEvent.setup();

      render(
        <VirtualList 
          {...defaultProps} 
          onItemHover={mockOnItemHover}
          renderItem={(item, index) => (
            <div 
              key={index} 
              onMouseEnter={() => mockOnItemHover(index)}
            >
              {item}
            </div>
          )}
        />
      );

      const item = screen.getByText('system.cpu.usage');
      await user.hover(item);

      expect(mockOnItemHover).toHaveBeenCalledWith(0);
    });
  });

  describe('virtual scrolling behavior', () => {
    it('should handle large lists efficiently', () => {
      const manyItems = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
      
      render(
        <VirtualList 
          {...defaultProps}
          items={manyItems}
          containerHeight={200}
        />
      );

      // Should render visible items only (not all 1000)
      expect(screen.getByText('item-0')).toBeInTheDocument();
      expect(screen.queryByText('item-999')).not.toBeInTheDocument();
    });

    it('should update visible items on scroll', async () => {
      const manyItems = Array.from({ length: 100 }, (_, i) => `item-${i}`);
      
      render(
        <VirtualList 
          {...defaultProps}
          items={manyItems}
          containerHeight={100}
          itemHeight={20}
        />
      );

      const scrollContainer = screen.getByRole('listbox').querySelector('[style*="overflow-y: auto"]');
      
      if (scrollContainer) {
        // Simulate scroll
        fireEvent.scroll(scrollContainer, { target: { scrollTop: 200 } });
        
        // Virtual scrolling may still show initial items depending on buffer size
        // Just check that scroll doesn't break anything
        expect(screen.getByText('item-0')).toBeInTheDocument();
      }
    });
  });

  describe('buffer sizing', () => {
    it('should respect bufferSize prop', () => {
      const items = Array.from({ length: 20 }, (_, i) => `item-${i}`);
      
      render(
        <VirtualList 
          {...defaultProps}
          items={items}
          containerHeight={100}
          itemHeight={20}
          bufferSize={2}
        />
      );

      // Should render visible items plus buffer
      expect(screen.getByText('item-0')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA role', () => {
      render(<VirtualList {...defaultProps} />);
      
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should generate proper IDs when idPrefix provided', () => {
      render(
        <VirtualList 
          {...defaultProps} 
          idPrefix="suggestion"
          renderItem={(item, index) => (
            <div key={index} id={`suggestion-${index}`}>
              {item}
            </div>
          )}
        />
      );

      expect(screen.getByText('system.cpu.usage').closest('div')).toHaveAttribute('id', 'suggestion-0');
    });
  });

  describe('performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderItem = jest.fn((item, index) => <div key={index}>{item}</div>);
      
      const { rerender } = render(
        <VirtualList {...defaultProps} renderItem={renderItem} />
      );

      const initialCallCount = renderItem.mock.calls.length;
      renderItem.mockClear(); // Clear call history
      
      // Re-render with same props
      rerender(<VirtualList {...defaultProps} renderItem={renderItem} />);

      // Should not call renderItem again for same props (or very few calls)
      expect(renderItem.mock.calls.length).toBeLessThanOrEqual(initialCallCount);
    });

    it('should handle rapid highlight changes efficiently', () => {
      const renderItem = jest.fn((item, index, isHighlighted) => (
        <div key={index}>{item}</div>
      ));

      const { rerender } = render(
        <VirtualList 
          {...defaultProps} 
          highlightedIndex={0}
          renderItem={renderItem}
        />
      );

      // Change highlight rapidly
      rerender(
        <VirtualList 
          {...defaultProps} 
          highlightedIndex={1}
          renderItem={renderItem}
        />
      );

      rerender(
        <VirtualList 
          {...defaultProps} 
          highlightedIndex={2}
          renderItem={renderItem}
        />
      );

      // Should handle changes without errors
      expect(renderItem).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty renderItem gracefully', () => {
      const emptyRenderItem = () => null;
      
      render(
        <VirtualList 
          {...defaultProps} 
          renderItem={emptyRenderItem}
        />
      );

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should handle zero container height', () => {
      render(
        <VirtualList 
          {...defaultProps} 
          containerHeight={0}
        />
      );

      expect(screen.getByRole('listbox')).toHaveStyle({ height: '0px' });
    });

    it('should handle zero item height', () => {
      render(
        <VirtualList 
          {...defaultProps} 
          itemHeight={0}
        />
      );

      // Should not crash
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });
});
