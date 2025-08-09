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

export class DataSource extends DataSourceApi<KairosDBQuery, KairosDBDataSourceOptions> {
  baseUrl: string;
  initialized: boolean = false;

  constructor(instanceSettings: DataSourceInstanceSettings<KairosDBDataSourceOptions>) {
    super(instanceSettings);
    this.baseUrl = instanceSettings.url!;
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

      // Filter out targets without metric names
      const validTargets = options.targets.filter(target => {
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
          metric.group_by = [];

          // Group by tags
          if (query.groupBy.tags && query.groupBy.tags.length > 0) {
            metric.group_by.push({
              name: 'tag',
              tags: query.groupBy.tags
            });
          }

          // Group by time
          if (query.groupBy.time) {
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

          // Group by value
          if (query.groupBy.value) {
            metric.group_by.push({
              name: 'value',
              range_size: query.groupBy.value.range_size
            });
          }
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
   * Get available metric names for autocomplete
   */
  async getMetricNames(query?: string): Promise<string[]> {
    console.log('[DataSource] getMetricNames called with query:', query);
    
    try {
      console.log('[DataSource] Making request to /api/v1/metricnames');
      const response = await this.request('/api/v1/metricnames');
      const data = response.data as KairosDBMetricNamesResponse;
      
      console.log('[DataSource] Received metric names response:', data);
      
      if (!data || !data.results) {
        console.warn('[DataSource] No results in metric names response');
        return [];
      }

      let metrics = data.results;
      
      // Filter by query if provided
      if (query && query.length > 0) {
        metrics = metrics.filter((metric: string) => 
          metric.toLowerCase().includes(query.toLowerCase())
        );
        console.log('[DataSource] Filtered metrics by query:', metrics);
      }

      console.log('[DataSource] getMetricNames returning:', metrics);
      return metrics;
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
   */
  async metricFindQuery(query: string, options?: { scopedVars?: ScopedVars }): Promise<MetricFindValue[]> {
    try {
      console.log('KairosDB metricFindQuery called with:', { query, options });
      
      // This would implement variable queries for KairosDB
      // For now, return mock metric names
      const metrics = await this.getMetricNames(query);
      const result = metrics.map(metric => ({
        text: metric,
        value: metric
      }));
      
      console.log('metricFindQuery returning:', result.length, 'values');
      return result;
    } catch (error) {
      console.error('Error in metricFindQuery:', error);
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
      query: query.query ? {
        ...query.query,
        metricName: this.interpolateVariable(query.query.metricName || '', scopedVars)
      } : query.query
    }));
  }

  private interpolateVariable(value: string, scopedVars?: ScopedVars): string {
    // Simple variable interpolation - this would be more sophisticated in a real implementation
    if (!value || !scopedVars) {
      return value;
    }

    return value.replace(/\$(\w+)/g, (match, varName) => {
      const variable = scopedVars[varName];
      return variable ? variable.value : match;
    });
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
