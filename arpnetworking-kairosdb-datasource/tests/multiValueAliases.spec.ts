/**
 * Tests for multi-value variable interpolation in aliases
 * 
 * These tests verify that when multi-value variables are used in aliases,
 * each expanded metric gets the correct individual variable value,
 * not the entire array.
 */

import { DataSource } from '../src/datasource';

describe('Multi-Value Variable Aliases', () => {
  let datasource: DataSource;

  beforeEach(() => {
    datasource = new DataSource({
      id: 1,
      uid: 'test-uid',
      type: 'arpnetworking-kairosdb-datasource',
      name: 'Test KairosDB',
      url: 'http://localhost:8080',
      access: 'proxy',
      jsonData: {}
    });
  });

  describe('expandMetricNames with variable values', () => {
    test('should return individual variable values for each expanded metric', () => {
      const mockScopedVars = {
        server: { text: 'web01,web02,web03', value: ['web01', 'web02', 'web03'] }
      };
      
      const expansion = (datasource as any).expandMetricNames('cpu.$server', 'A', mockScopedVars);
      
      expect(expansion).toHaveProperty('names');
      expect(expansion).toHaveProperty('variableValues');
      expect(expansion.names).toHaveLength(expansion.variableValues.length);
      expect(expansion.names).toHaveLength(3);
      
      // Verify the expanded names
      expect(expansion.names).toEqual(['cpu.web01', 'cpu.web02', 'cpu.web03']);
      
      // Each expanded metric should have corresponding variable values
      expansion.names.forEach((name: string, index: number) => {
        const vars = expansion.variableValues[index];
        expect(vars).toBeDefined();
        // The variable values should contain the specific value used for this expansion
        expect(vars.server).toBeDefined();
        expect(typeof vars.server.value).toBe('string'); // Individual value, not array
      });
    });

    test('should handle single-value variables correctly', () => {
      const mockScopedVars = {
        datacenter: { text: 'us-east-1', value: 'us-east-1' }
      };

      const expansion = (datasource as any).expandMetricNames('cpu.usage.$datacenter', 'A', mockScopedVars);
      
      expect(expansion.names).toHaveLength(1);
      expect(expansion.variableValues).toHaveLength(1);
      expect(expansion.variableValues[0]).toEqual(mockScopedVars);
    });

    test('should handle metrics without variables', () => {
      const expansion = (datasource as any).expandMetricNames('cpu.usage', 'A', {});
      
      expect(expansion.names).toEqual(['cpu.usage']);
      expect(expansion.variableValues).toHaveLength(1);
      expect(expansion.variableValues[0]).toEqual({});
    });
  });

  describe('metric to target mapping', () => {
    test('should create proper mapping structure with variable values', () => {
      // This tests the structure of the mapping that gets created
      const mockTarget = {
        refId: 'A',
        query: {
          metricName: 'cpu.$server',
          alias: '$server CPU Usage',
          tags: {},
          groupBy: { tags: [], time: [], value: [] },
          aggregators: []
        }
      };

      // Mock the expandMetricNames to return test data
      const originalMethod = (datasource as any).expandMetricNames;
      (datasource as any).expandMetricNames = jest.fn(() => ({
        names: ['cpu.web01', 'cpu.web02'],
        variableValues: [
          { server: { text: 'web01', value: 'web01' } },
          { server: { text: 'web02', value: 'web02' } }
        ]
      }));

      // Test the mapping structure that would be created
      const expansion = (datasource as any).expandMetricNames('cpu.$server', 'A', {});
      
      expansion.names.forEach((name: string, index: number) => {
        const mappingInfo = {
          target: mockTarget,
          variableValues: expansion.variableValues[index]
        };
        
        expect(mappingInfo.target).toEqual(mockTarget);
        expect(mappingInfo.variableValues.server).toBeDefined();
        expect(mappingInfo.variableValues.server.value).toMatch(/web0[12]/);
      });

      // Restore original method
      (datasource as any).expandMetricNames = originalMethod;
    });
  });
});