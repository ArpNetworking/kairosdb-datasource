import { getBackendSrv, isFetchError } from '@grafana/runtime';
import {
  CoreApp,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  createDataFrame,
  FieldType,
  ScopedVars,
  MetricFindValue,
} from '@grafana/data';

import { 
  KairosDBQuery, 
  KairosDBDataSourceOptions, 
  DEFAULT_QUERY,
  KairosDBMetricNamesResponse,
  KairosDBMetricTagsResponse,
  KairosDBMetricTagsRequest,
  KairosDBDatapointsResponse,
  KairosDBDatapointsRequest,
  KairosDBVersionResponse
} from './types';
import { lastValueFrom } from 'rxjs';
import { ParameterObjectBuilder } from './utils/parameterUtils';
import { VariableQueryParser, VariableQueryExecutor } from './utils/variableUtils';
import { SimpleCache, debounce, generateCacheKey, generateApiCacheKey, parseSearchQuery } from './utils/cacheUtils';

export class DataSource extends DataSourceApi<KairosDBQuery, KairosDBDataSourceOptions> {
  baseUrl: string;
  initialized: boolean = false;
  private variableQueryExecutor: VariableQueryExecutor;
  private settings: DataSourceInstanceSettings<KairosDBDataSourceOptions>;
  private metricNamesCache: SimpleCache<string[]>;
  private apiResponseCache: SimpleCache<string[]>;
  private debouncedGetMetricNames: (query?: string) => Promise<string[]>;

  constructor(instanceSettings: DataSourceInstanceSettings<KairosDBDataSourceOptions>) {
    super(instanceSettings);
    this.baseUrl = instanceSettings.url!;
    this.settings = instanceSettings;
    this.variableQueryExecutor = new VariableQueryExecutor(this);
    
    // Initialize caching with 5 minute TTL
    this.metricNamesCache = new SimpleCache<string[]>(5 * 60 * 1000); // Final filtered results
    this.apiResponseCache = new SimpleCache<string[]>(5 * 60 * 1000); // Raw API responses
    
    // Create debounced version with 300ms delay
    this.debouncedGetMetricNames = debounce(this.getMetricNamesInternal.bind(this), 300);
    
    // Set up periodic cache cleanup every 10 minutes
    setInterval(() => {
      console.log('[DataSource] Running periodic cache cleanup');
      this.metricNamesCache.cleanup();
      this.apiResponseCache.cleanup();
      console.log('[DataSource] Cache stats after cleanup:', {
        metricNames: this.metricNamesCache.getStats(),
        apiResponses: this.apiResponseCache.getStats()
      });
    }, 10 * 60 * 1000);
    console.log('[DataSource] Constructor called with:', {
      id: instanceSettings.id,
      uid: instanceSettings.uid,
      name: instanceSettings.name,
      type: instanceSettings.type,
      url: instanceSettings.url,
      jsonData: instanceSettings.jsonData
    });
  }

  async initialize(): Promise<void> {
    // Initialize any required data here
    this.initialized = true;
  }

  getDefaultQuery(_: CoreApp): Partial<KairosDBQuery> {
    return DEFAULT_QUERY;
  }

  filterQuery(query: KairosDBQuery): boolean {
    console.log('[DataSource] filterQuery called with:', JSON.stringify(query, null, 2));
    
    // Allow the QueryEditor to always render (return true for UI)
    // Only prevent query EXECUTION when there's no metric name
    // The QueryEditor itself should always be shown
    const hasMetricName = !!(query.query?.metricName);
    console.log('[DataSource] filterQuery - hasMetricName:', hasMetricName);
    
    // For now, always return true to allow QueryEditor rendering
    // We'll handle query execution validation separately
    return true;
  }

