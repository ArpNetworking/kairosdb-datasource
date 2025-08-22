import { DataSource } from '../src/datasource';
import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { KairosDBDataSourceOptions, KairosDBQuery } from '../src/types';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { of } from 'rxjs';

// Mock Grafana runtime
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
  getTemplateSrv: jest.fn(),
}));

describe('Prefixed Multi-select Variables in Tag Filters', () => {
  let datasource: DataSource;
  let fetchMock: jest.Mock;
  let templateSrvMock: any;

  beforeEach(() => {
    fetchMock = jest.fn();
    (getBackendSrv as jest.Mock).mockReturnValue({
      fetch: fetchMock,
    });

    // Set up template service mock to simulate real Grafana behavior
    templateSrvMock = {
      replace: jest.fn((value: string, scopedVars?: ScopedVars) => {
        // This simulates what Grafana actually does with multi-value variables
        // When you have foo-$location and $location is multi-value
        if (value === 'foo-$location') {
          // Grafana returns this format when variable is multi-value
          return 'foo-{Attic,Bedroom,Garage,Living Room,Office}';
        }
        if (value === '$location') {
          // If just the variable, return the comma-separated list
          return 'Attic,Bedroom,Garage,Living Room,Office';
        }
        return value;
      }),
      getVariables: jest.fn(() => []),
    };
    
    (getTemplateSrv as jest.Mock).mockReturnValue(templateSrvMock);

    const instanceSettings: DataSourceInstanceSettings<KairosDBDataSourceOptions> = {
      id: 1,
      uid: 'test-uid',
      type: 'kairosdb-datasource',
      name: 'TestDataSource',
      url: 'http://localhost:8080',
      jsonData: {} as KairosDBDataSourceOptions,
      meta: {} as any,
      access: 'proxy',
    };

    datasource = new DataSource(instanceSettings);
  });

  it('should handle prefixed multi-value variables like foo-$location', async () => {
    const mockResponse = {
      queries: [
        {
          sample_size: 100,
          results: [
            {
              name: 'snmp/temperature/System Board Exhaust Temp',
              tags: {
                cluster: ['foo-Attic'],
              },
              values: [[1234567890000, 42]],
            },
          ],
        },
      ],
    };

    fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

    const query: KairosDBQuery = {
      refId: 'A',
      query: {
        metricName: 'snmp/temperature/System Board Exhaust Temp',
        tags: {
          cluster: ['foo-$location'], // Prefixed multi-value variable
        },
      },
    };

    const options = {
      range: {
        from: new Date(Date.now() - 3600000),
        to: new Date(),
      },
      targets: [query],
    } as any;

    await datasource.query(options);

    // Verify the API was called
    expect(fetchMock).toHaveBeenCalledTimes(1);
    
    const [callArgs] = fetchMock.mock.calls[0];
    const requestBody = callArgs.data;
    
    // Should expand to individual prefixed values, NOT include the curly braces
    expect(requestBody.metrics[0].tags).toEqual({
      cluster: [
        'foo-Attic',
        'foo-Bedroom', 
        'foo-Garage',
        'foo-Living Room',
        'foo-Office'
      ],
    });
    
    // Verify it's NOT sending the broken format
    expect(requestBody.metrics[0].tags.cluster).not.toEqual(['foo-{Attic', 'Bedroom', 'Garage', 'Living Room', 'Office}']);
  });

  it('should handle suffixed multi-value variables like $location-bar', async () => {
    templateSrvMock.replace.mockImplementation((value: string) => {
      if (value === '$location-bar') {
        // Grafana returns this format when variable is multi-value with suffix
        return '{Attic,Bedroom,Garage}-bar';
      }
      return value;
    });

    const mockResponse = {
      queries: [
        {
          sample_size: 100,
          results: [
            {
              name: 'test.metric',
              tags: {
                cluster: ['Attic-bar'],
              },
              values: [[1234567890000, 42]],
            },
          ],
        },
      ],
    };

    fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

    const query: KairosDBQuery = {
      refId: 'A',
      query: {
        metricName: 'test.metric',
        tags: {
          cluster: ['$location-bar'], // Suffixed multi-value variable
        },
      },
    };

    const options = {
      range: {
        from: new Date(Date.now() - 3600000),
        to: new Date(),
      },
      targets: [query],
    } as any;

    await datasource.query(options);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    
    const [callArgs] = fetchMock.mock.calls[0];
    const requestBody = callArgs.data;
    
    // Should expand to individual suffixed values
    expect(requestBody.metrics[0].tags).toEqual({
      cluster: [
        'Attic-bar',
        'Bedroom-bar', 
        'Garage-bar',
      ],
    });
  });

  it('should handle both prefix and suffix: foo-$location-bar', async () => {
    templateSrvMock.replace.mockImplementation((value: string) => {
      if (value === 'foo-$location-bar') {
        // Grafana returns this format when variable is multi-value with both prefix and suffix
        return 'foo-{Attic,Bedroom,Garage}-bar';
      }
      return value;
    });

    const mockResponse = {
      queries: [
        {
          sample_size: 100,
          results: [
            {
              name: 'test.metric',
              tags: {
                cluster: ['foo-Attic-bar'],
              },
              values: [[1234567890000, 42]],
            },
          ],
        },
      ],
    };

    fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

    const query: KairosDBQuery = {
      refId: 'A',
      query: {
        metricName: 'test.metric',
        tags: {
          cluster: ['foo-$location-bar'], // Both prefix and suffix
        },
      },
    };

    const options = {
      range: {
        from: new Date(Date.now() - 3600000),
        to: new Date(),
      },
      targets: [query],
    } as any;

    await datasource.query(options);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    
    const [callArgs] = fetchMock.mock.calls[0];
    const requestBody = callArgs.data;
    
    // Should expand to individual values with both prefix and suffix
    expect(requestBody.metrics[0].tags).toEqual({
      cluster: [
        'foo-Attic-bar',
        'foo-Bedroom-bar', 
        'foo-Garage-bar',
      ],
    });
  });
});
