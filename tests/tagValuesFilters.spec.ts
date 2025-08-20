import { DataSource } from '../src/datasource';
import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { KairosDBDataSourceOptions } from '../src/types';
import { getBackendSrv } from '@grafana/runtime';
import { of } from 'rxjs';

// Mock Grafana runtime
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
  getTemplateSrv: jest.fn(() => ({
    replace: jest.fn((value: string, scopedVars?: ScopedVars) => {
      if (scopedVars) {
        let result = value;
        Object.keys(scopedVars).forEach((key) => {
          const varPattern = new RegExp(`\\$${key}`, 'g');
          if (scopedVars[key] && scopedVars[key].value !== undefined) {
            result = result.replace(varPattern, String(scopedVars[key].value));
          }
        });
        return result;
      }
      return value;
    }),
  })),
}));

describe('tag_values with filters', () => {
  let datasource: DataSource;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (getBackendSrv as jest.Mock).mockReturnValue({
      fetch: fetchMock,
    });

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

  describe('Filter problems', () => {
    it('should send filters in the KairosDB API request body', async () => {
      // Mock response that should be returned when filters are applied correctly
      const mockResponse = {
        queries: [
          {
            results: [
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01', 'web02'], // Only hosts in us-east-1 datacenter
                },
              },
            ],
          },
        ],
      };

      fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

      // Execute tag_values query with filters
      const result = await datasource.metricFindQuery('tag_values(system.cpu.usage, host, datacenter=us-east-1, env=prod)');

      // Verify the API was called
      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      // Get the actual request that was made
      const [callArgs] = fetchMock.mock.calls[0];
      
      // Verify the correct endpoint was called
      expect(callArgs.url).toBe('http://localhost:8080/api/v1/datapoints/query/tags');
      expect(callArgs.method).toBe('POST');
      
      // Verify the request body contains the filters
      const requestBody = callArgs.data;
      expect(requestBody).toEqual({
        start_absolute: expect.any(Number), // 24 hours ago
        end_absolute: expect.any(Number),   // now
        metrics: [
          {
            name: 'system.cpu.usage',
            tags: {
              datacenter: ['us-east-1'],
              env: ['prod'],
            },
          },
        ],
      });

      // Verify the response
      expect(result).toEqual([
        { text: 'web01', value: 'web01' },
        { text: 'web02', value: 'web02' },
      ]);
    });

    it('should interpolate variable values in filters before sending to API', async () => {
      const mockResponse = {
        queries: [
          {
            results: [
              {
                name: 'system.cpu.usage', 
                tags: {
                  host: ['api01', 'api02'],
                },
              },
            ],
          },
        ],
      };

      fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

      // Define scoped variables
      const scopedVars: ScopedVars = {
        datacenter: { text: 'us-west-2', value: 'us-west-2' },
        environment: { text: 'production', value: 'production' },
      };

      // Execute query with variable filters
      const result = await datasource.metricFindQuery(
        'tag_values(system.cpu.usage, host, datacenter=$datacenter, env=$environment)',
        { scopedVars }
      );

      // Verify the API was called with interpolated values
      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      const [callArgs] = fetchMock.mock.calls[0];
      const requestBody = callArgs.data;
      
      expect(requestBody.metrics[0].tags).toEqual({
        datacenter: ['us-west-2'],      // Variable interpolated
        env: ['production'],            // Variable interpolated
      });

      expect(result).toEqual([
        { text: 'api01', value: 'api01' },
        { text: 'api02', value: 'api02' },
      ]);
    });

    it('should handle multi-value variables in filters', async () => {
      const mockResponse = {
        queries: [
          {
            results: [
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01', 'web02', 'api01', 'api02'],
                },
              },
            ],
          },
        ],
      };

      fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

      // Mock template service to handle multi-value variable expansion
      const templateSrvMock = {
        replace: jest.fn((value: string) => {
          if (value === '$datacenters') {
            return 'us-east-1,us-west-2'; // Multi-value variable
          }
          return value;
        }),
      };
      
      require('@grafana/runtime').getTemplateSrv.mockReturnValue(templateSrvMock);

      const result = await datasource.metricFindQuery('tag_values(system.cpu.usage, host, datacenter=$datacenters)');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      const [callArgs] = fetchMock.mock.calls[0];
      const requestBody = callArgs.data;
      
      // Should split multi-value variable into array
      expect(requestBody.metrics[0].tags).toEqual({
        datacenter: ['us-east-1', 'us-west-2'],
      });
    });

    it('should handle queries with no filters (current behavior)', async () => {
      const mockResponse = {
        queries: [
          {
            results: [
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01', 'web02', 'api01', 'api02', 'db01'],
                },
              },
            ],
          },
        ],
      };

      fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

      const result = await datasource.metricFindQuery('tag_values(system.cpu.usage, host)');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      const [callArgs] = fetchMock.mock.calls[0];
      const requestBody = callArgs.data;
      
      // Should not have tags filter when no filters specified
      expect(requestBody.metrics[0]).toEqual({
        name: 'system.cpu.usage',
      });
      expect(requestBody.metrics[0].tags).toBeUndefined();

      expect(result).toEqual([
        { text: 'web01', value: 'web01' },
        { text: 'web02', value: 'web02' },
        { text: 'api01', value: 'api01' },
        { text: 'api02', value: 'api02' },
        { text: 'db01', value: 'db01' },
      ]);
    });

    it('should handle empty filter values gracefully', async () => {
      const mockResponse = {
        queries: [
          {
            results: [
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01', 'web02'],
                },
              },
            ],
          },
        ],
      };

      fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

      // Query with empty variable that resolves to empty string
      const scopedVars: ScopedVars = {
        datacenter: { text: '', value: '' },
      };

      const result = await datasource.metricFindQuery(
        'tag_values(system.cpu.usage, host, datacenter=$datacenter)',
        { scopedVars }
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      const [callArgs] = fetchMock.mock.calls[0];
      const requestBody = callArgs.data;
      
      // Should not include filters with empty values
      expect(requestBody.metrics[0]).toEqual({
        name: 'system.cpu.usage',
      });
      expect(requestBody.metrics[0].tags).toBeUndefined();
    });
  });

  describe('Fixed behavior verification', () => {
    it('verifies that filters are now properly sent to KairosDB API', async () => {
      const mockResponse = {
        queries: [
          {
            results: [
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01', 'web02'], // Only hosts in us-east-1 datacenter (filtered)
                },
              },
            ],
          },
        ],
      };

      fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

      // Execute query with filters - should now use new filtered implementation
      const result = await datasource.metricFindQuery('tag_values(system.cpu.usage, host, datacenter=us-east-1)');

      // Verify the API was called with filters
      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      const [callArgs] = fetchMock.mock.calls[0];
      expect(callArgs.data.metrics[0].tags).toEqual({
        datacenter: ['us-east-1'],
      });

      // Filtered results are returned
      expect(result).toEqual([
        { text: 'web01', value: 'web01' },
        { text: 'web02', value: 'web02' },
      ]);
    });

    it('verifies variable interpolation in filters now works', async () => {
      const mockResponse = {
        queries: [
          {
            results: [
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['api01', 'api02'],
                },
              },
            ],
          },
        ],
      };

      fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

      // Update the template service mock to handle the datacenter variable
      const templateSrvMock = {
        replace: jest.fn((value: string, scopedVars?: ScopedVars) => {
          if (value === '$datacenter' && scopedVars && scopedVars.datacenter) {
            return String(scopedVars.datacenter.value);
          }
          return value;
        }),
      };
      
      require('@grafana/runtime').getTemplateSrv.mockReturnValue(templateSrvMock);

      const scopedVars: ScopedVars = {
        datacenter: { text: 'us-west-2', value: 'us-west-2' },
      };

      // This should now query KairosDB with interpolated datacenter=us-west-2 filter
      await datasource.metricFindQuery('tag_values(system.cpu.usage, host, datacenter=$datacenter)', { scopedVars });

      // Verify the API was called with interpolated filter
      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      const [callArgs] = fetchMock.mock.calls[0];
      expect(callArgs.data.metrics[0].tags).toEqual({
        datacenter: ['us-west-2'], // Variable was interpolated
      });
    });
  });
});