  async query(options: DataQueryRequest<KairosDBQuery>): Promise<DataQueryResponse> {
    try {
      console.log('[DataSource] KairosDB query called with options:', options);
      
      const { range } = options;
      if (!range) {
        console.warn('[DataSource] No range provided in query options');
        return { data: [] };
      }

      const from = range.from.valueOf();
      const to = range.to.valueOf();

      console.log('[DataSource] Query range:', { from, to });
      console.log('[DataSource] Query targets:', options.targets);

      // Interpolate variables in all targets
      const interpolatedTargets = this.interpolateVariablesInQueries(options.targets, options.scopedVars);
      console.log('[DataSource] Interpolated targets:', interpolatedTargets);

      // Filter out targets without metric names
      const validTargets = interpolatedTargets.filter(target => {
        const hasMetricName = !!(target.query?.metricName);
        console.log('[DataSource] Target execution filter:', { refId: target.refId, hasMetricName, metricName: target.query?.metricName });
        return hasMetricName;
      });

      if (validTargets.length === 0) {
        console.log('[DataSource] No valid targets to query');
        return { data: [] };
      }

      // Build KairosDB query request
      const metrics: KairosDBDatapointsRequest['metrics'] = validTargets.map(target => {
        const query = target.query!;
        const metric: KairosDBDatapointsRequest['metrics'][0] = {
          name: query.metricName!
        };

        // Add tags if any are specified
        if (query.tags && Object.keys(query.tags).length > 0) {
          metric.tags = {};
          Object.keys(query.tags).forEach(tagKey => {
            if (query.tags[tagKey] && query.tags[tagKey].length > 0) {
              metric.tags![tagKey] = query.tags[tagKey];
            }
          });
        }

        // Add aggregators if any are specified
        if (query.aggregators && query.aggregators.length > 0) {
          metric.aggregators = query.aggregators.map(agg => {
            console.log('[DataSource] Processing aggregator:', agg.name, 'parameters:', agg.parameters);
            
            const aggregator: { name: string; [key: string]: any } = {
              name: agg.name
            };
            
            // Add parameters if any, using ParameterObjectBuilder for proper auto value handling
            if (agg.parameters && agg.parameters.length > 0) {
              const parameterBuilder = new ParameterObjectBuilder(options.interval || '1m', agg);
              
              agg.parameters.forEach(param => {
                if (param.value !== undefined && param.value !== null && param.value !== '') {
                  console.log('[DataSource] Processing parameter:', param.name, '=', param.value, 'type:', param.type);
                  
                  const parameterObject = parameterBuilder.build(param);
                  console.log('[DataSource] Built parameter object:', parameterObject);
                  
                  // Deep merge the parameter object into the aggregator
                  this.deepMerge(aggregator, parameterObject);
                }
              });
            }

            console.log('[DataSource] Final aggregator object:', aggregator);
            return aggregator;
          });
        }

        // Add group by if specified
        if (query.groupBy) {
          console.log('[DataSource] Processing groupBy:', JSON.stringify(query.groupBy, null, 2));
          metric.group_by = [];

          // Group by tags
          if (query.groupBy.tags && query.groupBy.tags.length > 0) {
            console.log('[DataSource] Adding tag groupBy:', query.groupBy.tags);
            metric.group_by.push({
              name: 'tag',
              tags: query.groupBy.tags
            });
          }

          // Group by time - only if it has meaningful content (not empty array)
          if (query.groupBy.time && 
              !Array.isArray(query.groupBy.time) && 
              query.groupBy.time.value && 
              query.groupBy.time.unit) {
            console.log('[DataSource] Adding time groupBy:', query.groupBy.time);
            const timeGroupBy: {
              name: string;
              range_size: { value: number; unit: string };
              group_count?: number;
            } = {
              name: 'time',
              range_size: {
                value: query.groupBy.time.value,
                unit: query.groupBy.time.unit
              }
            };

            if (query.groupBy.time.range_size) {
              timeGroupBy.group_count = query.groupBy.time.range_size;
            }

            metric.group_by.push(timeGroupBy);
          }

          // Group by value - only if it has meaningful content (not empty array)
          if (query.groupBy.value && 
              !Array.isArray(query.groupBy.value) && 
              query.groupBy.value.range_size) {
            console.log('[DataSource] Adding value groupBy:', query.groupBy.value);
            metric.group_by.push({
              name: 'value',
              range_size: query.groupBy.value.range_size
            });
          }
          
          console.log('[DataSource] Final metric.group_by:', JSON.stringify(metric.group_by, null, 2));
        }

        return metric;
      });

      const requestBody: KairosDBDatapointsRequest = {
        start_absolute: from,
        end_absolute: to,
        metrics: metrics
      };

      console.log('[DataSource] Making request to /api/v1/datapoints/query with body:', JSON.stringify(requestBody, null, 2));

      const response = await getBackendSrv().fetch({
        url: `${this.baseUrl}/api/v1/datapoints/query`,
        method: 'POST',
        data: requestBody
      });

      const result = await lastValueFrom(response);
      const data = result.data as KairosDBDatapointsResponse;
      
      console.log('[DataSource] Received datapoints query response:', JSON.stringify(data, null, 2));

      if (!data || !data.queries || data.queries.length === 0) {
        console.warn('[DataSource] No queries in datapoints response');
        return { data: [] };
      }

      // Convert KairosDB response to Grafana data frames
      const dataFrames: any[] = [];
      
      data.queries.forEach((query, queryIndex: number) => {
        const target = validTargets[queryIndex];
        const targetQuery = target.query!;
        
        if (!query.results || query.results.length === 0) {
          console.log('[DataSource] No results for query:', queryIndex);
          return;
        }

        query.results.forEach((result, resultIndex: number) => {
          const metricName = result.name;
          const alias = targetQuery.alias || metricName;
          const tags = result.tags || {};
          
          // Create series name including tags
          let seriesName = alias;
          const tagKeys = Object.keys(tags);
          if (tagKeys.length > 0) {
            const tagParts = tagKeys.map(key => `${key}=${tags[key].join(',')}`);
            seriesName = `${alias}{${tagParts.join(', ')}}`;
          }

          if (!result.values || result.values.length === 0) {
            console.log('[DataSource] No values for result:', resultIndex);
            return;
          }

          // Extract time and value arrays
          const timeValues: number[] = [];
          const dataValues: number[] = [];

          console.log('[DataSource] Processing values for result:', resultIndex, 'Raw values:', result.values.slice(0, 5));

          result.values.forEach((point, pointIndex) => {
            console.log(`[DataSource] Point ${pointIndex}:`, point, 'Type:', typeof point, 'IsArray:', Array.isArray(point));
            
            if (Array.isArray(point) && point.length >= 2) {
              const timestamp = point[0];
              const rawValue = point[1];
              
              console.log(`[DataSource] Point ${pointIndex} - timestamp:`, timestamp, 'type:', typeof timestamp, 'rawValue:', rawValue, 'type:', typeof rawValue);
              
              // Ensure timestamp is a number
              const numTimestamp = typeof timestamp === 'number' ? timestamp : Number(timestamp);
              
              // Handle different value types - KairosDB can return objects for raw data
              let numValue: number;
              
              if (typeof rawValue === 'number') {
                numValue = rawValue;
              } else if (typeof rawValue === 'string') {
                numValue = Number(rawValue);
              } else if (typeof rawValue === 'object' && rawValue !== null) {
                // KairosDB raw data might be objects - try to extract a numeric value
                console.log('[DataSource] Complex value object:', rawValue);
                
                // Common patterns in KairosDB objects
                const valueObj = rawValue as any;
                if ('value' in valueObj) {
                  numValue = Number(valueObj.value);
                } else if ('double_value' in valueObj) {
                  numValue = Number(valueObj.double_value);
                } else if ('long_value' in valueObj) {
                  numValue = Number(valueObj.long_value);
                } else {
                  console.warn('[DataSource] Cannot extract numeric value from object:', rawValue);
                  return; // skip this point
                }
              } else {
                console.warn('[DataSource] Unknown value type:', typeof rawValue, rawValue);
                return; // skip this point
              }
              
              console.log(`[DataSource] Point ${pointIndex} - final numTimestamp:`, numTimestamp, 'numValue:', numValue);
              
              if (!isNaN(numTimestamp) && !isNaN(numValue)) {
                timeValues.push(numTimestamp);
                dataValues.push(numValue);
              } else {
                console.warn('[DataSource] Skipping invalid point after processing:', { timestamp, rawValue, numTimestamp, numValue });
              }
            } else {
              console.warn('[DataSource] Invalid point format:', point);
            }
          });

          console.log('[DataSource] Final arrays - timeValues:', timeValues.slice(0, 5), 'dataValues:', dataValues.slice(0, 5));

          const frame = createDataFrame({
            refId: target.refId,
            name: seriesName,
            fields: [
              { name: 'Time', values: timeValues, type: FieldType.time },
              { name: 'Value', values: dataValues, type: FieldType.number },
            ],
          });

          console.log('[DataSource] Created data frame:', { 
            refId: target.refId, 
            name: seriesName, 
            points: timeValues.length 
          });
          dataFrames.push(frame);
        });
      });

      console.log('[DataSource] Returning query result with', dataFrames.length, 'data frames');
      return { data: dataFrames };

    } catch (error) {
      console.error('[DataSource] Error in KairosDB query method:', error);
      return { 
        data: [],
        error: {
          message: error instanceof Error ? error.message : 'Unknown query error'
        }
      };
    }
  }

