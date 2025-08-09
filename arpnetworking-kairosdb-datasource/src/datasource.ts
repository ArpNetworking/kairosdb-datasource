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

import { KairosDBQuery, KairosDBDataSourceOptions, DEFAULT_QUERY } from './types';
import { lastValueFrom } from 'rxjs';

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
      console.log('KairosDB query called with options:', options);
      
      const { range } = options;
      if (!range) {
        console.warn('No range provided in query options');
        return { data: [] };
      }

      const from = range.from.valueOf();
      const to = range.to.valueOf();

      console.log('Query range:', { from, to });
      console.log('Query targets:', options.targets);

      // For now, return mock data for each query
      // This will be replaced with actual KairosDB API calls
      const data = options.targets
        .filter(target => {
          // Only execute queries that have a metric name
          const hasMetricName = !!(target.query?.metricName);
          console.log('Target execution filter:', { refId: target.refId, hasMetricName, metricName: target.query?.metricName });
          return hasMetricName;
        })
        .map((target) => {
          const metricName = target.query?.metricName || 'unknown';
          const alias = target.query?.alias || metricName;
          
          console.log('Processing target:', { refId: target.refId, metricName, alias });
          
          // Generate more realistic time series data
          const timeValues: number[] = [];
          const dataValues: number[] = [];
          const stepSize = (to - from) / 100; // 100 data points
          
          for (let i = 0; i <= 100; i++) {
            timeValues.push(from + (i * stepSize));
            dataValues.push(Math.random() * 100 + Math.sin(i / 10) * 20);
          }
          
          const frame = createDataFrame({
            refId: target.refId,
            name: alias,
            fields: [
              { name: 'Time', values: timeValues, type: FieldType.time },
              { name: 'Value', values: dataValues, type: FieldType.number },
            ],
          });

          console.log('Created data frame:', { refId: target.refId, name: alias, length: timeValues.length });
          return frame;
        });

      console.log('Returning query result with', data.length, 'data frames');
      return { data };
    } catch (error) {
      console.error('Error in KairosDB query method:', error);
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
      // This would call the actual KairosDB API
      // For now, return mock data
      const mockMetrics = [
        'server.cpu.usage',
        'server.memory.used',
        'server.disk.io',
        'application.requests.count',
        'application.response.time',
        'database.connections.active',
        'database.query.time',
        'network.bytes.in',
        'network.bytes.out',
        'cache.hit.ratio'
      ];

      let result = mockMetrics;
      if (query) {
        result = mockMetrics.filter(metric => 
          metric.toLowerCase().includes(query.toLowerCase())
        );
        console.log('[DataSource] Filtered metrics by query:', result);
      }

      console.log('[DataSource] getMetricNames returning:', result);
      return result;
    } catch (error) {
      console.error('[DataSource] Error fetching metric names:', error);
      return [];
    }
  }

  /**
   * Get available tags for a metric
   */
  async getMetricTags(metricName: string): Promise<{ [key: string]: string[] }> {
    try {
      // This would call the actual KairosDB API
      // For now, return mock data
      const mockTags = {
        'host': ['server1', 'server2', 'server3'],
        'region': ['us-east-1', 'us-west-2', 'eu-west-1'],
        'environment': ['prod', 'staging', 'dev']
      };

      return mockTags;
    } catch (error) {
      console.error('Error fetching metric tags:', error);
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

  /**
   * Checks whether we can connect to the KairosDB API.
   */
  async testDatasource() {
    const defaultErrorMessage = 'Cannot connect to KairosDB';

    try {
      const response = await this.request('/api/v1/version');
      if (response.status === 200) {
        return {
          status: 'success',
          message: 'Successfully connected to KairosDB',
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
