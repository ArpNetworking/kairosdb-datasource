import { useState, useEffect, useRef, useMemo } from 'react';
import { useDebounced } from './useDebounced';
import { getAllSearchTerms } from '../utils/templateVariableResolver';
import { hasTemplateVariables } from '../utils/templateVariableParser';

export interface MetricAutocompleteOptions {
  /** Debounce delay in milliseconds */
  debounceMs: number;
  /** Maximum number of results to return */
  maxResults?: number;
  /** Cache TTL in milliseconds (0 = no caching) */
  cacheTtlMs?: number;
}

export interface MetricAutocompleteResult {
  suggestions: string[];
  isLoading: boolean;
  error: Error | null;
}

interface DataSource {
  getMetricNames: (query: string) => Promise<string[]>;
}

interface CacheEntry {
  results: string[];
  timestamp: number;
}

// Global cache shared across hook instances
const cache = new Map<string, CacheEntry>();

// Cache for all metrics (shared across all searches)
let allMetricsCache: { metrics: string[]; timestamp: number } | null = null;
const ALL_METRICS_CACHE_TTL = 60000; // 1 minute

// Export cache for testing purposes
export { cache };

/**
 * Get all metrics from cache or fetch from server, then filter client-side
 */
async function getFilteredMetrics(dataSource: DataSource, searchTerm: string): Promise<string[]> {
  // Get all metrics (cached or fresh)
  const allMetrics = await getAllMetrics(dataSource);
  
  // Apply client-side filtering
  return filterMetrics(allMetrics, searchTerm);
}

/**
 * Get all metrics with caching
 */
async function getAllMetrics(dataSource: DataSource): Promise<string[]> {
  // Check cache first
  if (allMetricsCache && (Date.now() - allMetricsCache.timestamp) < ALL_METRICS_CACHE_TTL) {
    return allMetricsCache.metrics;
  }
  
  // Fetch all metrics from server (empty query gets all metrics)
  const metrics = await dataSource.getMetricNames('');
  console.log(`[MetricAutocomplete] Fetched ${metrics.length} total metrics from server`);
  
  // Update cache
  allMetricsCache = {
    metrics,
    timestamp: Date.now()
  };
  
  return metrics;
}

/**
 * Filter metrics client-side with user-friendly pattern matching
 * All patterns are substring matches unless explicitly anchored with ^ or $
 */
function filterMetrics(allMetrics: string[], searchTerm: string): string[] {
  if (!searchTerm || searchTerm.trim().length === 0) {
    console.log('[MetricAutocomplete] Empty search - returning all metrics:', allMetrics.length);
    return allMetrics; // No limit - return all metrics
  }
  
  const term = searchTerm.trim();
  
  // Convert user pattern to regex
  let regexPattern = term;
  
  // Escape special regex characters except ^ $ and *
  regexPattern = regexPattern.replace(/[.+?{}()|[\]\\]/g, '\\$&');
  
  // Handle wildcards: convert * to .*
  regexPattern = regexPattern.replace(/\*/g, '.*');
  
  // Add implicit .* at beginning and end unless user specified anchors
  if (!regexPattern.startsWith('^')) {
    regexPattern = '.*' + regexPattern;
  } else {
    // Remove the ^ since we'll add it back
    regexPattern = regexPattern.substring(1);
  }
  
  if (!regexPattern.endsWith('$')) {
    regexPattern = regexPattern + '.*';
  } else {
    // Remove the $ since we'll add it back
    regexPattern = regexPattern.substring(0, regexPattern.length - 1);
  }
  
  // Construct final regex with proper anchoring
  const finalPattern = '^' + regexPattern + '$';
  
  try {
    const regex = new RegExp(finalPattern, 'i');
    const filteredResults = allMetrics.filter(metric => regex.test(metric));
    console.log(`[MetricAutocomplete] Regex search "${searchTerm}" found ${filteredResults.length} results (from ${allMetrics.length} total metrics)`);
    return filteredResults;
  } catch (e) {
    // Invalid regex, fall back to simple contains search
    const lowerTerm = term.toLowerCase();
    const filteredResults = allMetrics
      .filter(metric => metric.toLowerCase().includes(lowerTerm));
    console.log(`[MetricAutocomplete] Fallback search "${searchTerm}" found ${filteredResults.length} results (from ${allMetrics.length} total metrics)`);
    return filteredResults;
  }
}

