import { renderHook, act, waitFor } from '@testing-library/react';
import { useMetricAutocomplete } from '../src/hooks/useMetricAutocomplete';

// Mock dependencies
const mockDataSource = {
  getMetricNames: jest.fn(),
};

// Mock debounced hook
jest.mock('../src/hooks/useDebounced', () => ({
  useDebounced: jest.fn((value) => value), // Return value immediately for testing
}));

// Mock template variable resolver
jest.mock('../src/utils/templateVariableResolver', () => ({
  getAllSearchTerms: jest.fn(),
}));

const mockGetAllSearchTerms = require('../src/utils/templateVariableResolver').getAllSearchTerms;

describe('useMetricAutocomplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Reset mocks to default behavior
    mockGetAllSearchTerms.mockReset();
    mockDataSource.getMetricNames.mockReset();
    
    // Clear the global cache between tests
    const { cache } = require('../src/hooks/useMetricAutocomplete');
    cache.clear();
  });

  describe('basic functionality', () => {
    it('should return empty results for empty input', async () => {
      const { result } = renderHook(() => 
        useMetricAutocomplete('', mockDataSource, { debounceMs: 300 })
      );

      expect(result.current.suggestions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return empty results for whitespace-only input', async () => {
      const { result } = renderHook(() => 
        useMetricAutocomplete('   ', mockDataSource, { debounceMs: 300 })
      );

      expect(result.current.suggestions).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should fetch metrics for simple input without variables', async () => {
      const mockMetrics = ['system.cpu.usage', 'system.cpu.idle', 'system.memory.used'];
      mockDataSource.getMetricNames.mockResolvedValue(mockMetrics);
      mockGetAllSearchTerms.mockReturnValue(['system.cpu']);

      const { result } = renderHook(() => 
        useMetricAutocomplete('system.cpu', mockDataSource, { debounceMs: 0 })
      );

      await waitFor(() => {
        expect(result.current.suggestions).toEqual(mockMetrics);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockDataSource.getMetricNames).toHaveBeenCalledWith('system.cpu');
    });
  });

  describe('template variable handling', () => {
    it('should use multiple search terms from template resolver', async () => {
      const mockMetrics1 = ['system.web01.cpu', 'system.web01.memory'];
      const mockMetrics2 = ['system.web02.cpu', 'system.web02.memory'];
      const mockMetrics3 = ['system.prod.cpu', 'system.test.cpu', 'system.dev.cpu'];

      mockDataSource.getMetricNames
        .mockResolvedValueOnce(mockMetrics1)  // for 'system.web01.cpu'
        .mockResolvedValueOnce(mockMetrics2)  // for 'system.web02.cpu'  
        .mockResolvedValueOnce(mockMetrics3); // for 'system.*.cpu'

      // Mock multiple search terms from template resolution
      mockGetAllSearchTerms.mockReturnValue([
        'system.web01.cpu',
        'system.web02.cpu', 
        'system.*.cpu'
      ]);

      const { result } = renderHook(() => 
        useMetricAutocomplete('system.$server.cpu', mockDataSource, { debounceMs: 0 })
      );

      await waitFor(() => {
        expect(result.current.suggestions.length).toBeGreaterThan(0);
      });

      // Should have called getMetricNames for each search term
      expect(mockDataSource.getMetricNames).toHaveBeenCalledTimes(3);
      expect(mockDataSource.getMetricNames).toHaveBeenCalledWith('system.web01.cpu');
      expect(mockDataSource.getMetricNames).toHaveBeenCalledWith('system.web02.cpu');
      expect(mockDataSource.getMetricNames).toHaveBeenCalledWith('system.*.cpu');

      // Results should be combined and deduplicated
      const expectedResults = [...new Set([...mockMetrics1, ...mockMetrics2, ...mockMetrics3])];
      expect(result.current.suggestions).toEqual(expect.arrayContaining(expectedResults));
    });

    it('should include original template string in results', async () => {
      const mockMetrics = ['system.prod.cpu'];
      mockDataSource.getMetricNames.mockResolvedValue(mockMetrics);
      
      mockGetAllSearchTerms.mockReturnValue([
        'system.prod.cpu',      // resolved
        'system.*.cpu',         // pattern
        'system.$env.cpu'       // original template
      ]);

      const { result } = renderHook(() => 
        useMetricAutocomplete('system.$env.cpu', mockDataSource, { debounceMs: 0 })
      );

      await waitFor(() => {
        expect(result.current.suggestions).toContain('system.$env.cpu');
      });

      // Original template should be included even if no API call made for it
      expect(result.current.suggestions).toEqual(
        expect.arrayContaining(['system.$env.cpu', ...mockMetrics])
      );
    });
  });

  describe('loading states', () => {
    it('should show loading state during API call', async () => {
      let resolvePromise: (value: string[]) => void;
      const promise = new Promise<string[]>((resolve) => {
        resolvePromise = resolve;
      });

      mockDataSource.getMetricNames.mockClear();
      mockDataSource.getMetricNames.mockReturnValue(promise);
      mockGetAllSearchTerms.mockReturnValue(['system.cpu']);

      const { result } = renderHook(() => 
        useMetricAutocomplete('system.cpu.new', mockDataSource, { debounceMs: 0 })
      );

      // Should be loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.suggestions).toEqual([]);

      // Resolve the promise
      act(() => {
        resolvePromise!(['system.cpu.usage']);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.suggestions).toEqual(['system.cpu.usage']);
    });

    it('should handle loading state for multiple concurrent requests', async () => {
      const promise1 = new Promise<string[]>((resolve) => 
        setTimeout(() => resolve(['metric1']), 100)
      );
      const promise2 = new Promise<string[]>((resolve) => 
        setTimeout(() => resolve(['metric2']), 200)
      );

      mockDataSource.getMetricNames
        .mockReturnValueOnce(promise1)
        .mockReturnValueOnce(promise2);

      mockGetAllSearchTerms.mockReturnValue(['term1', 'term2']);

      const { result } = renderHook(() => 
        useMetricAutocomplete('test', mockDataSource, { debounceMs: 0 })
      );

      expect(result.current.isLoading).toBe(true);

      // Wait for all requests to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 300 });

      expect(result.current.suggestions).toEqual(expect.arrayContaining(['metric1', 'metric2']));
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockDataSource.getMetricNames.mockRejectedValue(error);
      mockGetAllSearchTerms.mockReturnValue(['system.cpu']);

      const { result } = renderHook(() => 
        useMetricAutocomplete('system.cpu', mockDataSource, { debounceMs: 0 })
      );

      await waitFor(() => {
        expect(result.current.error).toBe(error);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.suggestions).toEqual([]);
    });

    it('should handle partial failures in multi-term search', async () => {
      const mockMetrics = ['system.cpu.usage'];
      const error = new Error('Network error');

      mockDataSource.getMetricNames
        .mockResolvedValueOnce(mockMetrics)  // First call succeeds
        .mockRejectedValueOnce(error);       // Second call fails

      mockGetAllSearchTerms.mockReturnValue(['system.cpu', 'system.memory']);

      const { result } = renderHook(() => 
        useMetricAutocomplete('system.$metric', mockDataSource, { debounceMs: 0 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still return successful results and set error for failed request
      expect(result.current.suggestions).toEqual(expect.arrayContaining(mockMetrics));
      expect(result.current.error).toBe(error);
    });

    it('should clear previous errors on new successful search', async () => {
      const error = new Error('API Error');
      
      // Setup mocks - need to handle both input scenarios
      mockGetAllSearchTerms
        .mockReturnValueOnce(['system.cpu'])    // First input: system.cpu
        .mockReturnValueOnce(['system.memory']); // Second input: system.memory

      mockDataSource.getMetricNames
        .mockRejectedValueOnce(error)              // First call for 'system.cpu' fails
        .mockResolvedValueOnce(['system.memory.usage']); // Second call for 'system.memory' succeeds

      const { result, rerender } = renderHook(
        ({ input }) => useMetricAutocomplete(input, mockDataSource, { debounceMs: 0 }),
        { initialProps: { input: 'system.cpu' } }
      );

      // Wait for first error
      await waitFor(() => {
        expect(result.current.error).toBe(error);
      });
      expect(result.current.suggestions).toEqual([]);

      // Change input to trigger new search
      rerender({ input: 'system.memory' });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.suggestions).toEqual(['system.memory.usage']);
      });
    });
  });

  describe('caching behavior', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should cache results for identical searches', async () => {
      const mockMetrics = ['system.cpu.usage'];
      mockDataSource.getMetricNames.mockResolvedValue(mockMetrics);
      mockGetAllSearchTerms.mockReturnValue(['system.cpu']);

      const { result, rerender } = renderHook(
        ({ input }) => useMetricAutocomplete(input, mockDataSource, { 
          debounceMs: 0, 
          cacheTtlMs: 60000 
        }),
        { initialProps: { input: 'system.cpu' } }
      );

      await waitFor(() => {
        expect(result.current.suggestions).toEqual(mockMetrics);
      });

      expect(mockDataSource.getMetricNames).toHaveBeenCalledTimes(1);

      // Same search again should use cache
      rerender({ input: 'other' });
      rerender({ input: 'system.cpu' });

      await waitFor(() => {
        expect(result.current.suggestions).toEqual(mockMetrics);
      });

      // Should still only be called once
      expect(mockDataSource.getMetricNames).toHaveBeenCalledTimes(1);
    });

    it('should expire cache after TTL', async () => {
      const mockMetrics = ['system.cpu.usage'];
      mockDataSource.getMetricNames.mockResolvedValue(mockMetrics);
      mockGetAllSearchTerms.mockReturnValue(['system.cpu']);

      const { result, rerender } = renderHook(
        ({ input }) => useMetricAutocomplete(input, mockDataSource, { 
          debounceMs: 0,
          cacheTtlMs: 5000
        }),
        { initialProps: { input: 'system.cpu' } }
      );

      await waitFor(() => {
        expect(result.current.suggestions).toEqual(mockMetrics);
      });

      expect(mockDataSource.getMetricNames).toHaveBeenCalledTimes(1);

      // Advance time past TTL
      act(() => {
        jest.advanceTimersByTime(6000);
      });

      // Trigger a different search first to clear component state
      rerender({ input: '' });
      
      // Now search again - should make new API call due to expired cache
      rerender({ input: 'system.cpu' });

      await waitFor(() => {
        expect(mockDataSource.getMetricNames).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle cache with different cache TTL settings', async () => {
      const mockMetrics = ['system.cpu.usage'];
      mockDataSource.getMetricNames.mockResolvedValue(mockMetrics);
      mockGetAllSearchTerms.mockReturnValue(['system.cpu']);

      // Test with disabled caching (TTL = 0)
      const { result, rerender } = renderHook(
        ({ input }) => useMetricAutocomplete(input, mockDataSource, { 
          debounceMs: 0,
          cacheTtlMs: 0
        }),
        { initialProps: { input: 'system.cpu' } }
      );

      await waitFor(() => {
        expect(result.current.suggestions).toEqual(mockMetrics);
      });

      expect(mockDataSource.getMetricNames).toHaveBeenCalledTimes(1);

      // With caching disabled, same search should make another API call
      rerender({ input: '' });
      rerender({ input: 'system.cpu' });

      await waitFor(() => {
        expect(mockDataSource.getMetricNames).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('configuration options', () => {
    it('should respect maxResults limit', async () => {
      const manyMetrics = Array.from({ length: 100 }, (_, i) => `metric${i}`);
      mockDataSource.getMetricNames.mockResolvedValue(manyMetrics);
      mockGetAllSearchTerms.mockReturnValue(['test']);

      const { result } = renderHook(() => 
        useMetricAutocomplete('test', mockDataSource, { 
          debounceMs: 0,
          maxResults: 10
        })
      );

      await waitFor(() => {
        expect(result.current.suggestions.length).toBe(10);
      });

      expect(result.current.suggestions).toEqual(manyMetrics.slice(0, 10));
    });

    it('should handle unlimited results when maxResults is undefined', async () => {
      const manyMetrics = Array.from({ length: 100 }, (_, i) => `metric${i}`);
      mockDataSource.getMetricNames.mockResolvedValue(manyMetrics);
      mockGetAllSearchTerms.mockReturnValue(['test']);

      const { result } = renderHook(() => 
        useMetricAutocomplete('test', mockDataSource, { 
          debounceMs: 0
          // maxResults not specified
        })
      );

      await waitFor(() => {
        expect(result.current.suggestions.length).toBe(100);
      });

      expect(result.current.suggestions).toEqual(manyMetrics);
    });
  });

  describe('request cancellation', () => {
    it('should cancel previous requests when input changes rapidly', async () => {
      let resolveFirst: (value: string[]) => void;
      let resolveSecond: (value: string[]) => void;

      const firstPromise = new Promise<string[]>((resolve) => {
        resolveFirst = resolve;
      });
      const secondPromise = new Promise<string[]>((resolve) => {
        resolveSecond = resolve;
      });

      mockDataSource.getMetricNames
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);

      mockGetAllSearchTerms
        .mockReturnValueOnce(['first'])
        .mockReturnValueOnce(['second']);

      const { result, rerender } = renderHook(
        ({ input }) => useMetricAutocomplete(input, mockDataSource, { debounceMs: 0 }),
        { initialProps: { input: 'first' } }
      );

      // Change input before first request completes
      rerender({ input: 'second' });

      // Resolve second request first
      act(() => {
        resolveSecond(['second-metric']);
      });

      await waitFor(() => {
        expect(result.current.suggestions).toEqual(['second-metric']);
      });

      // Now resolve first request (should be ignored)
      act(() => {
        resolveFirst(['first-metric']);
      });

      // Should still show second results
      expect(result.current.suggestions).toEqual(['second-metric']);
    });
  });
});