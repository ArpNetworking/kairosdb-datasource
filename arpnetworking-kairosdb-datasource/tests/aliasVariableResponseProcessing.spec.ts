/**
 * Test to isolate the alias variable issue in response processing
 * 
 * This test focuses on the response processing step where the bug occurs.
 */

import { DataSource } from '../src/datasource';
import { ScopedVars } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

// Mock template service to simulate the real Grafana behavior
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(() => ({
    replace: jest.fn((text: string, scopedVars?: ScopedVars) => {
      if (!scopedVars || !text) return text;
      
      // Simulate real Grafana template service behavior
      return text.replace(/\$(\w+)/g, (match, varName) => {
        const variable = scopedVars[varName];
        if (variable) {
          // CRITICAL: This is how Grafana's template service actually behaves
          // If the variable value is an array, it joins with commas
          if (Array.isArray(variable.value)) {
            return variable.value.join(','); // This is the source of the bug!
          }
          return String(variable.value);
        }
        return match;
      });
    })
  }))
}));

describe('Alias Variable Response Processing Issue', () => {
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

  test('should demonstrate the alias interpolation bug in response processing', () => {
    // Step 1: Create a multi-value variable scenario
    const originalScopedVars: ScopedVars = {
      location: { text: 'Attic,Bedroom,Office', value: ['Attic', 'Bedroom', 'Office'] }
    };

    // Step 2: Verify expandMetricNames creates proper individual variable values
    const expansion = (datasource as any).expandMetricNames('homeseer/$location/gauge/Temperature', 'A', originalScopedVars);
    
    expect(expansion.names).toEqual([
      'homeseer/Attic/gauge/Temperature',
      'homeseer/Bedroom/gauge/Temperature', 
      'homeseer/Office/gauge/Temperature'
    ]);
    
    // Step 3: Verify each metric has its own scoped variable values (this should work)
    expect(expansion.variableValues[0].location.value).toBe('Attic');
    expect(expansion.variableValues[1].location.value).toBe('Bedroom');
    expect(expansion.variableValues[2].location.value).toBe('Office');

    // Step 4: Now simulate the response processing step - this is where the bug occurs
    const templateSrv = getTemplateSrv();
    const alias = '$location Temperature';

    // Test what happens when we use the individual scoped vars (should work correctly)
    const correctResults = expansion.variableValues.map((vars, index) => {
      const result = templateSrv.replace(alias, vars);
      console.log(`Metric ${index} alias with individual vars:`, result);
      return result;
    });

    expect(correctResults).toEqual([
      'Attic Temperature',
      'Bedroom Temperature',
      'Office Temperature'
    ]);

    // Step 5: Test what happens if we accidentally use the original scopedVars (the bug scenario)
    const buggyResult = templateSrv.replace(alias, originalScopedVars);
    console.log('Alias with original multi-value vars (WRONG):', buggyResult);
    
    expect(buggyResult).toBe('Attic,Bedroom,Office Temperature'); // This is the bug!

    // Step 6: Simulate actual response processing logic to see if it uses the right variables
    const mockResponseData = {
      queries: [{
        results: [
          { name: 'homeseer/Attic/gauge/Temperature', tags: { location: ['Attic'] }, values: [[1234567890000, 72.5]] },
          { name: 'homeseer/Bedroom/gauge/Temperature', tags: { location: ['Bedroom'] }, values: [[1234567890000, 68.3]] },
          { name: 'homeseer/Office/gauge/Temperature', tags: { location: ['Office'] }, values: [[1234567890000, 70.1]] }
        ]
      }]
    };

    const mockTarget = {
      refId: 'A',
      query: {
        metricName: 'homeseer/$location/gauge/Temperature',
        alias: '$location Temperature',
        tags: {},
        groupBy: { tags: [], time: [], value: [] },
        aggregators: []
      }
    };

    // Step 7: Create the metricToTargetMap as the real code would
    const metricToTargetMap: any[] = [];
    expansion.names.forEach((name: string, index: number) => {
      metricToTargetMap.push({
        target: mockTarget,
        variableValues: expansion.variableValues[index] // This should be the individual values
      });
    });

    // Step 8: Simulate the response processing loop
    const processedResults: string[] = [];
    let responseMetricIndex = 0;

    mockResponseData.queries[0].results.forEach((result) => {
      const mappingInfo = metricToTargetMap[responseMetricIndex];
      if (mappingInfo) {
        const metricVariableValues = mappingInfo.variableValues;
        const alias = mappingInfo.target.query.alias;

        // This is the critical step - which variable values are being used?
        console.log(`Processing metric ${responseMetricIndex}:`, result.name);
        console.log('  Using variable values:', JSON.stringify(metricVariableValues));
        
        const interpolatedAlias = templateSrv.replace(alias, metricVariableValues);
        console.log('  Interpolated alias:', interpolatedAlias);
        
        processedResults.push(interpolatedAlias);
      }
      responseMetricIndex++;
    });

    // Step 9: Verify the final result
    console.log('Final processed alias results:', processedResults);
    
    expect(processedResults).toEqual([
      'Attic Temperature',
      'Bedroom Temperature', 
      'Office Temperature'
    ]);

    // If this test fails, it will show us exactly where the bug is occurring
  });

  test('should test what happens when metricVariableValues are undefined or wrong', () => {
    const templateSrv = getTemplateSrv();
    const alias = '$location Temperature';

    // Test undefined variable values
    const resultWithUndefined = templateSrv.replace(alias, undefined);
    console.log('Result with undefined scopedVars:', resultWithUndefined);

    // Test empty variable values  
    const resultWithEmpty = templateSrv.replace(alias, {});
    console.log('Result with empty scopedVars:', resultWithEmpty);

    // Test with original multi-value variable (the bug case)
    const originalScopedVars = {
      location: { text: 'Attic,Bedroom,Office', value: ['Attic', 'Bedroom', 'Office'] }
    };
    const resultWithArray = templateSrv.replace(alias, originalScopedVars);
    console.log('Result with array variable (BUG):', resultWithArray);

    // These show different failure modes
    expect(resultWithUndefined).toBe('$location Temperature'); // Variable not replaced
    expect(resultWithEmpty).toBe('$location Temperature'); // Variable not replaced  
    expect(resultWithArray).toBe('Attic,Bedroom,Office Temperature'); // Array joined (BUG!)
  });
});