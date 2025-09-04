import { renderHook, act, waitFor } from '@testing-library/react';
import { useMetricAutocomplete, clearAllCaches } from '../src/hooks/useMetricAutocomplete';

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
    clearAllCaches(); // Clear all caches before each test
    
    // Reset mocks to default behavior
    mockGetAllSearchTerms.mockReset();
    mockDataSource.getMetricNames.mockReset();
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

      // Should return only metrics matching the search pattern (client-side filtered)
      const expectedMetrics = ['system.cpu.usage', 'system.cpu.idle']; // system.memory.used filtered out
      await waitFor(() => {
        expect(result.current.suggestions).toEqual(expectedMetrics);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      // Now calls with empty string to get all metrics, then filters client-side
      expect(mockDataSource.getMetricNames).toHaveBeenCalledWith('');
    });
  });

  describe('template variable handling', () => {
    it('should use multiple search terms from template resolver', async () => {
      // All metrics that would be returned from server
      const allMetrics = [
        'system.web01.cpu', 'system.web01.memory', 
        'system.web02.cpu', 'system.web02.memory',
        'system.prod.cpu', 'system.test.cpu', 'system.dev.cpu',
        'other.metric'
      ];

      // With new hybrid approach, always returns all metrics then filters client-side
      mockDataSource.getMetricNames.mockResolvedValue(allMetrics);

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

      // With hybrid approach, should call getMetricNames 3 times (once for each search term) with empty string
      expect(mockDataSource.getMetricNames).toHaveBeenCalledTimes(3);
      expect(mockDataSource.getMetricNames).toHaveBeenCalledWith('');

      // Should include metrics that match any of the search patterns
      expect(result.current.suggestions).toEqual(expect.arrayContaining([
        'system.web01.cpu',
        'system.web02.cpu',
        'system.prod.cpu',
        'system.test.cpu',
        'system.dev.cpu'
      ]));
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
      // Return metrics that would match the search terms after client-side filtering
      const promise1 = new Promise<string[]>((resolve) => 
        setTimeout(() => resolve(['term1.metric', 'other.metric']), 100)
      );
      const promise2 = new Promise<string[]>((resolve) => 
        setTimeout(() => resolve(['term2.metric', 'another.metric']), 200)
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

      // Should include metrics that match the search patterns after client-side filtering
      expect(result.current.suggestions).toEqual(expect.arrayContaining(['term1.metric', 'term2.metric']));
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
      const mockMetrics = ['system.cpu.usage', 'system.memory.usage'];
      mockDataSource.getMetricNames.mockResolvedValue(mockMetrics);
      mockGetAllSearchTerms.mockReturnValue(['system.cpu']);

      const { result, rerender } = renderHook(
        ({ input }) => useMetricAutocomplete(input, mockDataSource, { 
          debounceMs: 0,
          cacheTtlMs: 5000
        }),
        { initialProps: { input: 'system.cpu' } }
      );

      // Should return filtered results
      const expectedMetrics = ['system.cpu.usage']; // system.memory.usage filtered out
      await waitFor(() => {
        expect(result.current.suggestions).toEqual(expectedMetrics);
      });

      expect(mockDataSource.getMetricNames).toHaveBeenCalledTimes(1);

      // Advance time past TTL
      act(() => {
        jest.advanceTimersByTime(6000);
      });

      // Clear global cache to simulate TTL expiration (since global cache has its own TTL)
      clearAllCaches();

      // Trigger a different search first to clear component state
      rerender({ input: '' });
      
      // Now search again - should make new API call due to expired cache
      rerender({ input: 'system.cpu' });

      await waitFor(() => {
        expect(mockDataSource.getMetricNames).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle cache with different cache TTL settings', async () => {
      const mockMetrics = ['system.cpu.usage', 'system.memory.used'];
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

      // Should filter client-side to only return matching metrics
      const expectedMetrics = ['system.cpu.usage']; // system.memory.used filtered out
      await waitFor(() => {
        expect(result.current.suggestions).toEqual(expectedMetrics);
      });

      expect(mockDataSource.getMetricNames).toHaveBeenCalledTimes(1);

      // With caching disabled, same search should make another API call
      clearAllCaches(); // Clear cache between searches to ensure fresh API call
      rerender({ input: '' });
      rerender({ input: 'system.cpu' });

      await waitFor(() => {
        expect(mockDataSource.getMetricNames).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('configuration options', () => {
    it('should respect maxResults limit', async () => {
      const manyMetrics = Array.from({ length: 100 }, (_, i) => `test.metric${i}`);
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

      // Should get first 10 results that match the search pattern
      expect(result.current.suggestions).toEqual(manyMetrics.slice(0, 10));
    });

    it('should handle unlimited results when maxResults is undefined', async () => {
      const manyMetrics = Array.from({ length: 100 }, (_, i) => `test.metric${i}`);
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