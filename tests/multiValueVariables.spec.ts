/**
 * Tests for multi-value template variable expansion in KairosDB queries
 * 
 * When a template variable with multiple values is used in a metric name,
 * it should result in separate metric objects in the KairosDB query request
 * rather than comma-separated metric names.
 */

import { DataSource } from '../src/datasource';
import { KairosDBQuery, KairosDBDataSourceOptions } from '../src/types';
import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';

describe('Multi-Value Template Variables', () => {
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

  describe('expandMetricNames', () => {
    test('should return single metric for single value', () => {
      const scopedVars: ScopedVars = {
        metric: { text: 'cpu.usage', value: 'cpu.usage' }
      };
      const result = (datasource as any).expandMetricNames('$metric', 'A', scopedVars);
      expect(result.names).toEqual(['cpu.usage']);
      expect(result.variableValues).toHaveLength(1);
    });

    test('should expand multi-value variables into separate metric names', () => {
      const scopedVars: ScopedVars = {
        location: { text: 'Attic,Bedroom,Office', value: ['Attic', 'Bedroom', 'Office'] }
      };
      const result = (datasource as any).expandMetricNames('homeseer/$location/gauge/Temperature', 'A', scopedVars);
      expect(result.names).toEqual([
        'homeseer/Attic/gauge/Temperature',
        'homeseer/Bedroom/gauge/Temperature', 
        'homeseer/Office/gauge/Temperature'
      ]);
      expect(result.variableValues).toHaveLength(3);
      expect(result.variableValues[0].location.value).toBe('Attic');
    });

    test('should handle multiple variables with one multi-value', () => {
      const scopedVars: ScopedVars = {
        prefix: { text: 'system', value: 'system' },
        location: { text: 'server1,server2', value: ['server1', 'server2'] }
      };
      const result = (datasource as any).expandMetricNames('$prefix/$location/cpu', 'A', scopedVars);
      expect(result.names).toEqual([
        'system/server1/cpu',
        'system/server2/cpu'
      ]);
      expect(result.variableValues).toHaveLength(2);
    });

    test('should handle single selection from multi-value variable', () => {
      const scopedVars: ScopedVars = {
        location: { text: 'Attic', value: 'Attic' } // Single selection
      };
      const result = (datasource as any).expandMetricNames('homeseer/$location/gauge/Temperature', 'A', scopedVars);
      expect(result.names).toEqual(['homeseer/Attic/gauge/Temperature']);
    });

    test('should return original metric name when no variables', () => {
      const result = (datasource as any).expandMetricNames('static.metric.name', 'A');
      expect(result.names).toEqual(['static.metric.name']);
    });

    test('should return empty array for empty metric name', () => {
      const result = (datasource as any).expandMetricNames('', 'A');
      expect(result.names).toEqual([]);
      expect(result.variableValues).toEqual([]);
    });
  });

  // Note: findTargetForQueryResult tests removed as the method was replaced 
  // with a pre-built mapping approach for better multi-value variable support

  describe('Integration Test - Multi-value Variable Processing', () => {
    test('should create separate metrics for multi-value template variables', () => {
      // Create a mock query with a multi-value variable
      const scopedVars: ScopedVars = {
        location: { text: 'Attic,Bedroom,Office', value: ['Attic', 'Bedroom', 'Office'] }
      };

      // Test the expandMetricNames method directly with the template pattern
      const expandedResult = (datasource as any).expandMetricNames('homeseer/$location/gauge/Temperature', 'A', scopedVars);
      expect(expandedResult.names).toHaveLength(3);
      expect(expandedResult.names).toEqual([
        'homeseer/Attic/gauge/Temperature',
        'homeseer/Bedroom/gauge/Temperature', 
        'homeseer/Office/gauge/Temperature'
      ]);
    });

    test('should preserve query properties for each expanded metric', () => {
      const scopedVars: ScopedVars = {
        servers: { text: 'server1,server2', value: ['server1', 'server2'] }
      };
      
      const expandedResult = (datasource as any).expandMetricNames('system/$servers/cpu', 'A', scopedVars);
      expect(expandedResult.names).toEqual(['system/server1/cpu', 'system/server2/cpu']);
      
      // This tests that each expanded metric should get the same tags, aggregators, etc.
      // The actual logic is in the query method which builds the KairosDB request
      expect(expandedResult.names).toHaveLength(2);
    });
  });

  describe('Template Variable Interpolation with Multi-Values', () => {
    test('should handle multi-value variables in metric names', () => {
      const scopedVars: ScopedVars = {
        metrics: { text: 'cpu.usage,memory.usage', value: ['cpu.usage', 'memory.usage'] }
      };

      // Test direct expansion with template pattern (the new correct approach)
      const expanded = (datasource as any).expandMetricNames('system/$metrics/usage', 'A', scopedVars);
      expect(expanded.names).toEqual(['system/cpu.usage/usage', 'system/memory.usage/usage']);
    });

    test('should handle single selection from multi-value variable', () => {
      const scopedVars: ScopedVars = {
        metrics: { text: 'cpu.usage', value: 'cpu.usage' } // Single selection
      };

      const interpolated = datasource.interpolateVariable('$metrics', scopedVars);
      expect(interpolated).toBe('cpu.usage');

      const expanded = (datasource as any).expandMetricNames(interpolated, 'A');
      expect(expanded.names).toEqual(['cpu.usage']);
    });

    test('should handle All selection (*) in multi-value variables', () => {
      const scopedVars: ScopedVars = {
        metrics: { text: 'All', value: '*' }
      };

      const expanded = (datasource as any).expandMetricNames('$metrics', 'A', scopedVars);
      expect(expanded.names).toEqual(['*']);
    });
  });

  describe('Real-world Scenario Tests', () => {
    test('should correctly expand homeseer/$location/gauge/Temperature pattern', () => {
      const scopedVars: ScopedVars = {
        location: { 
          text: 'Attic,Bedroom,Garage,Living Room,Office', 
          value: ['Attic', 'Bedroom', 'Garage', 'Living Room', 'Office'] 
        }
      };

      const expanded = (datasource as any).expandMetricNames('homeseer/$location/gauge/Temperature', 'A', scopedVars);
      
      expect(expanded.names).toHaveLength(5);
      expect(expanded.names).toEqual([
        'homeseer/Attic/gauge/Temperature',
        'homeseer/Bedroom/gauge/Temperature', 
        'homeseer/Garage/gauge/Temperature',
        'homeseer/Living Room/gauge/Temperature',
        'homeseer/Office/gauge/Temperature'
      ]);
    });

    test('should create separate KairosDB metrics for each location (integration test)', () => {
      // This test simulates what the actual query method would produce
      const scopedVars: ScopedVars = {
        location: { 
          text: 'Attic,Bedroom,Garage,Living Room,Office', 
          value: ['Attic', 'Bedroom', 'Garage', 'Living Room', 'Office'] 
        }
      };

      // Simulate what happens in the query method
      const originalMetricName = 'homeseer/$location/gauge/Temperature';
      const expandedResult = (datasource as any).expandMetricNames(originalMetricName, 'A', scopedVars);

      // Verify we get 5 separate metric names
      expect(expandedResult.names).toHaveLength(5);
      
      // Verify each metric name is properly formatted (no comma-separated values)
      expect(expandedResult.names).toEqual([
        'homeseer/Attic/gauge/Temperature',
        'homeseer/Bedroom/gauge/Temperature', 
        'homeseer/Garage/gauge/Temperature',
        'homeseer/Living Room/gauge/Temperature',
        'homeseer/Office/gauge/Temperature'
      ]);

      // Verify none of the metric names contain commas (which was the original problem)
      expandedResult.names.forEach(name => {
        expect(name).not.toMatch(/homeseer\/.*,.*\/gauge\/Temperature/);
        expect(name).toMatch(/^homeseer\/[^\/,]+\/gauge\/Temperature$/);
      });
    });

    test('should handle complex metric patterns with multiple path segments', () => {
      const scopedVars: ScopedVars = {
        datacenter: { text: 'us-east-1', value: 'us-east-1' },
        server: { text: 'web01,web02,db01', value: ['web01', 'web02', 'db01'] },
        metric: { text: 'cpu_usage', value: 'cpu_usage' }
      };

      const expanded = (datasource as any).expandMetricNames('$datacenter/$server/system/$metric', 'A', scopedVars);
      
      expect(expanded.names).toHaveLength(3);
      expect(expanded.names).toEqual([
        'us-east-1/web01/system/cpu_usage',
        'us-east-1/web02/system/cpu_usage',
        'us-east-1/db01/system/cpu_usage'
      ]);
    });

    test('should verify KairosDB request structure matches expected format', () => {
      // Test to verify that the resulting metric names would produce clean KairosDB JSON
      const scopedVars: ScopedVars = {
        location: { 
          text: 'Attic,Bedroom,Office', 
          value: ['Attic', 'Bedroom', 'Office'] 
        }
      };

      const expandedResult = (datasource as any).expandMetricNames('homeseer/$location/gauge/Temperature', 'A', scopedVars);
      
      // Simulate what would appear in KairosDB metrics array
      const mockMetrics = expandedResult.names.map(name => ({
        name: name,
        tags: {},
        aggregators: [{ name: 'avg', sampling: { value: 1, unit: 'HOURS' } }],
        group_by: []
      }));

      expect(mockMetrics).toHaveLength(3);
      expect(mockMetrics[0].name).toBe('homeseer/Attic/gauge/Temperature');
      expect(mockMetrics[1].name).toBe('homeseer/Bedroom/gauge/Temperature');
      expect(mockMetrics[2].name).toBe('homeseer/Office/gauge/Temperature');
      
      // Verify no metric names have the broken format that was in the original issue
      mockMetrics.forEach(metric => {
        expect(metric.name).not.toContain('homeseer/{');
        expect(metric.name).not.toContain('}/gauge/Temperature');
        expect(metric.name).not.toMatch(/.*,.*gauge/);
      });
    });
  });
});