  async request(url: string, params?: string) {
    const response = getBackendSrv().fetch({
      url: `${this.baseUrl}${url}${params?.length ? `?${params}` : ''}`,
    });
    return lastValueFrom(response);
  }

  /**
   * Get available metric names for autocomplete (public interface with caching and debouncing)
   */
  async getMetricNames(query?: string): Promise<string[]> {
    console.log('[DataSource] getMetricNames called with query:', query);
    
    // Generate cache key including suffix configuration
    const suffixesToIgnore = this.getSuffixesToIgnore();
    const cacheKey = generateCacheKey(query, suffixesToIgnore);
    
    // Check cache first
    const cachedResult = this.metricNamesCache.get(cacheKey);
    if (cachedResult) {
      console.log('[DataSource] Returning cached result for key:', cacheKey, 'count:', cachedResult.length);
      return cachedResult;
    }
    
    console.log('[DataSource] Cache miss for key:', cacheKey, ', using debounced fetch');
    
    // Use debounced version to reduce server calls
    return this.debouncedGetMetricNames(query);
  }

  /**
   * Internal method that actually fetches metric names from server
   */
  private async getMetricNamesInternal(query?: string): Promise<string[]> {
    console.log('[DataSource] getMetricNamesInternal called with query:', query);
    
    try {
      const suffixesToIgnore = this.getSuffixesToIgnore();
      const cacheKey = generateCacheKey(query, suffixesToIgnore);
      
      // Double-check cache in case another call populated it
      const cachedResult = this.metricNamesCache.get(cacheKey);
      if (cachedResult) {
        console.log('[DataSource] Found cached result during internal fetch:', cachedResult.length, 'metrics');
        return cachedResult;
      }
      
      // Parse the search query to determine mode and actual search term
      const { isPrefixMode, searchTerm } = parseSearchQuery(query);
      console.log('[DataSource] Parsed search:', { isPrefixMode, searchTerm, originalQuery: query });
      
      // Determine API strategy based on search mode
      const apiCacheKey = generateApiCacheKey(query);
      
      // Check API response cache
      let rawMetrics = this.apiResponseCache.get(apiCacheKey);
      
      if (!rawMetrics) {
        // Need to make API request
        let apiUrl: string;
        
        if (isPrefixMode && searchTerm.length >= 2) {
          // Use prefix API for ^prefix searches with sufficient length
          apiUrl = `/api/v1/metricnames?prefix=${encodeURIComponent(searchTerm)}`;
          console.log('[DataSource] Making PREFIX request to:', apiUrl);
        } else {
          // Use all metrics for contains searches or short prefix searches
          apiUrl = '/api/v1/metricnames';
          console.log('[DataSource] Making ALL METRICS request to:', apiUrl);
        }
        
        const response = await this.request(apiUrl);
        const data = response.data as KairosDBMetricNamesResponse;
        
        console.log('[DataSource] Received metric names response:', data?.results?.length || 0, 'metrics');
        
        if (!data || !data.results) {
          console.warn('[DataSource] No results in metric names response');
          return [];
        }

        rawMetrics = data.results;
        
        // Cache the raw API response
        this.apiResponseCache.set(apiCacheKey, rawMetrics);
        console.log('[DataSource] Cached API response for key:', apiCacheKey, 'count:', rawMetrics.length);
      } else {
        console.log('[DataSource] Using cached API response:', apiCacheKey, 'count:', rawMetrics.length);
      }

      let filteredMetrics = [...rawMetrics];
      
      // Filter out metrics with configured suffixes
      if (suffixesToIgnore.length > 0) {
        console.log('[DataSource] Filtering out metrics with suffixes:', suffixesToIgnore);
        const originalCount = filteredMetrics.length;
        
        filteredMetrics = filteredMetrics.filter((metric: string) => {
          return !suffixesToIgnore.some(suffix => metric.endsWith(suffix));
        });
        
        console.log('[DataSource] Filtered out', (originalCount - filteredMetrics.length), 'metrics with ignored suffixes');
        console.log('[DataSource] Remaining metrics count:', filteredMetrics.length);
      }
      
      // Apply additional client-side filtering if needed
      if (searchTerm && searchTerm.length > 0) {
        console.log('[DataSource] Applying client-side filtering:', { isPrefixMode, searchTerm });
        console.log('[DataSource] Sample metrics before filtering:', filteredMetrics.slice(0, 10));
        
        if (isPrefixMode) {
          // For prefix mode, filter to metrics that start with the search term
          // (This is additional filtering if we got all metrics instead of using prefix API)
          filteredMetrics = filteredMetrics.filter((metric: string) => 
            metric.toLowerCase().startsWith(searchTerm.toLowerCase())
          );
          console.log('[DataSource] Applied PREFIX filtering for term:', searchTerm);
        } else {
          // For contains mode, filter to metrics that contain the search term
          filteredMetrics = filteredMetrics.filter((metric: string) => 
            metric.toLowerCase().includes(searchTerm.toLowerCase())
          );
          console.log('[DataSource] Applied CONTAINS filtering for term:', searchTerm);
        }
        
        console.log('[DataSource] Filtered metrics by query (showing first 10):', filteredMetrics.slice(0, 10));
        console.log('[DataSource] Total client-filtered metrics count:', filteredMetrics.length);
      }

      // Cache the final result
      this.metricNamesCache.set(cacheKey, filteredMetrics);
      console.log('[DataSource] Cached final result for key:', cacheKey, 'count:', filteredMetrics.length);

      console.log('[DataSource] getMetricNamesInternal returning:', filteredMetrics.length, 'metrics');
      return filteredMetrics;
    } catch (error) {
      console.error('[DataSource] Error fetching metric names:', error);
      // Return empty array on error instead of throwing
      return [];
    }
  }