/**
 * Hook for metric name autocomplete with template variable support
 * Handles multi-value template resolution, debouncing, caching, and error states
 */
export function useMetricAutocomplete(
  input: string,
  dataSource: DataSource,
  options: MetricAutocompleteOptions
): MetricAutocompleteResult {
  const { debounceMs, maxResults, cacheTtlMs = 300000 } = options; // 5min default cache
  
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  const debouncedInput = useDebounced(input, debounceMs);
  const currentRequestRef = useRef<number>(0);

  // Memoize search terms to avoid recalculation on every render
  const searchTerms = useMemo(() => {
    const trimmed = debouncedInput?.trim();
    if (!trimmed) {
      return [];
    }
    return getAllSearchTerms(trimmed);
  }, [debouncedInput]);

  useEffect(() => {
    const trimmed = debouncedInput?.trim();
    
    // Clear results for empty input
    if (!trimmed) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (searchTerms.length === 0) {
      setSuggestions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Increment request counter to handle cancellation
    const requestId = ++currentRequestRef.current;
    
    setIsLoading(true);
    setError(null);

    const fetchMetrics = async () => {
      try {
        // Process each search term
        const promises = searchTerms.map(async (term) => {
          // Check if this is the original template variable
          if (hasTemplateVariables(term)) {
            // Include template variables in results without API call
            return [term];
          }

          // Check cache first
          if (cacheTtlMs > 0) {
            const cached = cache.get(term);
            if (cached && (Date.now() - cached.timestamp) < cacheTtlMs) {
              return cached.results;
            }
          }

          // Hybrid approach: fetch all metrics and do client-side filtering
          const results = await getFilteredMetrics(dataSource, term);
          
          // Cache the results
          if (cacheTtlMs > 0) {
            cache.set(term, {
              results,
              timestamp: Date.now()
            });
          }

          return results;
        });

        const results = await Promise.allSettled(promises);
        
        // Check if this request is still current
        if (requestId !== currentRequestRef.current) {
          return; // Ignore outdated requests
        }

        // Process results and handle errors
        const successResults: string[] = [];
        let hasErrors = false;
        let lastError: Error | null = null;

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            successResults.push(...result.value);
          } else {
            hasErrors = true;
            const reason = result.reason;
            lastError = reason instanceof Error 
              ? reason 
              : new Error('Unknown error');
          }
        });

        // Deduplicate results
        const uniqueResults = [...new Set(successResults)];
        console.log(`[MetricAutocomplete] Final results for "${trimmed}": ${uniqueResults.length} unique suggestions`);
        
        // Apply maxResults limit
        const limitedResults = maxResults 
          ? uniqueResults.slice(0, maxResults)
          : uniqueResults;

        if (maxResults && uniqueResults.length > maxResults) {
          console.log(`[MetricAutocomplete] Limited results from ${uniqueResults.length} to ${maxResults}`);
        }

        setSuggestions(limitedResults);
        setIsLoading(false);
        
        // Set error if any requests failed
        if (hasErrors && lastError) {
          setError(lastError);
        } else {
          setError(null);
        }
      } catch (err) {
        // Check if this request is still current
        if (requestId !== currentRequestRef.current) {
          return;
        }

        setIsLoading(false);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setSuggestions([]);
      }
    };

    fetchMetrics();
  }, [searchTerms, dataSource, maxResults, cacheTtlMs]);

  return {
    suggestions,
    isLoading,
    error
  };
}