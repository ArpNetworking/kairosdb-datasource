/**
 * Test edge cases that might cause alias variable issues in real dashboards
 */

import { DataSource } from '../src/datasource';
import { ScopedVars } from '@grafana/data';

describe('Alias Variable Edge Cases', () => {
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

  test('should handle case where scopedVars contains both array and string values', () => {
    // This might be a scenario where Grafana passes mixed variable types
    const scopedVars: ScopedVars = {
      location: { text: 'Attic,Bedroom,Office', value: ['Attic', 'Bedroom', 'Office'] },
      datacenter: { text: 'us-east-1', value: 'us-east-1' },
      environment: { text: 'prod', value: 'prod' }
    };

    const expansion = (datasource as any).expandMetricNames('$datacenter/$location/$environment/cpu', 'A', scopedVars);
    
    console.log('Mixed variables expansion:', {
      names: expansion.names.slice(0, 2), // Show first 2 for brevity
      variableValues: expansion.variableValues.slice(0, 2)
    });

    // Should expand only the multi-value variable
    expect(expansion.names).toHaveLength(3); // 3 locations
    expect(expansion.names).toEqual([
      'us-east-1/Attic/prod/cpu',
      'us-east-1/Bedroom/prod/cpu',
      'us-east-1/Office/prod/cpu'
    ]);

    // Check that each expansion has correct individual values
    expansion.variableValues.forEach((vars, index) => {
      expect(vars.datacenter.value).toBe('us-east-1'); // Should be same for all
      expect(vars.environment.value).toBe('prod'); // Should be same for all
      expect(typeof vars.location.value).toBe('string'); // Should be individual string
    });

    expect(expansion.variableValues[0].location.value).toBe('Attic');
    expect(expansion.variableValues[1].location.value).toBe('Bedroom');
    expect(expansion.variableValues[2].location.value).toBe('Office');
  });

  test('should handle empty or undefined alias', () => {
    const scopedVars: ScopedVars = {
      location: { text: 'Attic,Bedroom', value: ['Attic', 'Bedroom'] }
    };

    const expansion = (datasource as any).expandMetricNames('homeseer/$location/temp', 'A', scopedVars);
    
    // Test undefined alias
    let result = expansion.variableValues.map(vars => 
      (datasource as any).interpolateAlias(undefined, vars)
    );
    console.log('Undefined alias result:', result);

    // Test empty string alias  
    result = expansion.variableValues.map(vars => 
      (datasource as any).interpolateAlias('', vars)
    );
    console.log('Empty alias result:', result);

    // Test null alias
    result = expansion.variableValues.map(vars => 
      (datasource as any).interpolateAlias(null, vars)
    );
    console.log('Null alias result:', result);
  });

  test('should check what happens when metricToTargetMap gets corrupted', () => {
    // Simulate a scenario where the metricToTargetMap somehow gets the wrong data
    
    const scopedVars: ScopedVars = {
      server: { text: 'web01,web02', value: ['web01', 'web02'] }
    };

    const expansion = (datasource as any).expandMetricNames('cpu.$server', 'A', scopedVars);
    
    // Simulate building metricToTargetMap as the real code would
    const metricToTargetMap = {};
    const mockTarget = {
      refId: 'A',
      query: {
        metricName: 'cpu.$server',
        alias: '$server CPU',
        tags: {},
        groupBy: { tags: [], time: [], value: [] },
        aggregators: []
      }
    };

    expansion.names.forEach((name, index) => {
      metricToTargetMap[index] = {
        target: mockTarget,
        variableValues: expansion.variableValues[index]
      };
    });

    console.log('MetricToTargetMap structure:', JSON.stringify(metricToTargetMap, null, 2));

    // Check what each mapping contains
    Object.keys(metricToTargetMap).forEach(key => {
      const mapping = metricToTargetMap[key];
      console.log(`Mapping ${key}:`, {
        targetAlias: mapping.target.query.alias,
        variableValues: mapping.variableValues,
        serverValueType: typeof mapping.variableValues.server?.value
      });
    });

    // Verify each mapping has correct individual values
    expect(metricToTargetMap[0].variableValues.server.value).toBe('web01');
    expect(metricToTargetMap[1].variableValues.server.value).toBe('web02');
  });

  test('should verify what happens if original scopedVars accidentally get used', () => {
    // This test simulates the bug scenario to confirm our fix prevents it
    
    const originalScopedVars: ScopedVars = {
      location: { text: 'Attic,Bedroom,Office', value: ['Attic', 'Bedroom', 'Office'] }
    };

    const expansion = (datasource as any).expandMetricNames('temp.$location', 'A', originalScopedVars);

    // What we should get (correct individual values)
    const correctVariableValues = expansion.variableValues;
    
    // What would be wrong (using original scopedVars)
    const wrongVariableValues = [originalScopedVars, originalScopedVars, originalScopedVars];

    console.log('Correct variable values (first entry):', correctVariableValues[0]);
    console.log('Wrong variable values (first entry):', wrongVariableValues[0]);

    // Test template interpolation with both scenarios
    const alias = '$location Temperature';
    
    // Mock template service behavior  
    const templateReplace = (text: string, vars: ScopedVars) => {
      return text.replace(/\$(\w+)/g, (match, varName) => {
        const variable = vars[varName];
        if (variable) {
          if (Array.isArray(variable.value)) {
            return variable.value.join(','); // This would be wrong for individual metrics
          }
          return String(variable.value);
        }
        return match;
      });
    };

    // Correct approach (using individual variable values)
    const correctAliases = correctVariableValues.map(vars => templateReplace(alias, vars));
    
    // Wrong approach (using original scopedVars)  
    const wrongAliases = wrongVariableValues.map(vars => templateReplace(alias, vars));

    console.log('Correct aliases:', correctAliases);
    console.log('Wrong aliases (bug scenario):', wrongAliases);

    expect(correctAliases).toEqual(['Attic Temperature', 'Bedroom Temperature', 'Office Temperature']);
    expect(wrongAliases).toEqual([
      'Attic,Bedroom,Office Temperature',
      'Attic,Bedroom,Office Temperature', 
      'Attic,Bedroom,Office Temperature'
    ]);

    // This confirms the bug would manifest as identical comma-separated names for all series
  });

  test('should test response processing simulation', () => {
    // Simulate the exact response processing logic to check for bugs
    
    const originalScopedVars: ScopedVars = {
      host: { text: 'server1,server2', value: ['server1', 'server2'] }
    };

    // Step 1: Expand metric names (this should work correctly)
    const expansion = (datasource as any).expandMetricNames('cpu.$host.usage', 'A', originalScopedVars);
    
    // Step 2: Build metricToTargetMap (as done in real code)  
    const metricToTargetMap = {};
    const mockTarget = {
      refId: 'A',
      query: {
        metricName: 'cpu.$host.usage',
        alias: '$host CPU Usage',
        tags: {},
        groupBy: { tags: [], time: [], value: [] },
        aggregators: []
      }
    };

    expansion.names.forEach((name, index) => {
      metricToTargetMap[index] = {
        target: mockTarget,
        variableValues: expansion.variableValues[index] // Individual values
      };
    });

    // Step 3: Simulate response processing (as done in real code)
    const mockResults = [
      { name: 'cpu.server1.usage', tags: { host: ['server1'] }, values: [[1234567890000, 80.5]] },
      { name: 'cpu.server2.usage', tags: { host: ['server2'] }, values: [[1234567890000, 75.3]] }
    ];

    const processedAliases = [];
    mockResults.forEach((result, index) => {
      const mappingInfo = metricToTargetMap[index];
      const metricVariableValues = mappingInfo.variableValues;
      const alias = mappingInfo.target.query.alias;

      // This is the critical step - template interpolation
      const templateReplace = (text: string, vars: ScopedVars) => {
        return text.replace(/\$(\w+)/g, (match, varName) => {
          const variable = vars[varName];
          if (variable && typeof variable.value === 'string') {
            return variable.value;
          }
          if (variable && Array.isArray(variable.value)) {
            return variable.value.join(','); // Would be wrong here
          }
          return match;
        });
      };

      const interpolatedAlias = templateReplace(alias, metricVariableValues);
      processedAliases.push(interpolatedAlias);

      console.log(`Processing result ${index}:`);
      console.log(`  Result name: ${result.name}`);
      console.log(`  Variable values:`, metricVariableValues);
      console.log(`  Interpolated alias: ${interpolatedAlias}`);
    });

    expect(processedAliases).toEqual(['server1 CPU Usage', 'server2 CPU Usage']);
  });
});