  /**
   * Get available tags for a metric
   */
  async getMetricTags(metricName: string): Promise<{ [key: string]: string[] }> {
    console.log('[DataSource] getMetricTags called with metricName:', metricName);
    
    try {
      if (!metricName) {
        console.log('[DataSource] No metric name provided, returning empty tags');
        return {};
      }

      const requestBody: KairosDBMetricTagsRequest = {
        start_absolute: Date.now() - (24 * 60 * 60 * 1000), // 24 hours ago
        end_absolute: Date.now(),
        metrics: [
          {
            name: metricName
          }
        ]
      };

      console.log('[DataSource] Making request to /api/v1/datapoints/query/tags with body:', requestBody);
      const response = await getBackendSrv().fetch({
        url: `${this.baseUrl}/api/v1/datapoints/query/tags`,
        method: 'POST',
        data: requestBody
      });

      const result = await lastValueFrom(response);
      const data = result.data as KairosDBMetricTagsResponse;
      
      console.log('[DataSource] Received metric tags response:', data);
      
      if (!data || !data.queries || data.queries.length === 0) {
        console.warn('[DataSource] No queries in metric tags response');
        return {};
      }

      const query = data.queries[0];
      if (!query.results || query.results.length === 0) {
        console.log('[DataSource] No results for metric tags');
        return {};
      }

      const metric = query.results[0];
      const tags = metric.tags || {};
      
      console.log('[DataSource] getMetricTags returning:', tags);
      return tags;
    } catch (error) {
      console.error('[DataSource] Error fetching metric tags:', error);
      return {};
    }
  }

