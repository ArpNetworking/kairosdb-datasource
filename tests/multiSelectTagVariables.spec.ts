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

describe('Multi-select Variables in Tag Filters', () => {
  let datasource: DataSource;
  let fetchMock: jest.Mock;
  let templateSrvMock: any;

  beforeEach(() => {
    fetchMock = jest.fn();
    (getBackendSrv as jest.Mock).mockReturnValue({
      fetch: fetchMock,
    });

    // Set up template service mock with multi-value variable support
    templateSrvMock = {
      replace: jest.fn((value: string, scopedVars?: ScopedVars) => {
        // Handle multi-select variable - returns comma-separated values
        if (value === '$host') {
          return 'web01,web02,api01'; // Multi-value variable
        }
        if (value === '$env') {
          return 'prod,staging'; // Multi-value variable
        }
        if (value === '$datacenter') {
          return 'us-east-1'; // Single value variable
        }
        // Handle array format like ['$host']
        if (value === '[$host]') {
          return '["web01","web02","api01"]';
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

  describe('Query Building', () => {
    it('should properly expand multi-select variables in tag filters', async () => {
      const mockResponse = {
        queries: [
          {
            sample_size: 100,
            results: [
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01'],
                  env: ['prod'],
                },
                values: [[1234567890000, 42]],
              },
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['web02'],
                  env: ['prod'],
                },
                values: [[1234567890000, 38]],
              },
            ],
          },
        ],
      };

      fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

      const query: KairosDBQuery = {
        refId: 'A',
        query: {
          metricName: 'system.cpu.usage',
          tags: {
            host: ['$host'], // Multi-select variable
            env: ['$env'],   // Multi-select variable
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
      
      // Verify that multi-select variables were expanded into arrays
      expect(requestBody.metrics[0].tags).toEqual({
        host: ['web01', 'web02', 'api01'], // Multi-value variable expanded
        env: ['prod', 'staging'],           // Multi-value variable expanded
      });
    });

    it('should handle mixed single and multi-select variables in tags', async () => {
      const mockResponse = {
        queries: [
          {
            sample_size: 100,
            results: [
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01'],
                  datacenter: ['us-east-1'],
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
          metricName: 'system.cpu.usage',
          tags: {
            host: ['$host'],           // Multi-select variable
            datacenter: ['$datacenter'], // Single value variable
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
      
      // Verify mixed variable types are handled correctly
      expect(requestBody.metrics[0].tags).toEqual({
        host: ['web01', 'web02', 'api01'], // Multi-value expanded
        datacenter: ['us-east-1'],          // Single value stays as single
      });
    });

    it('should handle empty multi-select variables', async () => {
      // Mock template service to return empty for a variable
      templateSrvMock.replace.mockImplementation((value: string) => {
        if (value === '$empty_var') {
          return ''; // Empty multi-select
        }
        if (value === '$host') {
          return 'web01,web02';
        }
        return value;
      });

      const mockResponse = {
        queries: [
          {
            sample_size: 100,
            results: [
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01'],
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
          metricName: 'system.cpu.usage',
          tags: {
            host: ['$host'],
            optional_tag: ['$empty_var'], // Empty variable
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
      
      // Empty tag should be filtered out
      expect(requestBody.metrics[0].tags).toEqual({
        host: ['web01', 'web02'],
        // optional_tag should not be present since it was empty
      });
    });

    it('should handle All option ({__all}) in multi-select variables', async () => {
      // Mock template service to return {__all} format
      templateSrvMock.replace.mockImplementation((value: string) => {
        if (value === '$all_hosts') {
          return '{web01,web02,api01,api02,db01}'; // Grafana's format for "All" selection
        }
        return value;
      });

      const mockResponse = {
        queries: [
          {
            sample_size: 100,
            results: [
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01'],
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
          metricName: 'system.cpu.usage',
          tags: {
            host: ['$all_hosts'], // Variable with "All" selected
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
      
      // Should handle the curly brace format
      expect(requestBody.metrics[0].tags).toEqual({
        host: ['web01', 'web02', 'api01', 'api02', 'db01'],
      });
    });

    it('should handle variables with special characters in values', async () => {
      // Mock template service to return values with special characters
      templateSrvMock.replace.mockImplementation((value: string) => {
        if (value === '$special_hosts') {
          return 'web-01.example.com,web-02.example.com,api_01'; // Values with dots and dashes
        }
        return value;
      });

      const mockResponse = {
        queries: [
          {
            sample_size: 100,
            results: [
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['web-01.example.com'],
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
          metricName: 'system.cpu.usage',
          tags: {
            host: ['$special_hosts'],
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
      
      // Should properly handle special characters
      expect(requestBody.metrics[0].tags).toEqual({
        host: ['web-01.example.com', 'web-02.example.com', 'api_01'],
      });
    });

    it('should handle nested variable expansion', async () => {
      // Mock template service to handle nested variables
      templateSrvMock.replace.mockImplementation((value: string) => {
        if (value === '$hosts_$env') {
          // First pass: replace $env
          value = value.replace('$env', 'prod');
          // Second pass: replace $hosts_prod
          if (value === '$hosts_prod') {
            return 'web01,web02';
          }
        }
        if (value === '$env') {
          return 'prod';
        }
        return value;
      });

      const mockResponse = {
        queries: [
          {
            sample_size: 100,
            results: [
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01'],
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
          metricName: 'system.cpu.usage',
          tags: {
            host: ['$hosts_$env'], // Nested variable
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
      
      // Should handle nested variable expansion
      expect(requestBody.metrics[0].tags).toEqual({
        host: ['web01', 'web02'],
      });
    });
  });

  describe('Bug Reproduction', () => {
    it('FAILS: should demonstrate the bug with multi-select variables not being properly expanded', async () => {
      // This test is expected to FAIL initially, demonstrating the bug
      // After the fix, it should PASS
      
      // Setup: User has a multi-select variable $host with values ["web01", "web02", "api01"]
      // They select multiple values in the dashboard
      templateSrvMock.replace.mockImplementation((value: string) => {
        if (value === '$host') {
          // Grafana returns comma-separated for multi-select
          return 'web01,web02,api01';
        }
        return value;
      });

      const mockResponse = {
        queries: [
          {
            sample_size: 100,
            results: [
              {
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01'],
                  env: ['prod'],
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
          metricName: 'system.cpu.usage',
          tags: {
            host: ['$host'], // User adds the multi-select variable
            env: ['prod'],   // Static value
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
      
      // THE BUG: Without the fix, this might send ["web01,web02,api01"] as a single string
      // instead of ["web01", "web02", "api01"] as separate values
      
      // This assertion should PASS after the fix
      expect(requestBody.metrics[0].tags).toEqual({
        host: ['web01', 'web02', 'api01'], // Should be array of individual values
        env: ['prod'],
      });
      
      // Verify it's not sending the wrong format
      expect(requestBody.metrics[0].tags.host).not.toEqual(['web01,web02,api01']); // Wrong: single string
    });
  });
});
