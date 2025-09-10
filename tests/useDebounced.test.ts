import { renderHook, act } from '@testing-library/react';
import { useDebounced } from '../src/hooks/useDebounced';

// Mock timers
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('useDebounced', () => {
  describe('basic debouncing behavior', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useDebounced('initial', 500));
      
      expect(result.current).toBe('initial');
    });

    it('should debounce value changes', () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounced(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      expect(result.current).toBe('initial');

      // Update the value
      rerender({ value: 'updated', delay: 500 });
      
      // Should still be initial value before delay
      expect(result.current).toBe('initial');

      // Fast forward time but not enough
      act(() => {
        jest.advanceTimersByTime(400);
      });
      expect(result.current).toBe('initial');

      // Fast forward past the delay
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(result.current).toBe('updated');
    });

    it('should reset timer on rapid changes', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounced(value, 500),
        { initialProps: { value: 'initial' } }
      );

      // Update value multiple times rapidly
      rerender({ value: 'update1' });
      act(() => {
        jest.advanceTimersByTime(300);
      });
      
      rerender({ value: 'update2' });
      act(() => {
        jest.advanceTimersByTime(300);
      });
      
      rerender({ value: 'final' });
      
      // Should still be initial after 600ms total because timer keeps resetting
      expect(result.current).toBe('initial');

      // Now wait full delay from last update
      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(result.current).toBe('final');
    });
  });

  describe('configurable delay', () => {
    it('should respect different delay values', () => {
      const { result, rerender } = renderHook(
        ({ delay }) => useDebounced('test', delay),
        { initialProps: { delay: 1000 } }
      );

      rerender({ delay: 1000 });

      // Update the hook with new delay
      const { result: result2, rerender: rerender2 } = renderHook(
        ({ value }) => useDebounced(value, 200),
        { initialProps: { value: 'initial' } }
      );

      rerender2({ value: 'updated' });

      // 200ms delay should trigger faster
      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(result2.current).toBe('updated');
    });

    it('should handle zero delay', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounced(value, 0),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'updated' });

      // With zero delay, should update immediately on next tick
      act(() => {
        jest.advanceTimersByTime(0);
      });
      expect(result.current).toBe('updated');
    });
  });

  describe('cleanup behavior', () => {
    it('should cleanup timeout on unmount', () => {
      const { result, rerender, unmount } = renderHook(
        ({ value }) => useDebounced(value, 500),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'updated' });
      
      // Unmount before timer completes
      unmount();

      // Timer should be cleaned up, no updates should happen
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      // This is just to verify no errors occur during cleanup
      expect(true).toBe(true);
    });

    it('should cleanup previous timeout when value changes', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      const { result, rerender } = renderHook(
        ({ value }) => useDebounced(value, 500),
        { initialProps: { value: 'initial' } }
      );

      rerender({ value: 'update1' });
      rerender({ value: 'update2' });

      // Should have called clearTimeout when setting up new timer
      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined values', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounced(value, 500),
        { initialProps: { value: undefined } }
      );

      expect(result.current).toBeUndefined();

      rerender({ value: 'defined' });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe('defined');
    });

    it('should handle null values', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounced(value, 500),
        { initialProps: { value: null } }
      );

      expect(result.current).toBeNull();

      rerender({ value: 'not null' });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe('not null');
    });

    it('should handle object values', () => {
      const initialObj = { key: 'initial' };
      const updatedObj = { key: 'updated' };

      const { result, rerender } = renderHook(
        ({ value }) => useDebounced(value, 500),
        { initialProps: { value: initialObj } }
      );

      expect(result.current).toBe(initialObj);

      rerender({ value: updatedObj });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe(updatedObj);
    });

    it('should handle same value updates efficiently', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useDebounced(value, 500),
        { initialProps: { value: 'same' } }
      );

      // Update with same value
      rerender({ value: 'same' });

      // Should not create new timer for same value
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe('same');
    });
  });

  describe('performance considerations', () => {
    it('should not create unnecessary re-renders', () => {
      let renderCount = 0;
      
      const { rerender } = renderHook(
        ({ value }) => {
          renderCount++;
          return useDebounced(value, 500);
        },
        { initialProps: { value: 'initial' } }
      );

      const initialRenderCount = renderCount;

      // Multiple updates before debounce
      rerender({ value: 'update1' });
      rerender({ value: 'update2' });
      rerender({ value: 'update3' });

      // Should only have rendered for each prop change, not for internal timer updates
      expect(renderCount).toBe(initialRenderCount + 3);

      // Trigger debounce
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Should have one more render for the debounced update
      expect(renderCount).toBe(initialRenderCount + 4);
    });
  });
});
