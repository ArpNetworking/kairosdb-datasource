/**
 * Simple integration test to verify multi-value variable alias functionality
 */

import { DataSource } from '../src/datasource';
import { ScopedVars } from '@grafana/data';

describe('Multi-Value Variable Aliases Integration', () => {
  let datasource: DataSource;

  beforeEach(() => {
    datasource = new DataSource({
      id: 1,
      uid: 'test-uid',
      type: 'arpnetworking-kairosdb-datasource',
      name: 'Test KairosDB',
      url: 'http://localhost:8080',
      access: 'proxy',
      jsonData: {},
    });
  });

  test('should expand multi-value variables correctly and track variable values for aliases', () => {
    // Simulate multi-value variable
    const scopedVars: ScopedVars = {
      location: {
        text: 'Attic,Bedroom,Office',
        value: ['Attic', 'Bedroom', 'Office'],
      },
    };

    // Test the expansion functionality
    const expansion = (datasource as any).expandMetricNames('homeseer/$location/gauge/Temperature', 'A', scopedVars);

    console.log('Expansion result:', expansion);

    // Verify we get the correct number of expanded metrics
    expect(expansion.names).toHaveLength(3);
    expect(expansion.variableValues).toHaveLength(3);

    // Verify each expanded metric has the correct individual variable value
    expect(expansion.names).toEqual([
      'homeseer/Attic/gauge/Temperature',
      'homeseer/Bedroom/gauge/Temperature',
      'homeseer/Office/gauge/Temperature',
    ]);

    // Verify variable values are tracked correctly for each expansion
    expect(expansion.variableValues[0].location.value).toBe('Attic');
    expect(expansion.variableValues[1].location.value).toBe('Bedroom');
    expect(expansion.variableValues[2].location.value).toBe('Office');

    // This proves that when we process the response, each metric will have access
    // to its specific variable value for alias interpolation instead of the full array
    console.log('Variable values for alias interpolation:');
    expansion.variableValues.forEach((vars, index) => {
      console.log(`  Metric ${index}: ${expansion.names[index]} -> location = ${vars.location.value}`);
    });
  });

  test('should handle single-value variables correctly', () => {
    const scopedVars: ScopedVars = {
      datacenter: { text: 'us-east-1', value: 'us-east-1' },
    };

    const expansion = (datasource as any).expandMetricNames('cpu.$datacenter.usage', 'A', scopedVars);

    expect(expansion.names).toHaveLength(1);
    expect(expansion.names[0]).toBe('cpu.us-east-1.usage');
    expect(expansion.variableValues[0].datacenter.value).toBe('us-east-1');
  });

  test('should handle mixed single and multi-value variables', () => {
    const scopedVars: ScopedVars = {
      datacenter: { text: 'us-east-1', value: 'us-east-1' },
      server: { text: 'web01,web02', value: ['web01', 'web02'] },
    };

    const expansion = (datasource as any).expandMetricNames('$datacenter/$server/cpu', 'A', scopedVars);

    expect(expansion.names).toHaveLength(2);
    expect(expansion.names).toEqual(['us-east-1/web01/cpu', 'us-east-1/web02/cpu']);

    // Verify both expansions have the same datacenter but different server values
    expect(expansion.variableValues[0].datacenter.value).toBe('us-east-1');
    expect(expansion.variableValues[0].server.value).toBe('web01');
    expect(expansion.variableValues[1].datacenter.value).toBe('us-east-1');
    expect(expansion.variableValues[1].server.value).toBe('web02');
  });
});
