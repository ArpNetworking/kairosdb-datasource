/**
 * Real-world test to demonstrate alias variable interpolation issues
 * 
 * This test simulates the actual query flow from request to response processing
 * to identify why aliases with multi-value variables aren't working in dashboards.
 */

import { DataSource } from '../src/datasource';
import { ScopedVars } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

// Mock the template service
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(() => ({
    replace: jest.fn((text: string, scopedVars?: ScopedVars) => {
      if (!scopedVars || !text) return text;
      
      // Simple variable replacement for testing
      return text.replace(/\$(\w+)/g, (match, varName) => {
        const variable = scopedVars[varName];
        if (variable && typeof variable.value === 'string') {
          return variable.value;
        }
        if (variable && Array.isArray(variable.value)) {
          // This is the bug! Template service returns array instead of individual value
          return variable.value.join(','); // This causes [Attic,Bedroom,Office] in aliases
        }
        return match;
      });
    })
  }))
}));

describe('Alias Variable Real-World Issues', () => {
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

  test('should demonstrate the actual problem with multi-value variable aliases', () => {
    // Setup multi-value variable - this is what comes from Grafana
    const scopedVars: ScopedVars = {
      location: { 
        text: 'Attic,Bedroom,Office', 
        value: ['Attic', 'Bedroom', 'Office']  // Multi-value array
      }
    };

    // Setup query target with alias using variable
    const targets = [{
      refId: 'A',
      query: {
        metricName: 'homeseer/$location/gauge/Temperature',
        alias: '$location Temperature',  // This should expand to individual values
        tags: {},
        groupBy: { tags: [], time: [], value: [] },
        aggregators: []
      }
    }];

    // Mock KairosDB response - this is what would come back from the actual query
    const mockKairosResponse = {
      queries: [{
        sample_size: 3,
        results: [
          {
            name: 'homeseer/Attic/gauge/Temperature',
            tags: { location: ['Attic'] },
            values: [[1234567890000, 72.5]]
          },
          {
            name: 'homeseer/Bedroom/gauge/Temperature', 
            tags: { location: ['Bedroom'] },
            values: [[1234567890000, 68.3]]
          },
          {
            name: 'homeseer/Office/gauge/Temperature',
            tags: { location: ['Office'] },
            values: [[1234567890000, 70.1]]
          }
        ]
      }]
    };

    // Mock the request method to return our test data
    jest.spyOn(datasource, 'request').mockResolvedValue({
      status: 200,
      data: mockKairosResponse,
      statusText: 'OK'
    });

    // Process the query through the actual datasource pipeline
    return datasource.query({
      targets,
      range: { from: new Date(1234567890000 - 3600000), to: new Date(1234567890000) },
      scopedVars,
      interval: '1m',
      intervalMs: 60000,
      maxDataPoints: 1000
    } as any).then(result => {
      
      console.log('Query result data frames:', result.data.length);
      result.data.forEach((frame, index) => {
        console.log(`Frame ${index}: name="${frame.name}", fields=${frame.fields.length}`);
      });
      
      // This is where the bug should be visible:
      // The series names should be:
      // - "Attic Temperature"  
      // - "Bedroom Temperature"
      // - "Office Temperature"
      //
      // But they're probably showing:
      // - "Attic,Bedroom,Office Temperature" (or similar array representation)
      
      expect(result.data).toHaveLength(3); // Should have 3 data frames
      
      // Extract the series names to check the actual problem
      const seriesNames = result.data.map(frame => frame.name);
      console.log('Actual series names:', seriesNames);
      
      // THIS IS THE TEST THAT SHOULD FAIL and demonstrate the problem
      expect(seriesNames).toEqual([
        'Attic Temperature',
        'Bedroom Temperature', 
        'Office Temperature'
      ]);
      
      // If this test fails, it will show us exactly what the series names look like
      // and confirm the bug where arrays are being used instead of individual values
    });
  });

  test('should show how template service behaves with multi-value variables', () => {
    // Test the template service mock directly
    const templateSrv = getTemplateSrv();
    
    const scopedVarsWithArray: ScopedVars = {
      location: { text: 'Attic,Bedroom,Office', value: ['Attic', 'Bedroom', 'Office'] }
    };
    
    const scopedVarsWithString: ScopedVars = {
      location: { text: 'Attic', value: 'Attic' }
    };
    
    // Test with array value (this should demonstrate the problem)
    const resultWithArray = templateSrv.replace('$location Temperature', scopedVarsWithArray);
    console.log('Template result with array value:', resultWithArray);
    
    // Test with string value (this should work correctly)  
    const resultWithString = templateSrv.replace('$location Temperature', scopedVarsWithString);
    console.log('Template result with string value:', resultWithString);
    
    // The array case shows the problem
    expect(resultWithArray).toBe('Attic,Bedroom,Office Temperature'); // This is wrong!
    expect(resultWithString).toBe('Attic Temperature'); // This is correct
  });

  test('should verify metricVariableValues are properly scoped', () => {
    // This tests the core fix - ensuring each metric gets its own variable values
    
    const scopedVars: ScopedVars = {
      location: { text: 'Attic,Bedroom,Office', value: ['Attic', 'Bedroom', 'Office'] }
    };

    // Test the expandMetricNames method directly
    const expansion = (datasource as any).expandMetricNames('homeseer/$location/gauge/Temperature', 'A', scopedVars);
    
    // Verify the variable values are properly scoped per metric
    expect(expansion.variableValues).toHaveLength(3);
    
    // Each should have individual string values, not arrays
    expect(expansion.variableValues[0].location.value).toBe('Attic');
    expect(expansion.variableValues[1].location.value).toBe('Bedroom');  
    expect(expansion.variableValues[2].location.value).toBe('Office');
    
    console.log('Variable values per metric:');
    expansion.variableValues.forEach((vars, index) => {
      console.log(`  Metric ${index}: location = "${vars.location.value}" (type: ${typeof vars.location.value})`);
    });
    
    // Now test alias interpolation with these scoped variables
    const templateSrv = getTemplateSrv();
    
    const aliasResults = expansion.variableValues.map((vars, index) => {
      return templateSrv.replace('$location Temperature', vars);
    });
    
    console.log('Alias interpolation results:', aliasResults);
    
    // These should be individual names, not arrays
    expect(aliasResults).toEqual([
      'Attic Temperature',
      'Bedroom Temperature', 
      'Office Temperature'
    ]);
  });
});