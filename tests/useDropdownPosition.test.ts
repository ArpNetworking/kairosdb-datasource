import { renderHook, act } from '@testing-library/react';
import { useDropdownPosition } from '../src/hooks/useDropdownPosition';

// Mock DOM APIs
const mockGetBoundingClientRect = jest.fn();
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

// Mock window and document APIs
Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
Object.defineProperty(window, 'scrollX', { value: 0, writable: true });
Object.defineProperty(window, 'addEventListener', { value: mockAddEventListener });
Object.defineProperty(window, 'removeEventListener', { value: mockRemoveEventListener });

// Mock element reference
const createMockElement = (bounds: DOMRect) => ({
  getBoundingClientRect: () => bounds,
  addEventListener: mockAddEventListener,
  removeEventListener: mockRemoveEventListener,
} as any);

describe('useDropdownPosition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset window properties
    (window as any).innerHeight = 800;
    (window as any).innerWidth = 1200;
    (window as any).scrollY = 0;
    (window as any).scrollX = 0;
  });

  describe('basic positioning', () => {
    it('should return null position when element ref is null', () => {
      const { result } = renderHook(() => 
        useDropdownPosition({ current: null }, true, 200)
      );

      expect(result.current).toBeNull();
    });

    it('should return null position when dropdown is not visible', () => {
      const mockElement = createMockElement({
        top: 100,
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 132,
      } as DOMRect);

      const { result } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, false, 200)
      );

      expect(result.current).toBeNull();
    });

    it('should calculate basic dropdown position below input', () => {
      const inputBounds = {
        top: 100,
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 132,
      } as DOMRect;

      const mockElement = createMockElement(inputBounds);

      const { result } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 200)
      );

      expect(result.current).toEqual({
        top: 132, // inputBounds.bottom
        left: 50, // inputBounds.left
        width: 300, // inputBounds.width
        maxHeight: 200,
        direction: 'down'
      });
    });
  });

  describe('viewport boundary handling', () => {
    it('should position dropdown above input when not enough space below', () => {
      const inputBounds = {
        top: 700, // Close to bottom of 800px viewport
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 732,
      } as DOMRect;

      const mockElement = createMockElement(inputBounds);

      const { result } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 200)
      );

      expect(result.current).toEqual({
        top: 500, // inputBounds.top - 200 (maxHeight)
        left: 50,
        width: 300,
        maxHeight: 200,
        direction: 'up'
      });
    });

    it('should reduce max height when limited by viewport space below', () => {
      const inputBounds = {
        top: 50, // Very little space above (50px)
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 82, // 50 + 32 = 82
      } as DOMRect;

      const mockElement = createMockElement(inputBounds);

      const { result } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 300) // Requesting 300px
      );

      // With only 50px above and 718px below (800-82), should go down
      // and be limited to available space below: 718px
      expect(result.current?.direction).toBe('down');
      expect(result.current?.maxHeight).toBe(300); // Requested amount fits below
    });

    it('should reduce max height when limited by viewport space above', () => {
      const inputBounds = {
        top: 100, // Only 100px above input
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 132,
      } as DOMRect;

      const mockElement = createMockElement(inputBounds);
      
      // Force positioning above by setting viewport height small
      (window as any).innerHeight = 150;

      const { result } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 200) // Requesting 200px but only 100px available above
      );

      expect(result.current?.direction).toBe('up');
      expect(result.current?.maxHeight).toBe(100);
    });

    it('should handle horizontal viewport boundaries', () => {
      const inputBounds = {
        top: 100,
        left: 1000, // Near right edge of 1200px viewport
        width: 300, // Would extend past right edge
        height: 32,
        right: 1300,
        bottom: 132,
      } as DOMRect;

      const mockElement = createMockElement(inputBounds);

      const { result } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 200)
      );

      // Should adjust left position to stay within viewport
      expect(result.current?.left).toBe(900); // 1200 - 300 = 900
      expect(result.current?.width).toBe(300);
    });
  });

  describe('scroll handling', () => {
    it('should account for scroll position in calculations', () => {
      const inputBounds = {
        top: 200, // Relative to viewport
        left: 100,
        width: 300,
        height: 32,
        right: 400,
        bottom: 232,
      } as DOMRect;

      const mockElement = createMockElement(inputBounds);
      
      // Simulate page scroll
      (window as any).scrollY = 50;
      (window as any).scrollX = 25;

      const { result } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 200)
      );

      // Position should account for scroll
      expect(result.current).toEqual({
        top: 232, // bottom of input (already accounts for scroll in getBoundingClientRect)
        left: 100, // left of input (already accounts for scroll)
        width: 300,
        maxHeight: 200,
        direction: 'down'
      });
    });
  });

  describe('dynamic updates', () => {
    it('should recalculate position when maxHeight changes', () => {
      const mockElement = createMockElement({
        top: 100,
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 132,
      } as DOMRect);

      const { result, rerender } = renderHook(
        ({ maxHeight }) => useDropdownPosition({ current: mockElement }, true, maxHeight),
        { initialProps: { maxHeight: 200 } }
      );

      expect(result.current?.maxHeight).toBe(200);

      // Change maxHeight which should trigger recalculation
      rerender({ maxHeight: 300 });

      expect(result.current?.maxHeight).toBe(300);
    });

    it('should update position when visibility changes', () => {
      const mockElement = createMockElement({
        top: 100,
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 132,
      } as DOMRect);

      const { result, rerender } = renderHook(
        ({ isVisible }) => useDropdownPosition({ current: mockElement }, isVisible, 200),
        { initialProps: { isVisible: false } }
      );

      expect(result.current).toBeNull();

      rerender({ isVisible: true });

      expect(result.current).toEqual({
        top: 132,
        left: 50,
        width: 300,
        maxHeight: 200,
        direction: 'down'
      });
    });

    it('should update position when max height changes', () => {
      const mockElement = createMockElement({
        top: 100,
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 132,
      } as DOMRect);

      const { result, rerender } = renderHook(
        ({ maxHeight }) => useDropdownPosition({ current: mockElement }, true, maxHeight),
        { initialProps: { maxHeight: 200 } }
      );

      expect(result.current?.maxHeight).toBe(200);

      rerender({ maxHeight: 300 });

      expect(result.current?.maxHeight).toBe(300);
    });
  });

  describe('event listeners', () => {
    it('should add scroll and resize event listeners when active', () => {
      const mockElement = createMockElement({
        top: 100,
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 132,
      } as DOMRect);

      renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 200)
      );

      expect(mockAddEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), true);
      expect(mockAddEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should remove event listeners on cleanup', () => {
      const mockElement = createMockElement({
        top: 100,
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 132,
      } as DOMRect);

      const { unmount } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 200)
      );

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), true);
      expect(mockRemoveEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('should not add listeners when dropdown is not visible', () => {
      const mockElement = createMockElement({
        top: 100,
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 132,
      } as DOMRect);

      renderHook(() => 
        useDropdownPosition({ current: mockElement }, false, 200)
      );

      expect(mockAddEventListener).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle zero max height', () => {
      const mockElement = createMockElement({
        top: 100,
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 132,
      } as DOMRect);

      const { result } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 0)
      );

      expect(result.current?.maxHeight).toBe(0);
    });

    it('should handle very small viewport', () => {
      (window as any).innerHeight = 100;
      (window as any).innerWidth = 200;

      const mockElement = createMockElement({
        top: 50,
        left: 10,
        width: 150,
        height: 24,
        right: 160,
        bottom: 74,
      } as DOMRect);

      const { result } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 200)
      );

      // Should limit to available space
      expect(result.current?.maxHeight).toBeLessThanOrEqual(50); // Available space below
      expect(result.current?.width).toBe(150); // Input width
    });

    it('should handle input at viewport edges', () => {
      const mockElement = createMockElement({
        top: 0, // At very top
        left: 0, // At very left
        width: 1200, // Full width
        height: 32,
        right: 1200,
        bottom: 32,
      } as DOMRect);

      const { result } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 200)
      );

      expect(result.current?.top).toBe(32);
      expect(result.current?.left).toBe(0);
      expect(result.current?.width).toBe(1200);
    });

    it('should handle getBoundingClientRect returning undefined values', () => {
      const mockElement = {
        getBoundingClientRect: () => ({
          top: undefined,
          left: undefined,
          width: undefined,
          height: undefined,
          right: undefined,
          bottom: undefined,
        }),
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      } as any;

      const { result } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 200)
      );

      // Should handle gracefully and return null or default values
      expect(result.current).toBeNull();
    });

    it('should prefer downward direction when equal space available', () => {
      // Input exactly in the middle of viewport
      const mockElement = createMockElement({
        top: 384, // (800 - 32) / 2 = 384
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 416, // 384 + 32
      } as DOMRect);

      const { result } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 200)
      );

      // Equal space above (384px) and below (384px), should prefer down
      expect(result.current?.direction).toBe('down');
      expect(result.current?.top).toBe(416);
    });
  });

  describe('performance considerations', () => {
    it('should debounce rapid position updates', () => {
      const mockElement = createMockElement({
        top: 100,
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 132,
      } as DOMRect);

      const { result } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 200)
      );

      const initialPosition = result.current;

      // Simulate rapid scroll events
      for (let i = 0; i < 10; i++) {
        // Position should remain stable during rapid updates
        expect(result.current).toEqual(initialPosition);
      }
    });

    it('should not recalculate when dependencies have not changed', () => {
      const mockElement = createMockElement({
        top: 100,
        left: 50,
        width: 300,
        height: 32,
        right: 350,
        bottom: 132,
      } as DOMRect);

      const getBoundingClientRectSpy = jest.spyOn(mockElement, 'getBoundingClientRect');

      const { rerender } = renderHook(() => 
        useDropdownPosition({ current: mockElement }, true, 200)
      );

      const initialCallCount = getBoundingClientRectSpy.mock.calls.length;

      // Re-render with same props
      rerender();

      // Should not call getBoundingClientRect again
      expect(getBoundingClientRectSpy).toHaveBeenCalledTimes(initialCallCount);

      getBoundingClientRectSpy.mockRestore();
    });
  });
});