/**
 * Integration test for alias variable processing
 * 
 * This test simulates the complete query flow with proper mocking
 * to identify where the alias variable issue occurs.
 */

import { DataSource } from '../src/datasource';
import { ScopedVars, FieldType } from '@grafana/data';
import { getTemplateSrv, getBackendSrv } from '@grafana/runtime';
import { of } from 'rxjs';

// Mock the runtime services
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(() => ({
    replace: jest.fn((text: string, scopedVars?: ScopedVars) => {
      if (!scopedVars || !text) return text;
      
      // Simulate real Grafana template service behavior
      return text.replace(/\$(\w+)/g, (match, varName) => {
        const variable = scopedVars[varName];
        if (variable) {
          if (Array.isArray(variable.value)) {
            return variable.value.join(','); // This would be the bug if used incorrectly
          }
          return String(variable.value);
        }
        return match;
      });
    })
  })),
  getBackendSrv: jest.fn(() => ({
    fetch: jest.fn()
  }))
}));

describe('Alias Variable Integration Test', () => {
  let datasource: DataSource;
  let mockFetch: jest.Mock;

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

    // Setup the mock fetch
    mockFetch = getBackendSrv().fetch as jest.Mock;
  });

  test('should properly handle multi-value variable aliases in complete query flow', async () => {
    // Setup multi-value variable
    const scopedVars: ScopedVars = {
      location: { 
        text: 'Attic,Bedroom,Office', 
        value: ['Attic', 'Bedroom', 'Office'] 
      }
    };

    // Setup query target with alias
    const targets = [{
      refId: 'A',
      query: {
        metricName: 'homeseer/$location/gauge/Temperature',
        alias: '$location Temperature', // This should show individual values
        tags: {},
        groupBy: { tags: [], time: [], value: [] },
        aggregators: []
      }
    }];

    // Mock KairosDB response that corresponds to the expanded metrics
    const mockKairosResponse = {
      queries: [{
        sample_size: 3,
        results: [
          {
            name: 'homeseer/Attic/gauge/Temperature',
            tags: { location: ['Attic'] },
            values: [[1640995200000, 72.5], [1640995260000, 72.8]]
          },
          {
            name: 'homeseer/Bedroom/gauge/Temperature', 
            tags: { location: ['Bedroom'] },
            values: [[1640995200000, 68.3], [1640995260000, 68.1]]
          },
          {
            name: 'homeseer/Office/gauge/Temperature',
            tags: { location: ['Office'] },
            values: [[1640995200000, 70.1], [1640995260000, 70.3]]
          }
        ]
      }]
    };

    // Mock the HTTP response
    mockFetch.mockReturnValue(of({
      status: 200,
      data: mockKairosResponse,
      statusText: 'OK'
    }));

    // Execute the query
    const result = await datasource.query({
      targets,
      range: { 
        from: new Date(1640995200000), 
        to: new Date(1640995320000) 
      },
      scopedVars,
      interval: '1m',
      intervalMs: 60000,
      maxDataPoints: 1000
    } as any);

    // Analyze the results
    console.log('Query result:', {
      dataFrameCount: result.data.length,
      dataFrames: result.data.map(frame => ({
        name: frame.name,
        fields: frame.fields.length,
        length: frame.length
      }))
    });

    // Should have 3 data frames (one for each expanded metric)
    expect(result.data).toHaveLength(3);

    // Extract series names to check alias interpolation
    const seriesNames = result.data.map(frame => frame.name);
    console.log('Series names:', seriesNames);

    // This is the critical test - series names should use individual variable values
    expect(seriesNames).toEqual([
      'Attic Temperature',
      'Bedroom Temperature', 
      'Office Temperature'
    ]);

    // Verify data frame structure
    result.data.forEach((frame, index) => {
      expect(frame.fields).toHaveLength(2); // time and value fields
      expect(frame.fields[0].type).toBe(FieldType.time);
      expect(frame.fields[1].type).toBe(FieldType.number);
      expect(frame.length).toBe(2); // 2 data points each
    });

    // If this test fails, it means the alias interpolation is using the wrong variable values
    // and we'll see names like "Attic,Bedroom,Office Temperature" instead
  });

  test('should demonstrate what happens when metricToTargetMap is wrong', async () => {
    // This test simulates what would happen if the metricToTargetMap contained
    // the wrong variable values (like the original multi-value arrays)

    const scopedVars: ScopedVars = {
      location: { text: 'Attic,Bedroom,Office', value: ['Attic', 'Bedroom', 'Office'] }
    };

    // Test the expandMetricNames method first  
    const expansion = (datasource as any).expandMetricNames('homeseer/$location/gauge/Temperature', 'A', scopedVars);
    
    console.log('Expansion result:', {
      names: expansion.names,
      variableValueTypes: expansion.variableValues.map(v => typeof v.location?.value),
      variableValues: expansion.variableValues.map(v => v.location?.value)
    });

    // Verify expansion creates correct individual variable values
    expect(expansion.variableValues[0].location.value).toBe('Attic');
    expect(expansion.variableValues[1].location.value).toBe('Bedroom');
    expect(expansion.variableValues[2].location.value).toBe('Office');

    // Test what would happen with wrong variable values
    const templateSrv = getTemplateSrv();
    const alias = '$location Temperature';

    // Correct usage (what should happen)
    const correctAliases = expansion.variableValues.map(vars => 
      templateSrv.replace(alias, vars)
    );

    // Wrong usage (what might be happening if there's a bug)
    const wrongAlias = templateSrv.replace(alias, scopedVars);

    console.log('Correct aliases:', correctAliases);
    console.log('Wrong alias (if original scopedVars used):', wrongAlias);

    expect(correctAliases).toEqual([
      'Attic Temperature',
      'Bedroom Temperature',
      'Office Temperature'
    ]);
    expect(wrongAlias).toBe('Attic,Bedroom,Office Temperature'); // This would be wrong!
  });

  test('should verify the HTTP request contains expanded metrics', async () => {
    const scopedVars: ScopedVars = {
      location: { text: 'Attic,Bedroom', value: ['Attic', 'Bedroom'] }
    };

    const targets = [{
      refId: 'A',
      query: {
        metricName: 'homeseer/$location/gauge/Temperature',
        alias: '$location Temp',
        tags: {},
        groupBy: { tags: [], time: [], value: [] },
        aggregators: []
      }
    }];

    // Mock a simple response
    mockFetch.mockReturnValue(of({
      status: 200,
      data: { queries: [{ results: [] }] },
      statusText: 'OK'
    }));

    try {
      await datasource.query({
        targets,
        range: { from: new Date(1640995200000), to: new Date(1640995320000) },
        scopedVars,
        interval: '1m',
        intervalMs: 60000,
        maxDataPoints: 1000
      } as any);
    } catch (error) {
      // We expect this to work, but if there are errors, they'll be logged
    }

    // Check what request was made
    expect(mockFetch).toHaveBeenCalled();
    const callArgs = mockFetch.mock.calls[0];
    const requestBody = callArgs[0].data;

    console.log('HTTP request body:', JSON.stringify(requestBody, null, 2));
    
    // Verify the request contains expanded metric names
    expect(requestBody.metrics).toHaveLength(2);
    expect(requestBody.metrics[0].name).toBe('homeseer/Attic/gauge/Temperature');
    expect(requestBody.metrics[1].name).toBe('homeseer/Bedroom/gauge/Temperature');
  });
});