import { getBackendSrv, isFetchError, getTemplateSrv } from '@grafana/runtime';
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
      this.metricNamesCache.cleanup();
      this.apiResponseCache.cleanup();
    }, 10 * 60 * 1000);
  }

  async initialize(): Promise<void> {
    // Initialize any required data here
    this.initialized = true;
  }

  getDefaultQuery(_: CoreApp): Partial<KairosDBQuery> {
    return DEFAULT_QUERY;
  }

  filterQuery(query: KairosDBQuery): boolean {
    // Allow the QueryEditor to always render (return true for UI)
    // Only prevent query EXECUTION when there's no metric name
    // The QueryEditor itself should always be shown
    return true;
  }

  async query(options: DataQueryRequest<KairosDBQuery>): Promise<DataQueryResponse> {
    try {
      
      const { range } = options;
      if (!range) {
        return { data: [] };
      }

      const from = range.from.valueOf();
      const to = range.to.valueOf();


      // Apply template variable interpolation for non-metric fields using Grafana's built-in service
      // Note: metricName interpolation is handled in expandMetricNames to properly handle multi-value variables
      const templateSrv = getTemplateSrv();
      const interpolatedTargets = options.targets.map(target => ({
        ...target,
        query: target.query ? {
          ...target.query,
          // metricName is handled in expandMetricNames, don't interpolate here
          alias: templateSrv.replace(target.query.alias || '', options.scopedVars),
          tags: this.interpolateTagsWithTemplateSrv(target.query.tags || {}, options.scopedVars),
          groupBy: target.query.groupBy ? {
            ...target.query.groupBy,
            tags: target.query.groupBy.tags ? target.query.groupBy.tags.map(tag => 
              templateSrv.replace(tag, options.scopedVars)
            ) : []
          } : target.query.groupBy,
          aggregators: target.query.aggregators ? target.query.aggregators.map(agg => ({
            ...agg,
            parameters: agg.parameters ? agg.parameters.map(param => ({
              ...param,
              value: templateSrv.replace(String(param.value || ''), options.scopedVars)
            })) : agg.parameters
          })) : target.query.aggregators
        } : target.query
      }));
      

      // Filter out targets without metric names
      const validTargets = interpolatedTargets.filter(target => {
        const hasMetricName = !!(target.query?.metricName);
        return hasMetricName;
      });

      if (validTargets.length === 0) {
        return { data: [] };
      }

      // Build KairosDB query request - expand multi-value variables in metric names
      // Also track which target each metric belongs to for response mapping
      const metrics: KairosDBDatapointsRequest['metrics'] = [];
      const metricNameToTargetMap: { [compositeKey: string]: any } = {};
      const metricOrderToRefId: { [metricName: string]: string[] } = {};
      
      validTargets.forEach((target, targetIndex) => {
        const query = target.query!;
        
        // FIX: Get the original alias before Grafana's pre-processing
        // This prevents the bug where Grafana converts $location to {Attic,Bedroom,Office}
        const originalTarget = options.targets[targetIndex];
        const originalAlias = originalTarget?.query?.alias || query.alias;
        
        
        // Expand metric names BEFORE template interpolation to handle multi-value variables properly
        const expansion = this.expandMetricNames(query.metricName!, target.refId, options.scopedVars);
        
        // Create a separate metric object for each expanded metric name
        expansion.names.forEach((metricName, index) => {
          // Track which target this metric belongs to AND the variable values used for this expansion
          // IMPORTANT: Store the original alias before Grafana's pre-processing
          const targetWithOriginalAlias = {
            ...target,
            query: {
              ...target.query!,
              alias: originalAlias // Use original alias instead of processed one
            }
          };
          
          // Use composite key to avoid collisions when multiple targets query the same metric
          const compositeKey = `${metricName}|${target.refId}`;
          metricNameToTargetMap[compositeKey] = {
            target: targetWithOriginalAlias,
            variableValues: expansion.variableValues[index]
          };
          
          // Track the order of refIds for each metric name to handle multiple targets for same metric
          if (!metricOrderToRefId[metricName]) {
            metricOrderToRefId[metricName] = [];
          }
          metricOrderToRefId[metricName].push(target.refId);
          const metric: KairosDBDatapointsRequest['metrics'][0] = {
            name: metricName
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
            
            const aggregator: { name: string; [key: string]: any } = {
              name: agg.name
            };
            
            // Add parameters if any, using ParameterObjectBuilder for proper auto value handling
            if (agg.parameters && agg.parameters.length > 0) {
              const parameterBuilder = new ParameterObjectBuilder(options.interval || '1m', agg);
              
              // Collect parameters by type to handle merging intelligently
              const alignmentParam = agg.parameters.find(p => p.type === 'alignment');
              const samplingParams = agg.parameters.filter(p => p.type === 'sampling' || p.type === 'sampling_unit');
              const otherParams = agg.parameters.filter(p => p.type !== 'alignment' && p.type !== 'sampling' && p.type !== 'sampling_unit');
              
              // Handle alignment parameter first
              if (alignmentParam && alignmentParam.value !== undefined && alignmentParam.value !== null && alignmentParam.value !== '') {
                
                // Map old alignment values to KairosDB API format
                switch (alignmentParam.value) {
                  case 'SAMPLING':
                    aggregator.align_sampling = true;
                    // When alignment is SAMPLING, create sampling object with value/unit
                    if (samplingParams.length > 0) {
                      const samplingObj: any = {};
                      samplingParams.forEach(param => {
                        if (param.value !== undefined && param.value !== null && param.value !== '') {
                          let processedValue: any = param.value;
                          
                          // Apply auto value logic
                          if (parameterBuilder.isOverriddenByAutoValue && parameterBuilder.isOverriddenByAutoValue(param)) {
                            processedValue = param.type === 'sampling' ? parameterBuilder.autoIntervalValue : parameterBuilder.autoIntervalUnit;
                          }
                          
                          // Convert numeric values
                          if (param.name === 'value') {
                            processedValue = typeof processedValue === 'string' ? parseFloat(processedValue) : processedValue;
                          }
                          
                          samplingObj[param.name] = processedValue;
                        }
                      });
                      aggregator.sampling = samplingObj;
                    }
                    break;
                    
                  case 'START_TIME':
                    aggregator.align_start_time = true;
                    break;
                    
                  case 'PERIOD':
                    aggregator.align_end_time = true;
                    break;
                    
                  case 'NONE':
                    // No alignment properties needed
                    break;
                    
                  default:
                    break;
                }
              }
              
              // Handle other parameters
              otherParams.forEach(param => {
                if (param.value !== undefined && param.value !== null && param.value !== '') {
                  
                  const parameterObject = parameterBuilder.build(param);
                  
                  // Deep merge the parameter object into the aggregator
                  this.deepMerge(aggregator, parameterObject);
                }
              });
            }

            return aggregator;
          });
        }

        // Add group by if specified
        if (query.groupBy) {
          metric.group_by = [];

          // Group by tags
          if (query.groupBy.tags && query.groupBy.tags.length > 0) {
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
            metric.group_by.push({
              name: 'value',
              range_size: query.groupBy.value.range_size
            });
          }
          
        }

          // Add the completed metric to the metrics array
          metrics.push(metric);
        });
      });

      const requestBody: KairosDBDatapointsRequest = {
        start_absolute: from,
        end_absolute: to,
        metrics: metrics
      };


      const response = await getBackendSrv().fetch({
        url: `${this.baseUrl}/api/v1/datapoints/query`,
        method: 'POST',
        data: requestBody
      });

      const result = await lastValueFrom(response);
      const data = result.data as KairosDBDatapointsResponse;
      

      if (!data || !data.queries || data.queries.length === 0) {
        return { data: [] };
      }

      // Convert KairosDB response to Grafana data frames
      const dataFrames: any[] = [];
      
      // Track which result index we're on for each metric to handle multiple targets
      const metricResultCount: { [metricName: string]: number } = {};
      
      data.queries.forEach((query, queryIndex: number) => {
        if (!query.results || query.results.length === 0) {
          return;
        }

        query.results.forEach((result, resultIndex: number) => {
          const metricName = result.name;
          
          // Determine which refId this result corresponds to
          if (!metricResultCount[metricName]) {
            metricResultCount[metricName] = 0;
          }
          
          const refIdOrder = metricOrderToRefId[metricName];
          if (!refIdOrder || refIdOrder.length === 0) {
            console.warn(`No refId order found for metric: ${metricName}`);
            return;
          }
          
          // Determine which refId this result belongs to based on result order
          // When multiple targets have the same metric, KairosDB returns all results for 
          // first target, then all results for second target, etc.
          const resultsPerTarget = Math.ceil(query.results.filter(r => r.name === metricName).length / refIdOrder.length);
          const refIdIndex = Math.floor(metricResultCount[metricName] / resultsPerTarget);
          const refId = refIdOrder[refIdIndex] || refIdOrder[refIdOrder.length - 1];
          const compositeKey = `${metricName}|${refId}`;
          
          const mappingInfo = metricNameToTargetMap[compositeKey];
          if (!mappingInfo) {
            console.warn(`No mapping found for composite key: ${compositeKey}`);
            return;
          }
          
          metricResultCount[metricName]++;
          const targetForQuery = mappingInfo.target;
          const metricVariableValues = mappingInfo.variableValues;
          const targetQuery = targetForQuery.query!;
          const alias = targetQuery.alias || metricName;
          const tags = result.tags || {};
          
          // Create $_tag_group_{tagName} variables for alias interpolation
          const tagGroupVars: { [key: string]: any } = {};
          const groupByTags = targetQuery.groupBy?.tags || [];
          
          // For each tag that we're grouping by, create a $_tag_group_{tagName} variable
          groupByTags.forEach((tagName: string) => {
            if (tags[tagName] && tags[tagName].length > 0) {
              // Use the first tag value (KairosDB group by typically results in single values per series)
              tagGroupVars[`_tag_group_${tagName}`] = {
                text: tags[tagName][0],
                value: tags[tagName][0]
              };
            }
          });
          
          // Create scoped vars combining metric-specific variable values with tag group variables
          const seriesScopedVars = {
            ...metricVariableValues, // Use the specific variable values for this expanded metric
            ...tagGroupVars
          };
          
          // Interpolate alias with both multi-value variables and tag group variables
          const templateSrv = getTemplateSrv();
          let interpolatedAlias = alias;
          try {
            interpolatedAlias = templateSrv.replace(alias, seriesScopedVars);
          } catch (error) {
            console.error('Template error:', error);
            interpolatedAlias = alias;
          }
          
          // Create series name - use interpolated alias or fall back to metric name with relevant tags
          let seriesName = interpolatedAlias;
          
          // Only include tags that were explicitly specified in the query
          const relevantTagKeys = this.getRelevantTagKeys(targetQuery, tags);
          
          // If alias wasn't changed and we have relevant tags, include them in the series name
          if (seriesName === alias && relevantTagKeys.length > 0) {
            const tagParts = relevantTagKeys.map(key => `${key}=${tags[key].join(',')}`);
            seriesName = `${interpolatedAlias}{${tagParts.join(', ')}}`;
          }

          if (!result.values || result.values.length === 0) {
            return;
          }

          // Extract time and value arrays
          const timeValues: number[] = [];
          const dataValues: number[] = [];


          result.values.forEach((point, pointIndex) => {
            
            if (Array.isArray(point) && point.length >= 2) {
              const timestamp = point[0];
              const rawValue = point[1];
              
              
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
                
                // Common patterns in KairosDB objects
                const valueObj = rawValue as any;
                if ('value' in valueObj) {
                  numValue = Number(valueObj.value);
                } else if ('double_value' in valueObj) {
                  numValue = Number(valueObj.double_value);
                } else if ('long_value' in valueObj) {
                  numValue = Number(valueObj.long_value);
                } else {
                  return; // skip this point
                }
              } else {
                return; // skip this point
              }
              
              
              if (!isNaN(numTimestamp) && !isNaN(numValue)) {
                timeValues.push(numTimestamp);
                dataValues.push(numValue);
              } else {
              }
            } else {
            }
          });


          const frame = createDataFrame({
            refId: targetForQuery.refId,
            name: seriesName,
            fields: [
              { name: 'Time', values: timeValues, type: FieldType.time },
              { name: 'Value', values: dataValues, type: FieldType.number },
            ],
          });

          dataFrames.push(frame);
        });
      });

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
    
    // Generate cache key including suffix configuration
    const suffixesToIgnore = this.getSuffixesToIgnore();
    const cacheKey = generateCacheKey(query, suffixesToIgnore);
    
    // Check cache first
    const cachedResult = this.metricNamesCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    
    // Use debounced version to reduce server calls
    return this.debouncedGetMetricNames(query);
  }

  /**
   * Internal method that actually fetches metric names from server
   */
  private async getMetricNamesInternal(query?: string): Promise<string[]> {
    
    try {
      const suffixesToIgnore = this.getSuffixesToIgnore();
      const cacheKey = generateCacheKey(query, suffixesToIgnore);
      
      // Double-check cache in case another call populated it
      const cachedResult = this.metricNamesCache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }
      
      // Parse the search query to determine mode and actual search term
      const { isPrefixMode, searchTerm } = parseSearchQuery(query);
      
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
        } else {
          // Use all metrics for contains searches or short prefix searches
          apiUrl = '/api/v1/metricnames';
        }
        
        const response = await this.request(apiUrl);
        const data = response.data as KairosDBMetricNamesResponse;
        
        
        if (!data || !data.results) {
          return [];
        }

        rawMetrics = data.results;
        
        // Cache the raw API response
        this.apiResponseCache.set(apiCacheKey, rawMetrics);
      } else {
      }

      let filteredMetrics = [...rawMetrics];
      
      // Filter out metrics with configured suffixes
      if (suffixesToIgnore.length > 0) {
        
        filteredMetrics = filteredMetrics.filter((metric: string) => {
          return !suffixesToIgnore.some(suffix => metric.endsWith(suffix));
        });
        
      }
      
      // Apply additional client-side filtering if needed
      if (searchTerm && searchTerm.length > 0) {
        
        if (isPrefixMode) {
          // For prefix mode, filter to metrics that start with the search term
          // (This is additional filtering if we got all metrics instead of using prefix API)
          filteredMetrics = filteredMetrics.filter((metric: string) => 
            metric.toLowerCase().startsWith(searchTerm.toLowerCase())
          );
        } else {
          // For contains mode, filter to metrics that contain the search term
          filteredMetrics = filteredMetrics.filter((metric: string) => 
            metric.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
      }

      // Cache the final result
      this.metricNamesCache.set(cacheKey, filteredMetrics);

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
    
    try {
      if (!metricName) {
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

      const response = await getBackendSrv().fetch({
        url: `${this.baseUrl}/api/v1/datapoints/query/tags`,
        method: 'POST',
        data: requestBody
      });

      const result = await lastValueFrom(response);
      const data = result.data as KairosDBMetricTagsResponse;
      
      
      if (!data || !data.queries || data.queries.length === 0) {
        return {};
      }

      const query = data.queries[0];
      if (!query.results || query.results.length === 0) {
        return {};
      }

      const metric = query.results[0];
      const tags = metric.tags || {};
      
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
      
      // Parse the query to determine type and parameters
      const parsedQuery = VariableQueryParser.parse(query);
      
      if (parsedQuery) {
        
        // Execute the parsed query
        const result = await this.variableQueryExecutor.execute(parsedQuery, options?.scopedVars);
        
        return result;
      } else {
        // Fallback: if query doesn't match any function patterns, treat as simple metric name filter
        const metrics = await this.getMetricNames(query);
        const result = metrics.map(metric => ({
          text: metric,
          value: metric
        }));
        
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
    if (!value) {
      return value;
    }

    try {
      // Use Grafana's built-in template service for variable interpolation
      const templateSrv = getTemplateSrv();
      return templateSrv.replace(value, scopedVars);
    } catch (error) {
      
      // Fallback to custom implementation if Grafana's service fails
      if (!scopedVars) {
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
  }

  private interpolateTagsWithTemplateSrv(tags: { [key: string]: string[] }, scopedVars?: ScopedVars): { [key: string]: string[] } {
    const templateSrv = getTemplateSrv();
    const interpolatedTags: { [key: string]: string[] } = {};
    
    Object.keys(tags).forEach(tagName => {
      const tagValues = tags[tagName];
      if (Array.isArray(tagValues)) {
        interpolatedTags[tagName] = tagValues.map(value => {
          const interpolated = templateSrv.replace(value, scopedVars);
          // If the interpolated value contains commas, split it (multi-value variable)
          return interpolated.includes(',') ? interpolated.split(',') : [interpolated];
        }).flat();
      } else {
        interpolatedTags[tagName] = tagValues;
      }
    });

    return interpolatedTags;
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
   * Expand metric names that contain multi-value template variables
   * This method should be called BEFORE template interpolation to detect multi-value variables
   * and create separate metric names for each value
   * Returns both the expanded names and the variable values used for each expansion
   */
  private expandMetricNames(originalMetricName: string, refId: string, scopedVars?: ScopedVars): { names: string[], variableValues: ScopedVars[] } {
    
    if (!originalMetricName) {
      return { names: [], variableValues: [] };
    }
    
    // Debug: log all scopedVars to understand structure
    
    // Find all variables in the metric name (both $var and ${var} formats)
    const variableMatches = [
      ...originalMetricName.matchAll(/\$\{([^}]+)\}/g),
      ...originalMetricName.matchAll(/\$(\w+)/g)
    ];
    
    
    // First, check if we have multi-value variables directly in scopedVars
    let multiValueVariable: { name: string, values: string[] } | null = null;
    
    // Look for multi-value variables in scopedVars
    for (const match of variableMatches) {
      const varName = match[1];
      const variable = scopedVars?.[varName];
      
      if (variable && Array.isArray(variable.value) && variable.value.length > 1) {
        multiValueVariable = { name: varName, values: variable.value };
        break;
      }
    }
    
    // If no multi-value variable found in scopedVars, try template service (if available)
    const templateSrv = getTemplateSrv();
    
    if (!multiValueVariable && templateSrv) {
      try {
        // Do a normal interpolation to see if we get multi-value format
        const normallyInterpolated = templateSrv.replace(originalMetricName, scopedVars);
        
        // Check if the interpolated result contains the multi-value format {value1,value2,value3}
        const multiValuePattern = /\{([^}]+)\}/g;
        const multiValueMatch = multiValuePattern.exec(normallyInterpolated);
        
        if (multiValueMatch) {
          // Found multi-value format, extract the values
          const valuesString = multiValueMatch[1];
          const values = valuesString.split(',').map(v => v.trim());
          
          if (values.length > 1) {
            // Find which variable this corresponds to by checking each variable
            for (const match of variableMatches) {
              const varName = match[1];
              const singleVarPattern = new RegExp('\\$\\{?' + varName + '\\}?');
              
              if (singleVarPattern.test(originalMetricName)) {
                multiValueVariable = { name: varName, values };
                break;
              }
            }
          }
        }
      } catch (error) {
      }
    }
    
    if (!multiValueVariable) {
      // No multi-value variables, interpolate normally and return single metric
      if (templateSrv) {
        try {
          const interpolatedName = templateSrv.replace(originalMetricName, scopedVars);
          return { names: [interpolatedName], variableValues: [scopedVars || {}] };
        } catch (error) {
        }
      }
      
      // Fallback to manual interpolation when template service not available or failed
      let result = originalMetricName;
      for (const match of variableMatches) {
        const varName = match[1];
        const variable = scopedVars?.[varName];
        if (variable) {
          const value = Array.isArray(variable.value) ? variable.value[0] : String(variable.value);
          result = result.replace(match[0], value);
        }
      }
      return { names: [result], variableValues: [scopedVars || {}] };
    }
    
    // Expand the multi-value variable into separate metric names
    const expandedNames: string[] = [];
    const expandedVariableValues: ScopedVars[] = [];
    
    for (const value of multiValueVariable.values) {
      // Create a temporary scopedVars with this single value for the multi-value variable
      const tempScopedVars = {
        ...scopedVars,
        [multiValueVariable.name]: {
          text: value,
          value: value
        }
      };
      
      if (templateSrv) {
        try {
          const interpolatedName = templateSrv.replace(originalMetricName, tempScopedVars);
          expandedNames.push(interpolatedName);
          expandedVariableValues.push(tempScopedVars);
        } catch (error) {
          // Fallback to manual interpolation
          let result = originalMetricName;
          for (const match of variableMatches) {
            const varName = match[1];
            if (varName === multiValueVariable.name) {
              result = result.replace(match[0], value);
            } else {
              const variable = tempScopedVars[varName];
              if (variable) {
                const varValue = Array.isArray(variable.value) ? variable.value[0] : String(variable.value);
                result = result.replace(match[0], varValue);
              }
            }
          }
          expandedNames.push(result);
          expandedVariableValues.push(tempScopedVars);
        }
      } else {
        // Manual interpolation when template service not available
        let result = originalMetricName;
        for (const match of variableMatches) {
          const varName = match[1];
          if (varName === multiValueVariable.name) {
            result = result.replace(match[0], value);
          } else {
            const variable = tempScopedVars[varName];
            if (variable) {
              const varValue = Array.isArray(variable.value) ? variable.value[0] : String(variable.value);
              result = result.replace(match[0], varValue);
            }
          }
        }
        expandedNames.push(result);
        expandedVariableValues.push(tempScopedVars);
      }
    }
    
    return { names: expandedNames, variableValues: expandedVariableValues };
  }

  /**
   * Get the tag keys that should be included in series names.
   * Only includes tags that were explicitly specified in the query's tags section or groupBy.tags
   */
  private getRelevantTagKeys(targetQuery: any, resultTags: { [key: string]: string[] }): string[] {
    const relevantTagKeys: string[] = [];
    
    // Include tags that were specified in the query.tags section
    if (targetQuery.tags && typeof targetQuery.tags === 'object') {
      Object.keys(targetQuery.tags).forEach(tagKey => {
        // Only include if this tag key has values in the query AND in the result
        if (targetQuery.tags[tagKey] && targetQuery.tags[tagKey].length > 0 && resultTags[tagKey]) {
          relevantTagKeys.push(tagKey);
        }
      });
    }
    
    // Include tags that were specified in groupBy.tags
    if (targetQuery.groupBy && targetQuery.groupBy.tags && Array.isArray(targetQuery.groupBy.tags)) {
      targetQuery.groupBy.tags.forEach((tagKey: string) => {
        // Only include if this tag exists in the result and we haven't already added it
        if (resultTags[tagKey] && !relevantTagKeys.includes(tagKey)) {
          relevantTagKeys.push(tagKey);
        }
      });
    }
    
    
    return relevantTagKeys;
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
