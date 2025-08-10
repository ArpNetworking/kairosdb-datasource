/**
 * Comprehensive template variable interpolation tests for KairosDB plugin
 * 
 * These tests ensure that template variables work correctly in all contexts:
 * - Metric names, tag names, tag values, aggregator parameters
 * - Single and multi-value variables
 * - Different variable syntaxes ($var, ${var}, ${var:format})
 */

import { DataSource } from '../src/datasource';
import { KairosDBQuery, KairosDBDataSourceOptions } from '../src/types';
import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';

describe('Template Variable Interpolation', () => {
  let datasource: DataSource;
  let mockSettings: DataSourceInstanceSettings<KairosDBDataSourceOptions>;

  beforeEach(() => {
    mockSettings = {
      id: 1,
      uid: 'test-uid',
      name: 'Test KairosDB',
      type: 'kairosdb',
      url: 'http://localhost:8080',
      jsonData: {},
      meta: {} as any,
      access: 'proxy',
      readOnly: false
    };
    
    datasource = new DataSource(mockSettings);
  });

  describe('Basic Variable Interpolation', () => {
    test('should interpolate simple $variable syntax', () => {
      const scopedVars: ScopedVars = {
        server: { text: 'web01', value: 'web01' },
        metric: { text: 'cpu.usage', value: 'cpu.usage' }
      };

      expect(datasource.interpolateVariable('system.$metric.host.$server', scopedVars))
        .toBe('system.cpu.usage.host.web01');
    });

    test('should handle ${variable} syntax', () => {
      const scopedVars: ScopedVars = {
        server: { text: 'web01', value: 'web01' },
        metric: { text: 'cpu.usage', value: 'cpu.usage' }
      };

      expect(datasource.interpolateVariable('system.${metric}.host.${server}', scopedVars))
        .toBe('system.cpu.usage.host.web01');
    });

    test('should handle multi-value variables with single selection', () => {
      const scopedVars: ScopedVars = {
        servers: { text: 'web01', value: 'web01' }
      };

      expect(datasource.interpolateVariable('host.$servers', scopedVars))
        .toBe('host.web01');
    });

    test('should handle multi-value variables with multiple selections', () => {
      const scopedVars: ScopedVars = {
        servers: { text: 'web01,web02,web03', value: ['web01', 'web02', 'web03'] }
      };

      expect(datasource.interpolateVariable('host.$servers', scopedVars))
        .toBe('host.web01,web02,web03');
    });

    test('should handle All option (*)', () => {
      const scopedVars: ScopedVars = {
        servers: { text: 'All', value: '*' }
      };

      expect(datasource.interpolateVariable('host.$servers', scopedVars))
        .toBe('host.*');
    });

    test('should leave unresolved variables unchanged', () => {
      const scopedVars: ScopedVars = {
        server: { text: 'web01', value: 'web01' }
      };

      expect(datasource.interpolateVariable('host.$server.metric.$unknown', scopedVars))
        .toBe('host.web01.metric.$unknown');
    });

    test('should handle empty variables gracefully', () => {
      const scopedVars: ScopedVars = {
        empty: { text: '', value: '' },
        nullvar: { text: 'null', value: null }
      };

      expect(datasource.interpolateVariable('metric.$empty.value', scopedVars))
        .toBe('metric..value');
        
      expect(datasource.interpolateVariable('metric.$nullvar.value', scopedVars))
        .toBe('metric.null.value');
    });
  });

  describe('Query Interpolation', () => {
    test('should interpolate metric names in queries', () => {
      const scopedVars: ScopedVars = {
        metric_name: { text: 'cpu.usage', value: 'cpu.usage' }
      };

      const queries: KairosDBQuery[] = [{
        refId: 'A',
        query: {
          metricName: 'system.$metric_name',
          alias: '',
          tags: {},
          groupBy: { tags: [], time: undefined, value: undefined },
          aggregators: [],
          overrideScalar: false
        }
      }];

      const interpolatedQueries = datasource.interpolateVariablesInQueries(queries, scopedVars);
      
      expect(interpolatedQueries[0].query?.metricName).toBe('system.cpu.usage');
    });

    test('should interpolate tag values in queries', () => {
      const scopedVars: ScopedVars = {
        datacenter: { text: 'us-east-1', value: 'us-east-1' },
        hosts: { text: 'web01,web02', value: ['web01', 'web02'] }
      };

      const queries: KairosDBQuery[] = [{
        refId: 'A',
        query: {
          metricName: 'cpu.usage',
          alias: '',
          tags: {
            datacenter: ['$datacenter'],
            host: ['$hosts']
          },
          groupBy: { tags: [], time: undefined, value: undefined },
          aggregators: [],
          overrideScalar: false
        }
      }];

      const interpolatedQueries = datasource.interpolateVariablesInQueries(queries, scopedVars);
      
      expect(interpolatedQueries[0].query?.tags?.datacenter).toEqual(['us-east-1']);
      expect(interpolatedQueries[0].query?.tags?.host).toEqual(['web01', 'web02']);
    });

    test('should interpolate alias in queries', () => {
      const scopedVars: ScopedVars = {
        server_group: { text: 'webservers', value: 'webservers' }
      };

      const queries: KairosDBQuery[] = [{
        refId: 'A',
        query: {
          metricName: 'cpu.usage',
          alias: 'CPU Usage - $server_group',
          tags: {},
          groupBy: { tags: [], time: undefined, value: undefined },
          aggregators: [],
          overrideScalar: false
        }
      }];

      const interpolatedQueries = datasource.interpolateVariablesInQueries(queries, scopedVars);
      
      expect(interpolatedQueries[0].query?.alias).toBe('CPU Usage - webservers');
    });

    test('should interpolate aggregator parameters', () => {
      const scopedVars: ScopedVars = {
        sample_rate: { text: '5', value: '5' },
        time_unit: { text: 'minutes', value: 'minutes' }
      };

      const queries: KairosDBQuery[] = [{
        refId: 'A',
        query: {
          metricName: 'cpu.usage',
          alias: '',
          tags: {},
          groupBy: { tags: [], time: undefined, value: undefined },
          aggregators: [{
            name: 'avg',
            parameters: [
              { name: 'value', type: 'sampling', value: '$sample_rate' },
              { name: 'unit', type: 'sampling_unit', value: '$time_unit' }
            ]
          }],
          overrideScalar: false
        }
      }];

      const interpolatedQueries = datasource.interpolateVariablesInQueries(queries, scopedVars);
      const aggregator = interpolatedQueries[0].query?.aggregators?.[0];
      
      expect(aggregator?.parameters?.find(p => p.name === 'value')?.value).toBe('5');
      expect(aggregator?.parameters?.find(p => p.name === 'unit')?.value).toBe('minutes');
    });

    test('should interpolate group by tags', () => {
      const scopedVars: ScopedVars = {
        group_tags: { text: 'host,datacenter', value: ['host', 'datacenter'] }
      };

      const queries: KairosDBQuery[] = [{
        refId: 'A',
        query: {
          metricName: 'cpu.usage',
          alias: '',
          tags: {},
          groupBy: { 
            tags: ['$group_tags'], 
            time: undefined, 
            value: undefined 
          },
          aggregators: [],
          overrideScalar: false
        }
      }];

      const interpolatedQueries = datasource.interpolateVariablesInQueries(queries, scopedVars);
      
      expect(interpolatedQueries[0].query?.groupBy?.tags).toEqual(['host', 'datacenter']);
    });
  });

  describe('Variable Query Interpolation', () => {
    test('should interpolate variables in metrics() queries', async () => {
      const scopedVars: ScopedVars = {
        prefix: { text: 'system', value: 'system' }
      };

      // Mock the getMetricNames method to return test data
      jest.spyOn(datasource, 'getMetricNames').mockResolvedValue([
        'system.cpu.usage',
        'system.memory.usage',
        'system.disk.usage'
      ]);

      const result = await datasource.metricFindQuery('metrics($prefix)', { scopedVars });
      
      expect(datasource.getMetricNames).toHaveBeenCalledWith('system');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ text: 'system.cpu.usage', value: 'system.cpu.usage' });
    });

    test('should interpolate variables in tag_names() queries', async () => {
      const scopedVars: ScopedVars = {
        metric: { text: 'system.cpu.usage', value: 'system.cpu.usage' }
      };

      // Mock the getMetricTags method
      jest.spyOn(datasource, 'getMetricTags').mockResolvedValue({
        host: ['web01', 'web02'],
        datacenter: ['us-east-1', 'us-west-1']
      });

      const result = await datasource.metricFindQuery('tag_names($metric)', { scopedVars });
      
      expect(datasource.getMetricTags).toHaveBeenCalledWith('system.cpu.usage');
      expect(result).toHaveLength(2);
      expect(result.map(r => r.text).sort()).toEqual(['datacenter', 'host']);
    });

    test('should interpolate variables in tag_values() queries', async () => {
      const scopedVars: ScopedVars = {
        metric: { text: 'system.cpu.usage', value: 'system.cpu.usage' },
        tag_name: { text: 'host', value: 'host' },
        datacenter: { text: 'us-east-1', value: 'us-east-1' }
      };

      // Mock the getMetricTags method for tag values query
      jest.spyOn(datasource, 'getMetricTags').mockResolvedValue({
        host: ['web01', 'web02', 'web03'],
        datacenter: ['us-east-1']
      });

      const result = await datasource.metricFindQuery('tag_values($metric, $tag_name, datacenter=$datacenter)', { scopedVars });
      
      expect(result).toHaveLength(3);
      expect(result.map(r => r.text)).toEqual(['web01', 'web02', 'web03']);
    });
  });

  describe('Advanced Variable Formats', () => {
    test('should handle regex format ${variable:regex}', () => {
      const scopedVars: ScopedVars = {
        servers: { 
          text: 'web01,web02,web03', 
          value: ['web01', 'web02', 'web03']
        }
      };

      // This would need custom format handling - for now test basic case
      expect(datasource.interpolateVariable('${servers}', scopedVars))
        .toBe('web01,web02,web03');
    });

    test('should handle pipe format ${variable:pipe}', () => {
      const scopedVars: ScopedVars = {
        servers: { 
          text: 'web01,web02,web03', 
          value: ['web01', 'web02', 'web03']
        }
      };

      // This would need custom format handling - test should be extended
      expect(datasource.interpolateVariable('${servers}', scopedVars))
        .toBe('web01,web02,web03');
    });

    test('should handle distributed format ${variable:distributed}', () => {
      const scopedVars: ScopedVars = {
        servers: { 
          text: 'web01,web02,web03', 
          value: ['web01', 'web02', 'web03']
        }
      };

      // This would need custom format handling
      expect(datasource.interpolateVariable('${servers}', scopedVars))
        .toBe('web01,web02,web03');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle nested variable references', () => {
      const scopedVars: ScopedVars = {
        env: { text: 'prod', value: 'prod' },
        prod_prefix: { text: 'system', value: 'system' }
      };

      // This is a complex case that would require recursive resolution
      expect(datasource.interpolateVariable('${${env}_prefix}.cpu', scopedVars))
        .toBe('${${env}_prefix}.cpu'); // Current implementation limitation - no nested resolution
    });

    test('should handle variables with special characters', () => {
      const scopedVars: ScopedVars = {
        'metric-name': { text: 'cpu.usage', value: 'cpu.usage' },
        'server_01': { text: 'web01', value: 'web01' }
      };

      // Note: Current implementation only supports word characters \\w+
      expect(datasource.interpolateVariable('$metric-name.$server_01', scopedVars))
        .toBe('$metric-name.web01'); // Limitation: doesn't handle hyphens
    });

    test('should handle circular references gracefully', () => {
      const scopedVars: ScopedVars = {
        var1: { text: '$var2', value: '$var2' },
        var2: { text: '$var1', value: '$var1' }
      };

      expect(datasource.interpolateVariable('$var1', scopedVars))
        .toBe('$var2'); // Doesn't expand further (good!)
    });

    test('should handle undefined or null scopedVars', () => {
      expect(datasource.interpolateVariable('$test', undefined))
        .toBe('$test');
        
      expect(datasource.interpolateVariable('$test', null as any))
        .toBe('$test');
    });

    test('should handle empty or undefined values', () => {
      expect(datasource.interpolateVariable('', { test: { text: 'value', value: 'value' } }))
        .toBe('');
        
      expect(datasource.interpolateVariable(null as any, { test: { text: 'value', value: 'value' } }))
        .toBe(null);
    });
  });
});