  /**
   * Variable support for templating
   * Supports three query types:
   * - metrics(pattern): Get metric names containing pattern
   * - tag_names(metric): Get tag names for a metric
   * - tag_values(metric, tag_name [, filter1=value1, ...]): Get tag values with optional filters
   */
  async metricFindQuery(query: string, options?: { scopedVars?: ScopedVars }): Promise<MetricFindValue[]> {
    try {
      console.log('[DataSource] metricFindQuery called with:', { query, options });
      
      // Parse the query to determine type and parameters
      const parsedQuery = VariableQueryParser.parse(query);
      
      if (parsedQuery) {
        console.log('[DataSource] Parsed variable query:', parsedQuery);
        
        // Execute the parsed query
        const result = await this.variableQueryExecutor.execute(parsedQuery, options?.scopedVars);
        
        console.log('[DataSource] metricFindQuery returning:', result.length, 'values:', result);
        return result;
      } else {
        // Fallback: if query doesn't match any function patterns, treat as simple metric name filter
        console.log('[DataSource] Query did not match any function patterns, using as metric name filter');
        const metrics = await this.getMetricNames(query);
        const result = metrics.map(metric => ({
          text: metric,
          value: metric
        }));
        
        console.log('[DataSource] metricFindQuery (fallback) returning:', result.length, 'values:', result);
        return result;
      }
    } catch (error) {
      console.error('[DataSource] Error in metricFindQuery:', error);
      return [];
    }
  }

