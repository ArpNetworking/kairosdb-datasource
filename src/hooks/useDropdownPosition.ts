import { useState, useEffect, useRef, RefObject } from 'react';

export interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  direction: 'up' | 'down';
}

/**
 * Hook for calculating optimal dropdown position relative to an input element
 * Handles viewport boundaries, scroll position, and dynamic updates
 */
export function useDropdownPosition(
  elementRef: RefObject<HTMLElement>,
  isVisible: boolean,
  requestedMaxHeight: number
): DropdownPosition | null {
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const requestRef = useRef<number>();

  // Use useRef to store the latest values without causing re-renders
  const paramsRef = useRef({ elementRef, isVisible, requestedMaxHeight });
  paramsRef.current = { elementRef, isVisible, requestedMaxHeight };

  useEffect(() => {
    const calculatePosition = () => {
      const { elementRef: currentElementRef, isVisible: currentIsVisible, requestedMaxHeight: currentRequestedMaxHeight } = paramsRef.current;
      
      if (!currentElementRef.current || !currentIsVisible) {
        setPosition(null);
        return;
      }

      const element = currentElementRef.current;
      const bounds = element.getBoundingClientRect();

      // Handle invalid bounds
      if (
        bounds.top === undefined ||
        bounds.left === undefined ||
        bounds.width === undefined ||
        bounds.height === undefined ||
        bounds.bottom === undefined ||
        bounds.right === undefined ||
        bounds.width <= 0 ||
        bounds.height <= 0
      ) {
        setPosition(null);
        return;
      }

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Calculate available space above and below the input
      const spaceAbove = bounds.top;
      const spaceBelow = viewportHeight - bounds.bottom;

      // Determine if dropdown should go up or down
      let direction: 'up' | 'down';
      let maxHeight: number;
      let top: number;

      if (spaceBelow >= currentRequestedMaxHeight) {
        // Enough space below - position down
        direction = 'down';
        maxHeight = Math.min(currentRequestedMaxHeight, spaceBelow);
        top = bounds.bottom;
      } else if (spaceAbove >= currentRequestedMaxHeight) {
        // Enough space above - position up  
        direction = 'up';
        maxHeight = Math.min(currentRequestedMaxHeight, spaceAbove);
        top = bounds.top - maxHeight;
      } else if (spaceBelow >= spaceAbove) {
        // Not enough space either way, but more space below
        direction = 'down';
        maxHeight = spaceBelow;
        top = bounds.bottom;
      } else {
        // More space above
        direction = 'up';
        maxHeight = spaceAbove;
        top = bounds.top - maxHeight;
      }

      // Handle horizontal positioning
      let left = bounds.left;
      let width = bounds.width;

      // Ensure dropdown doesn't extend past right edge of viewport
      if (left + width > viewportWidth) {
        left = viewportWidth - width;
      }

      // Ensure dropdown doesn't extend past left edge of viewport
      if (left < 0) {
        left = 0;
        // If we had to adjust left to 0, we might need to reduce width
        width = Math.min(width, viewportWidth);
      }

      const finalPosition = {
        top: Math.max(0, top),
        left: Math.max(0, left),
        width,
        maxHeight: Math.max(0, maxHeight),
        direction,
      };

      setPosition(finalPosition);
    };

    // Debounced update function for scroll/resize events
    const debouncedCalculatePosition = () => {
      // Cancel any pending calculation
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      
      // Schedule new calculation
      requestRef.current = requestAnimationFrame(calculatePosition);
    };

    // Initial calculation (debounced to prevent render loops)
    debouncedCalculatePosition();

    // Add event listeners for dynamic updates only if visible
    if (isVisible) {
      window.addEventListener('scroll', debouncedCalculatePosition, true);
      window.addEventListener('resize', debouncedCalculatePosition);

      return () => {
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }
        window.removeEventListener('scroll', debouncedCalculatePosition, true);
        window.removeEventListener('resize', debouncedCalculatePosition);
      };
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isVisible, requestedMaxHeight]); // Remove elementRef from dependencies to prevent loop

  return position;
}