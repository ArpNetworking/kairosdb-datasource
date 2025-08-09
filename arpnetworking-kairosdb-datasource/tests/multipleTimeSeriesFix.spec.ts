/**
 * Test to verify the fix for multiple time series issue
 * 
 * This test verifies that the name-based mapping fix correctly handles
 * groupby queries that return multiple time series per metric.
 */

import { DataSource } from '../src/datasource';
import { ScopedVars } from '@grafana/data';
import { getTemplateSrv, getBackendSrv } from '@grafana/runtime';
import { of } from 'rxjs';

// Mock services
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

describe('Multiple Time Series Fix', () => {
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

  test('should handle groupby query returning multiple series from single metric', async () => {
    const scopedVars: ScopedVars = {};

    const targets = [{
      refId: 'A',
      query: {
        metricName: 'cpu.usage',
        alias: '$_tag_group_host CPU Usage',
        tags: {},
        groupBy: {
          tags: ['host'],
          time: [],
          value: []
        },
        aggregators: []
      }
    }];

    // Mock KairosDB response: single metric returns multiple series due to groupby
    const mockKairosResponse = {
      queries: [{
        sample_size: 3,
        results: [
          {
            name: 'cpu.usage',
            tags: { host: ['web01'] },
            values: [[1640995200000, 85.0]]
          },
          {
            name: 'cpu.usage', // Same metric name
            tags: { host: ['web02'] }, // Different host
            values: [[1640995200000, 92.5]]
          },
          {
            name: 'cpu.usage', // Same metric name
            tags: { host: ['api01'] }, // Different host
            values: [[1640995200000, 78.3]]
          }
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

    console.log('Groupby test result:', {
      dataFrameCount: result.data.length,
      seriesNames: result.data.map(frame => frame.name)
    });

    // The fix should handle all 3 time series
    expect(result.data).toHaveLength(3);
    
    const seriesNames = result.data.map(frame => frame.name);
    expect(seriesNames).toEqual([
      'web01 CPU Usage',
      'web02 CPU Usage',
      'api01 CPU Usage'
    ]);

    // Verify data values
    expect(result.data[0].fields[1].values[0]).toBe(85.0);
    expect(result.data[1].fields[1].values[0]).toBe(92.5);
    expect(result.data[2].fields[1].values[0]).toBe(78.3);
  });

  test('should handle multi-value variables with groupby', async () => {
    const scopedVars: ScopedVars = {
      service: { 
        text: 'web,api', 
        value: ['web', 'api'] 
      }
    };

    const targets = [{
      refId: 'A',
      query: {
        metricName: '$service.cpu.usage',
        alias: '$service-$_tag_group_datacenter CPU',
        tags: {},
        groupBy: {
          tags: ['datacenter'],
          time: [],
          value: []
        },
        aggregators: []
      }
    }];

    // Mock response: 2 expanded metrics × 2 datacenters each = 4 total series
    const mockKairosResponse = {
      queries: [{
        sample_size: 4,
        results: [
          // web.cpu.usage results
          { name: 'web.cpu.usage', tags: { datacenter: ['us-east-1'] }, values: [[1640995200000, 60.0]] },
          { name: 'web.cpu.usage', tags: { datacenter: ['us-west-2'] }, values: [[1640995200000, 65.0]] },
          
          // api.cpu.usage results
          { name: 'api.cpu.usage', tags: { datacenter: ['us-east-1'] }, values: [[1640995200000, 70.0]] },
          { name: 'api.cpu.usage', tags: { datacenter: ['us-west-2'] }, values: [[1640995200000, 75.0]] }
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

    console.log('Multi-value + groupby result:', {
      dataFrameCount: result.data.length,
      seriesNames: result.data.map(frame => frame.name)
    });

    // Should get all 4 series
    expect(result.data).toHaveLength(4);
    
    const seriesNames = result.data.map(frame => frame.name);
    expect(seriesNames).toEqual([
      'web-us-east-1 CPU',
      'web-us-west-2 CPU',
      'api-us-east-1 CPU',
      'api-us-west-2 CPU'
    ]);
  });

  test('should handle mixed scenarios without groupby (regression test)', async () => {
    // Ensure the fix doesn't break normal single-series queries
    
    const scopedVars: ScopedVars = {
      server: { text: 'web01', value: 'web01' }
    };

    const targets = [{
      refId: 'A',
      query: {
        metricName: '$server.memory.usage',
        alias: '$server Memory',
        tags: {},
        groupBy: { tags: [], time: [], value: [] },
        aggregators: []
      }
    }];

    const mockKairosResponse = {
      queries: [{
        results: [
          { name: 'web01.memory.usage', tags: {}, values: [[1640995200000, 512]] }
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

    console.log('Single series result:', {
      dataFrameCount: result.data.length,
      seriesNames: result.data.map(frame => frame.name)
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('web01 Memory');
    expect(result.data[0].fields[1].values[0]).toBe(512);
  });
});