  /**
   * Support for annotations (optional)
   */
  annotations = {};

  /**
   * Interpolate variables in queries
   */
  interpolateVariablesInQueries(queries: KairosDBQuery[], scopedVars?: ScopedVars): KairosDBQuery[] {
    return queries.map(query => ({
      ...query,
      query: query.query ? this.interpolateQueryObject(query.query, scopedVars) : query.query
    }));
  }

  private interpolateQueryObject(query: any, scopedVars?: ScopedVars): any {
    if (!query || !scopedVars) {
      return query;
    }

    const interpolated = { ...query };

    // Interpolate metric name
    if (interpolated.metricName) {
      interpolated.metricName = this.interpolateVariable(interpolated.metricName, scopedVars);
    }

    // Interpolate alias
    if (interpolated.alias) {
      interpolated.alias = this.interpolateVariable(interpolated.alias, scopedVars);
    }

    // Interpolate tags
    if (interpolated.tags) {
      interpolated.tags = this.interpolateTagsObject(interpolated.tags, scopedVars);
    }

    // Interpolate group by
    if (interpolated.groupBy) {
      interpolated.groupBy = this.interpolateGroupByObject(interpolated.groupBy, scopedVars);
    }

    // Interpolate aggregators
    if (interpolated.aggregators && Array.isArray(interpolated.aggregators)) {
      interpolated.aggregators = interpolated.aggregators.map((agg: any) => 
        this.interpolateAggregatorObject(agg, scopedVars)
      );
    }

    return interpolated;
  }

  private interpolateTagsObject(tags: { [key: string]: string[] }, scopedVars: ScopedVars): { [key: string]: string[] } {
    const interpolatedTags: { [key: string]: string[] } = {};
    
    Object.keys(tags).forEach(tagName => {
      const tagValues = tags[tagName];
      if (Array.isArray(tagValues)) {
        interpolatedTags[tagName] = tagValues.map(value => {
          const interpolated = this.interpolateVariable(value, scopedVars);
          // If the interpolated value contains commas, split it (multi-value variable)
          return interpolated.includes(',') ? interpolated.split(',') : [interpolated];
        }).flat();
      } else {
        interpolatedTags[tagName] = tagValues;
      }
    });

    return interpolatedTags;
  }

  private interpolateGroupByObject(groupBy: any, scopedVars: ScopedVars): any {
    const interpolated = { ...groupBy };

    // Interpolate group by tags
    if (interpolated.tags && Array.isArray(interpolated.tags)) {
      interpolated.tags = interpolated.tags.map((tag: string) => {
        const interpolatedTag = this.interpolateVariable(tag, scopedVars);
        // If the interpolated value contains commas, split it (multi-value variable)
        return interpolatedTag.includes(',') ? interpolatedTag.split(',') : [interpolatedTag];
      }).flat();
    }

    return interpolated;
  }

