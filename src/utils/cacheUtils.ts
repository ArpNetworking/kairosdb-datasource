/**
 * Simple in-memory cache with TTL (Time To Live) support
 */
export class SimpleCache<T> {
  private cache = new Map<string, { value: T; expiry: number }>();
  private defaultTtl: number;

  constructor(defaultTtlMs: number = 5 * 60 * 1000) { // 5 minutes default
    this.defaultTtl = defaultTtlMs;
  }

  /**
   * Get cached value if it exists and hasn't expired
   */
  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  /**
   * Set cached value with optional TTL
   */
  set(key: string, value: T, ttlMs?: number): void {
    const expiry = Date.now() + (ttlMs || this.defaultTtl);
    this.cache.set(key, { value, expiry });
  }

  /**
   * Remove specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cached values
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Clean expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Debounce function that delays execution until after wait milliseconds have passed
 */
export function debounce<T extends (...args: any[]) => Promise<any>>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    return new Promise((resolve, reject) => {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Set new timeout
      timeoutId = setTimeout(async () => {
        try {
          const result = await func(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, waitMs);
    });
  };
}

/**
 * Throttle function that limits execution to at most once per wait milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => Promise<ReturnType<T> | null> {
  let lastCallTime = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  let lastPromise: Promise<ReturnType<T> | null> | null = null;
  
  return (...args: Parameters<T>): Promise<ReturnType<T> | null> => {
    const now = Date.now();
    
    if (now - lastCallTime >= waitMs) {
      // Can execute immediately
      lastCallTime = now;
      lastPromise = Promise.resolve(func(...args));
      return lastPromise;
    } else {
      // Need to throttle
      if (!timeoutId) {
        timeoutId = setTimeout(async () => {
          lastCallTime = Date.now();
          timeoutId = null;
          try {
            const result = await func(...args);
            lastPromise = Promise.resolve(result);
          } catch (error) {
            lastPromise = Promise.reject(error);
          }
        }, waitMs - (now - lastCallTime));
      }
      
      return lastPromise || Promise.resolve(null);
    }
  };
}

/**
 * Parse search query to determine if it's a prefix search (starts with ^)
 */
export function parseSearchQuery(query?: string): { isPrefixMode: boolean; searchTerm: string } {
  if (!query || query.length === 0) {
    return { isPrefixMode: false, searchTerm: '' };
  }
  
  if (query.startsWith('^')) {
    return { 
      isPrefixMode: true, 
      searchTerm: query.substring(1) // Remove the ^ indicator
    };
  }
  
  return { isPrefixMode: false, searchTerm: query };
}

/**
 * Combined cache key generator that includes filtering configuration
 */
export function generateCacheKey(query?: string, suffixes?: string[]): string {
  const suffixesPart = suffixes ? suffixes.join(',') : '';
  
  if (query && query.length > 0) {
    const { isPrefixMode, searchTerm } = parseSearchQuery(query);
    const searchMode = isPrefixMode ? 'prefix' : 'contains';
    // Include both the search term and the mode in the cache key
    return `metrics:${searchMode}:${searchTerm}:${suffixesPart}`;
  } else {
    // All results - use generic cache key
    return `metrics:all:${suffixesPart}`;
  }
}

/**
 * Generate cache key specifically for API requests (prefix vs all)
 */
export function generateApiCacheKey(query?: string): string {
  if (!query || query.length === 0) {
    return `metricnames:api:all`;
  }
  
  const { isPrefixMode, searchTerm } = parseSearchQuery(query);
  
  if (isPrefixMode && searchTerm.length >= 2) {
    // Use prefix API call for ^prefix searches
    return `metricnames:api:prefix:${searchTerm}`;
  } else {
    // Use all results for contains searches or short prefix searches
    return `metricnames:api:all`;
  }
}
