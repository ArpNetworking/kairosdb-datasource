/**
 * Tests for time range handling in variable queries
 * Verifies that metricFindQuery properly uses dashboard time range
 */

import { DataSource } from '../src/datasource';
import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { KairosDBDataSourceOptions } from '../src/types';
import { getBackendSrv } from '@grafana/runtime';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
  getTemplateSrv: jest.fn(() => ({
    replace: (value: string) => value,
  })),
}));

describe('Variable Query Time Range Handling', () => {
  let datasource: DataSource;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    (getBackendSrv as jest.Mock).mockReturnValue({
      fetch: mockFetch,
    });

    const instanceSettings: DataSourceInstanceSettings<KairosDBDataSourceOptions> = {
      id: 1,
      uid: 'test',
      type: 'kairosdb',
      name: 'KairosDB',
      url: 'http://localhost:8080',
      jsonData: {},
      access: 'proxy',
      meta: {} as any,
      readOnly: false,
    };

    datasource = new DataSource(instanceSettings);
  });

  describe('tag_names() queries', () => {
    test('should use provided time range when available', async () => {
      const timeRange = {
        from: { valueOf: () => 1609459200000 }, // 2021-01-01 00:00:00
        to: { valueOf: () => 1612137600000 },   // 2021-02-01 00:00:00
      };

      mockFetch.mockReturnValue({
        toPromise: () => Promise.resolve({
          data: {
            queries: [{
              results: [{
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01', 'web02'],
                  datacenter: ['us-east-1'],
                },
              }],
            }],
          },
        }),
      });

      await datasource.metricFindQuery('tag_names(system.cpu.usage)', { range: timeRange });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            start_absolute: 1609459200000,
            end_absolute: 1612137600000,
          }),
        })
      );
    });

    test('should fallback to 24 hours when no time range provided', async () => {
      const beforeNow = Date.now();

      mockFetch.mockReturnValue({
        toPromise: () => Promise.resolve({
          data: {
            queries: [{
              results: [{
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01'],
                },
              }],
            }],
          },
        }),
      });

      await datasource.metricFindQuery('tag_names(system.cpu.usage)', {});

      const afterNow = Date.now();

      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0][0];
      const requestData = callArgs.data;

      // Should be approximately 24 hours ago (within test execution time)
      expect(requestData.start_absolute).toBeGreaterThanOrEqual(beforeNow - 24 * 60 * 60 * 1000 - 100);
      expect(requestData.start_absolute).toBeLessThanOrEqual(beforeNow - 24 * 60 * 60 * 1000 + 100);

      // Should be approximately now
      expect(requestData.end_absolute).toBeGreaterThanOrEqual(beforeNow - 100);
      expect(requestData.end_absolute).toBeLessThanOrEqual(afterNow + 100);
    });
  });

  describe('tag_values() queries', () => {
    test('should use provided time range for tag values', async () => {
      const timeRange = {
        from: { valueOf: () => 1609459200000 }, // 2021-01-01 00:00:00
        to: { valueOf: () => 1612137600000 },   // 2021-02-01 00:00:00
      };

      mockFetch.mockReturnValue({
        toPromise: () => Promise.resolve({
          data: {
            queries: [{
              results: [{
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01', 'web02', 'web03'],
                },
              }],
            }],
          },
        }),
      });

      await datasource.metricFindQuery('tag_values(system.cpu.usage, host)', { range: timeRange });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            start_absolute: 1609459200000,
            end_absolute: 1612137600000,
          }),
        })
      );
    });

    test('should use provided time range with filters', async () => {
      const timeRange = {
        from: { valueOf: () => 1609459200000 },
        to: { valueOf: () => 1612137600000 },
      };

      mockFetch.mockReturnValue({
        toPromise: () => Promise.resolve({
          data: {
            queries: [{
              results: [{
                name: 'system.cpu.usage',
                tags: {
                  host: ['web01'],
                },
              }],
            }],
          },
        }),
      });

      await datasource.metricFindQuery(
        'tag_values(system.cpu.usage, host, datacenter=us-east-1)',
        { range: timeRange }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            start_absolute: 1609459200000,
            end_absolute: 1612137600000,
            metrics: expect.arrayContaining([
              expect.objectContaining({
                name: 'system.cpu.usage',
                tags: { datacenter: ['us-east-1'] },
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('Time range with variables', () => {
    test('should use time range when querying with template variables', async () => {
      const timeRange = {
        from: { valueOf: () => 1577836800000 }, // 2020-01-01 00:00:00
        to: { valueOf: () => 1609459200000 },   // 2021-01-01 00:00:00
      };

      const scopedVars: ScopedVars = {
        metric: { text: 'system.cpu.usage', value: 'system.cpu.usage' },
      };

      mockFetch.mockReturnValue({
        toPromise: () => Promise.resolve({
          data: {
            queries: [{
              results: [{
                name: 'system.cpu.usage',
                tags: {
                  host: ['server1', 'server2', 'server3'],
                  datacenter: ['us-west-2'],
                },
              }],
            }],
          },
        }),
      });

      await datasource.metricFindQuery('tag_names($metric)', {
        scopedVars,
        range: timeRange,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            start_absolute: 1577836800000,
            end_absolute: 1609459200000,
          }),
        })
      );
    });
  });

  describe('Direct method calls', () => {
    test('getMetricTags should use provided time range', async () => {
      const timeRange = { from: 1000000000000, to: 2000000000000 };

      mockFetch.mockReturnValue({
        toPromise: () => Promise.resolve({
          data: {
            queries: [{
              results: [{
                name: 'test.metric',
                tags: { tag1: ['value1'] },
              }],
            }],
          },
        }),
      });

      await datasource.getMetricTags('test.metric', timeRange);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            start_absolute: 1000000000000,
            end_absolute: 2000000000000,
          }),
        })
      );
    });

    test('getMetricTagsWithFilters should use provided time range', async () => {
      const timeRange = { from: 1500000000000, to: 1600000000000 };
      const filters = { env: ['prod'], region: ['us-east-1'] };

      mockFetch.mockReturnValue({
        toPromise: () => Promise.resolve({
          data: {
            queries: [{
              results: [{
                name: 'test.metric',
                tags: { host: ['server1'] },
              }],
            }],
          },
        }),
      });

      await datasource.getMetricTagsWithFilters('test.metric', filters, timeRange);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            start_absolute: 1500000000000,
            end_absolute: 1600000000000,
            metrics: expect.arrayContaining([
              expect.objectContaining({
                name: 'test.metric',
                tags: filters,
              }),
            ]),
          }),
        })
      );
    });
  });
});