  private interpolateAggregatorObject(aggregator: any, scopedVars: ScopedVars): any {
    const interpolated = { ...aggregator };

    // Interpolate aggregator parameters
    if (interpolated.parameters && Array.isArray(interpolated.parameters)) {
      interpolated.parameters = interpolated.parameters.map((param: any) => ({
        ...param,
        value: this.interpolateVariable(String(param.value || ''), scopedVars)
      }));
    }

    return interpolated;
  }

  interpolateVariable(value: string, scopedVars?: ScopedVars): string {
    if (!value || !scopedVars) {
      return value;
    }

    // Handle both $variable and ${variable} syntax
    return value
      .replace(/\$\{([^}]+)\}/g, (match, varName) => {
        // Handle ${variable} syntax (with potential format specifiers)
        const [name, format] = varName.split(':');
        const variable = scopedVars[name];
        return variable ? this.formatVariable(variable.value, format) : match;
      })
      .replace(/\$(\w+)/g, (match, varName) => {
        // Handle $variable syntax
        const variable = scopedVars[varName];
        return variable ? this.formatVariable(variable.value) : match;
      });
  }

  private formatVariable(value: any, format?: string): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    // Handle array values (multi-value variables)
    if (Array.isArray(value)) {
      switch (format) {
        case 'pipe':
          return value.join('|');
        case 'regex':
          return `(${value.join('|')})`;
        case 'distributed':
          // For distributed queries, each value should be handled separately
          return value.join(',');
        default:
          return value.join(',');
      }
    }

    return String(value);
  }

  /**
   * Clear metric names cache (useful for debugging or forced refresh)
   */
  clearMetricNamesCache(): void {
    console.log('[DataSource] Clearing both metric names and API response caches');
    this.metricNamesCache.clear();
    this.apiResponseCache.clear();
  }

  /**
   * Get metric names cache statistics
   */
  getMetricNamesCacheStats(): { metricNames: { size: number; keys: string[] }, apiResponses: { size: number; keys: string[] } } {
    return {
      metricNames: this.metricNamesCache.getStats(),
      apiResponses: this.apiResponseCache.getStats()
    };
  }

  /**
   * Get list of metric suffixes to ignore from datasource configuration
   */
  private getSuffixesToIgnore(): string[] {
    const configuredSuffixes = this.settings.jsonData?.metricSuffixesToIgnore;
    
    if (!configuredSuffixes) {
      // Return default suffixes if not configured
      return ['_1h', '_1d'];
    }
    
    // Parse comma-separated list and trim whitespace
    return configuredSuffixes
      .split(',')
      .map((suffix: string) => suffix.trim())
      .filter((suffix: string) => suffix.length > 0);
  }

  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          // If target doesn't have this key, create it
          if (!target[key] || typeof target[key] !== 'object') {
            target[key] = {};
          }
          // Recursively merge nested objects
          this.deepMerge(target[key], source[key]);
        } else {
          // Direct assignment for primitive values and arrays
          target[key] = source[key];
        }
      }
    }
  }

  /**
   * Checks whether we can connect to the KairosDB API.
   */
  async testDatasource() {
    const defaultErrorMessage = 'Cannot connect to KairosDB';

    try {
      const response = await this.request('/api/v1/version');
      if (response.status === 200) {
        const data = response.data as KairosDBVersionResponse;
        return {
          status: 'success',
          message: `Successfully connected to KairosDB version ${data.version}`,
        };
      } else {
        return {
          status: 'error',
          message: response.statusText ? response.statusText : defaultErrorMessage,
        };
      }
    } catch (err) {
      let message = '';
      if (typeof err === 'string') {
        message = err;
      } else if (isFetchError(err)) {
        message = 'Fetch error: ' + (err.statusText ? err.statusText : defaultErrorMessage);
        if (err.data && err.data.error && err.data.error.code) {
          message += ': ' + err.data.error.code + '. ' + err.data.error.message;
        }
      }
      return {
        status: 'error',
        message: message || defaultErrorMessage,
      };
    }
  }
}
