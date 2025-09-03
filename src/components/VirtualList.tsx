import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

export interface VirtualListProps {
  /** Array of items to render */
  items: string[];
  /** Height of each item in pixels */
  itemHeight: number;
  /** Height of the container in pixels */
  containerHeight: number;
  /** Function to render each item */
  renderItem: (item: string, index: number, isHighlighted: boolean) => React.ReactNode;
  /** Currently highlighted index */
  highlightedIndex?: number;
  /** Callback when an item is clicked */
  onItemClick?: (item: string, index: number) => void;
  /** Callback when an item is hovered */
  onItemHover?: (index: number) => void;
  /** Additional CSS classes */
  className?: string;
  /** Buffer size - number of items to render outside visible area (per side) */
  bufferSize?: number;
  /** ID prefix for accessibility */
  idPrefix?: string;
}

interface VirtualListStyles {
  container: string;
  viewport: string;
  content: string;
}

const getStyles = (theme: GrafanaTheme2): VirtualListStyles => ({
  container: `
    position: relative;
    overflow: hidden;
    border: 1px solid ${theme.colors.border.medium};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.primary};
  `,
  viewport: `
    position: relative;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
  `,
  content: `
    position: relative;
    width: 100%;
  `,
});

/**
 * High-performance virtual scrolling list component
 * Renders only visible items + buffer for optimal performance with large datasets
 */
export const VirtualList: React.FC<VirtualListProps> = ({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  highlightedIndex = -1,
  onItemClick,
  onItemHover,
  className = '',
  bufferSize = 10,
  idPrefix = 'virtual-item',
}) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate virtual scrolling parameters
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
  const endIndex = Math.min(items.length, startIndex + visibleCount + bufferSize * 2);
  const offsetY = startIndex * itemHeight;

  // Get visible items
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  // Handle scroll events (will be defined below)

  // Handle item click
  const handleItemClick = useCallback((item: string, relativeIndex: number) => {
    const actualIndex = startIndex + relativeIndex;
    onItemClick?.(item, actualIndex);
  }, [startIndex, onItemClick]);

  // Handle item hover
  const handleItemHover = useCallback((relativeIndex: number) => {
    const actualIndex = startIndex + relativeIndex;
    onItemHover?.(actualIndex);
  }, [startIndex, onItemHover]);

  // Track if scroll is from user interaction vs programmatic
  const isUserScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Enhanced scroll handler that distinguishes user vs programmatic scroll
  const handleScrollWithTracking = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const newScrollTop = target.scrollTop;
    
    // Update scroll position immediately
    setScrollTop(newScrollTop);
    
    // Mark as user scroll and clear any existing timeout
    isUserScrollRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Clear user scroll flag after scrolling settles
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollRef.current = false;
    }, 150);
  }, []);
  
  // Assign the enhanced scroll handler
  const handleScroll = handleScrollWithTracking;
  
  // Scroll to highlighted item if it's outside visible area (only for keyboard navigation)
  useEffect(() => {
    if (highlightedIndex >= 0 && viewportRef.current && !isUserScrollRef.current) {
      const itemTop = highlightedIndex * itemHeight;
      const itemBottom = itemTop + itemHeight;
      const viewportTop = scrollTop;
      const viewportBottom = scrollTop + containerHeight;

      if (itemTop < viewportTop) {
        // Item is above visible area - scroll to top of item
        viewportRef.current.scrollTop = itemTop;
        setScrollTop(itemTop);
      } else if (itemBottom > viewportBottom) {
        // Item is below visible area - scroll to show item at bottom
        const newScrollTop = itemBottom - containerHeight;
        viewportRef.current.scrollTop = newScrollTop;
        setScrollTop(newScrollTop);
      }
    }
  }, [highlightedIndex, itemHeight, scrollTop, containerHeight]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={className}
      role="listbox"
      aria-multiselectable={false}
      style={{
        height: containerHeight,
        ...parseStyleString(styles.container)
      }}
    >
      <div
        ref={viewportRef}
        style={{
          ...parseStyleString(styles.viewport)
        }}
        onScroll={handleScroll}
      >
        <div
          style={{
            ...parseStyleString(styles.content),
            height: totalHeight,
          }}
        >
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            {visibleItems.map((item, relativeIndex) => {
              const actualIndex = startIndex + relativeIndex;
              const isHighlighted = actualIndex === highlightedIndex;
              
              return (
                <div
                  key={actualIndex}
                  id={`${idPrefix}-${actualIndex}`}
                  role="option"
                  aria-selected={isHighlighted}
                  style={{
                    height: itemHeight,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleItemClick(item, relativeIndex)}
                  onMouseEnter={() => handleItemHover(relativeIndex)}
                >
                  {renderItem(item, actualIndex, isHighlighted)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Helper function to parse CSS-in-JS style strings into objects
 * Converts template literal styles to React style objects
 */
function parseStyleString(styleString: string): React.CSSProperties {
  const styles: React.CSSProperties = {};
  
  // Split by semicolon and process each declaration
  const declarations = styleString.split(';').map(d => d.trim()).filter(Boolean);
  
  for (const declaration of declarations) {
    const [property, value] = declaration.split(':').map(s => s.trim());
    if (property && value) {
      // Convert kebab-case to camelCase
      const camelProperty = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      styles[camelProperty as keyof React.CSSProperties] = value as any;
    }
  }
  
  return styles;
}

export default VirtualList;