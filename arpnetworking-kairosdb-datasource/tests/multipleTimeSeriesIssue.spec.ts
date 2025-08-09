/**
 * Test to reproduce and fix the issue with multiple time series from a single query
 * 
 * The problem: After the alias pre-processing fix, the metricToTargetMap logic assumes
 * a 1:1 correspondence between expanded metric names and response results. However,
 * in groupby queries, a single metric can return multiple time series (one per group).
 * This breaks the mapping and causes issues with series naming and processing.
 */

import { DataSource } from '../src/datasource';
import { ScopedVars } from '@grafana/data';
import { getTemplateSrv, getBackendSrv } from '@grafana/runtime';
import { of } from 'rxjs';

// Mock template service and backend service
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(() => ({
    replace: jest.fn((text: string, scopedVars?: ScopedVars) => {
      if (!scopedVars || !text) return text;
      
      return text.replace(/\$(\w+)/g, (match, varName) => {
        const variable = scopedVars[varName];
        if (variable) {
          if (Array.isArray(variable.value)) {
            return variable.value.join(',');
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

describe('Multiple Time Series Issue', () => {
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

    mockFetch = getBackendSrv().fetch as jest.Mock;
    jest.clearAllMocks();
  });

  test('should handle single query returning multiple time series (groupby case)', async () => {
    // This test reproduces the issue where a single query with groupby
    // returns multiple time series, but our metricToTargetMap assumes 1:1 mapping
    
    const scopedVars: ScopedVars = {};

    const targets = [{
      refId: 'A',
      query: {
        metricName: 'cpu.usage',
        alias: '$_tag_group_host CPU',
        tags: {},
        groupBy: {
          tags: ['host'], // Group by host - this will return multiple series
          time: [],
          value: []
        },
        aggregators: []
      }
    }];

    // Mock KairosDB response: single metric but multiple results due to groupby
    const mockKairosResponse = {
      queries: [{
        sample_size: 3,
        results: [
          {
            name: 'cpu.usage',
            tags: { host: ['server1'] },
            values: [[1640995200000, 75.5]]
          },
          {
            name: 'cpu.usage', // SAME metric name
            tags: { host: ['server2'] }, // DIFFERENT host
            values: [[1640995200000, 80.3]]
          },
          {
            name: 'cpu.usage', // SAME metric name  
            tags: { host: ['server3'] }, // DIFFERENT host
            values: [[1640995200000, 65.1]]
          }
        ]
      }]
    };

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

    console.log('Query result:', {
      dataFrameCount: result.data.length,
      seriesNames: result.data.map(frame => frame.name)
    });

    // This is what SHOULD happen:
    // - We send 1 metric to KairosDB (cpu.usage grouped by host)  
    // - KairosDB returns 3 results (one per host)
    // - We should get 3 data frames with proper series names
    expect(result.data).toHaveLength(3);
    
    const seriesNames = result.data.map(frame => frame.name);
    expect(seriesNames).toEqual([
      'server1 CPU',
      'server2 CPU', 
      'server3 CPU'
    ]);

    // Verify each series has the correct data
    expect(result.data[0].fields[1].values[0]).toBe(75.5); // server1
    expect(result.data[1].fields[1].values[0]).toBe(80.3); // server2
    expect(result.data[2].fields[1].values[0]).toBe(65.1); // server3
  });

  test('should handle multi-value variable with groupby returning multiple series each', async () => {
    // Even more complex case: multi-value variable expansion + groupby
    // This creates multiple metrics, each returning multiple series
    
    const scopedVars: ScopedVars = {
      service: { 
        text: 'web,api', 
        value: ['web', 'api'] 
      }
    };

    const targets = [{
      refId: 'A',
      query: {
        metricName: '$service.cpu.usage', // Multi-value variable
        alias: '$service-$_tag_group_host CPU',
        tags: {},
        groupBy: {
          tags: ['host'], // Group by host
          time: [],
          value: []
        },
        aggregators: []
      }
    }];

    // Mock response: 2 expanded metrics × 2 hosts each = 4 total results
    const mockKairosResponse = {
      queries: [{
        sample_size: 4,
        results: [
          // web.cpu.usage results
          { name: 'web.cpu.usage', tags: { host: ['web01'] }, values: [[1640995200000, 60.0]] },
          { name: 'web.cpu.usage', tags: { host: ['web02'] }, values: [[1640995200000, 65.0]] },
          
          // api.cpu.usage results  
          { name: 'api.cpu.usage', tags: { host: ['api01'] }, values: [[1640995200000, 70.0]] },
          { name: 'api.cpu.usage', tags: { host: ['api02'] }, values: [[1640995200000, 75.0]] }
        ]
      }]
    };

    mockFetch.mockReturnValue(of({
      status: 200,
      data: mockKairosResponse,
      statusText: 'OK'
    }));

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

    console.log('Complex query result:', {
      dataFrameCount: result.data.length,
      seriesNames: result.data.map(frame => frame.name)
    });

    // Should get 4 data frames total
    expect(result.data).toHaveLength(4);
    
    const seriesNames = result.data.map(frame => frame.name);
    expect(seriesNames).toEqual([
      'web-web01 CPU',  // web service, web01 host
      'web-web02 CPU',  // web service, web02 host
      'api-api01 CPU',  // api service, api01 host  
      'api-api02 CPU'   // api service, api02 host
    ]);
  });

  test('should demonstrate the current broken behavior', async () => {
    // This test shows what currently happens (which is wrong)
    // The metricToTargetMap assumes 1:1 mapping but groupby breaks this
    
    const scopedVars: ScopedVars = {};

    const targets = [{
      refId: 'A',
      query: {
        metricName: 'memory.usage',
        alias: 'Memory $_tag_group_datacenter',
        tags: {},
        groupBy: {
          tags: ['datacenter'],
          time: [],
          value: []
        },
        aggregators: []
      }
    }];

    const mockKairosResponse = {
      queries: [{
        results: [
          { name: 'memory.usage', tags: { datacenter: ['us-east-1'] }, values: [[1640995200000, 80]] },
          { name: 'memory.usage', tags: { datacenter: ['us-west-2'] }, values: [[1640995200000, 75]] }
        ]
      }]
    };

    mockFetch.mockReturnValue(of({
      status: 200,
      data: mockKairosResponse,
      statusText: 'OK'
    }));

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

    console.log('Current broken behavior:', {
      dataFrameCount: result.data.length,
      seriesNames: result.data.map(frame => frame.name),
      error: result.error
    });

    // Document the current broken behavior
    // The test might fail or produce unexpected results due to the mapping issue
  });
});