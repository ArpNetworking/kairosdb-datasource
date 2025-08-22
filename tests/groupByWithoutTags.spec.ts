import { DataSource } from '../src/datasource';
import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { KairosDBDataSourceOptions, KairosDBQuery } from '../src/types';
import { getBackendSrv } from '@grafana/runtime';
import { of } from 'rxjs';

// Mock Grafana runtime
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
  getTemplateSrv: jest.fn(() => ({
    replace: jest.fn((value: string, scopedVars?: ScopedVars) => {
      // Handle $_tag_group_ variables
      if (scopedVars) {
        let result = value;
        // Replace all $_tag_group_XXX variables with their values from scopedVars
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

describe('GroupBy responses without tags array', () => {
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

  it('should correctly extract grouped tag values from group_by field when tags array is missing', async () => {
    // This mimics the response structure from the image - no tags array, only group_by with group object
    const mockResponse = {
      queries: [
        {
          sample_size: 100,
          results: [
            {
              name: 'kafka.consumer.group.consumer.lag.by.topic',
              group_by: [
                {
                  name: 'tag',
                  group: {
                    kafka_topic: 'advevents.streams.0.0.0.KSTREAM.REPARTITION.0000000003.repartition',
                  },
                },
              ],
              // Note: NO tags field at all (like in the image)
              values: [
                [1734567600000, 0],
                [1734567660000, 0],
              ],
            },
            {
              name: 'kafka.consumer.group.consumer.lag.by.topic',
              group_by: [
                {
                  name: 'tag',
                  group: {
                    kafka_topic: 'advevents.streams.0.0.0.KSTREAM.REPARTITION.0000000013.repartition',
                  },
                },
              ],
              // Note: NO tags field at all
              values: [
                [1734567600000, 5],
                [1734567660000, 3],
              ],
            },
          ],
        },
      ],
    };

    fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

    const query: KairosDBQuery = {
      refId: 'A',
      query: {
        metricName: 'kafka.consumer.group.consumer.lag.by.topic',
        alias: '$_tag_group_kafka_topic',
        tags: {},
        groupBy: {
          tags: ['kafka_topic'],
        },
        aggregators: [],
      },
    };

    const result = await datasource.query({
      targets: [query],
      requestId: '1',
      interval: '1m',
      intervalMs: 60000,
      range: {
        from: new Date(1734567600000),
        to: new Date(1734567720000),
      },
      scopedVars: {},
    } as any);

    // Verify we got data frames back
    expect(result.data).toHaveLength(2);

    // Check the first series
    const firstSeries = result.data[0];
    expect(firstSeries.name).toBe('advevents.streams.0.0.0.KSTREAM.REPARTITION.0000000003.repartition');
    expect(firstSeries.fields[0].values).toEqual([1734567600000, 1734567660000]);
    expect(firstSeries.fields[1].values).toEqual([0, 0]);

    // Check the second series
    const secondSeries = result.data[1];
    expect(secondSeries.name).toBe('advevents.streams.0.0.0.KSTREAM.REPARTITION.0000000013.repartition');
    expect(secondSeries.fields[0].values).toEqual([1734567600000, 1734567660000]);
    expect(secondSeries.fields[1].values).toEqual([5, 3]);
  });

  it('should handle responses with empty tags array alongside group_by', async () => {
    // Test when tags exists but is empty
    const mockResponse = {
      queries: [
        {
          sample_size: 100,
          results: [
            {
              name: 'kafka.consumer.group.consumer.lag.by.topic',
              group_by: [
                {
                  name: 'tag',
                  group: {
                    topic: 'orders',
                    partition: '0',
                  },
                },
              ],
              tags: {}, // Empty tags object
              values: [
                [1734567600000, 10],
              ],
            },
          ],
        },
      ],
    };

    fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

    const query: KairosDBQuery = {
      refId: 'A',
      query: {
        metricName: 'kafka.consumer.group.consumer.lag.by.topic',
        alias: 'Topic: $_tag_group_topic, Partition: $_tag_group_partition',
        tags: {},
        groupBy: {
          tags: ['topic', 'partition'],
        },
        aggregators: [],
      },
    };

    const result = await datasource.query({
      targets: [query],
      requestId: '1',
      interval: '1m',
      intervalMs: 60000,
      range: {
        from: new Date(1734567600000),
        to: new Date(1734567720000),
      },
      scopedVars: {},
    } as any);

    // Verify the alias was interpolated correctly using group_by values
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Topic: orders, Partition: 0');
  });

  it('should fallback gracefully when neither tags nor group_by.group contain expected values', async () => {
    const mockResponse = {
      queries: [
        {
          sample_size: 100,
          results: [
            {
              name: 'test.metric',
              group_by: [
                {
                  name: 'time',
                  range_size: {
                    value: 1,
                    unit: 'minutes',
                  },
                },
              ],
              // No tags field and no tag grouping
              values: [
                [1734567600000, 100],
              ],
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
        alias: 'Test $_tag_group_host', // Expects a host tag that doesn't exist
        tags: {},
        groupBy: {
          tags: ['host'], // Grouping by host but it won't be in the response
        },
        aggregators: [],
      },
    };

    const result = await datasource.query({
      targets: [query],
      requestId: '1',
      interval: '1m',
      intervalMs: 60000,
      range: {
        from: new Date(1734567600000),
        to: new Date(1734567720000),
      },
      scopedVars: {},
    } as any);

    // Should still return data, just without the tag interpolation
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Test $_tag_group_host'); // Variable not replaced since tag doesn't exist
  });

  it('should prefer group_by.group values over tags array when both exist', async () => {
    const mockResponse = {
      queries: [
        {
          sample_size: 100,
          results: [
            {
              name: 'cpu.usage',
              group_by: [
                {
                  name: 'tag',
                  group: {
                    host: 'server1', // This should be used
                  },
                },
              ],
              tags: {
                host: ['server1', 'server2', 'server3'], // This should be ignored for grouped results
                datacenter: ['us-east'],
              },
              values: [
                [1734567600000, 45],
              ],
            },
            {
              name: 'cpu.usage',
              group_by: [
                {
                  name: 'tag',
                  group: {
                    host: 'server2', // This should be used
                  },
                },
              ],
              tags: {
                host: ['server1', 'server2', 'server3'], // This should be ignored
                datacenter: ['us-east'],
              },
              values: [
                [1734567600000, 67],
              ],
            },
          ],
        },
      ],
    };

    fetchMock.mockReturnValue(of({ data: mockResponse, status: 200, statusText: 'OK' }));

    const query: KairosDBQuery = {
      refId: 'A',
      query: {
        metricName: 'cpu.usage',
        alias: '$_tag_group_host CPU',
        tags: {
          datacenter: ['us-east'],
        },
        groupBy: {
          tags: ['host'],
        },
        aggregators: [],
      },
    };

    const result = await datasource.query({
      targets: [query],
      requestId: '1',
      interval: '1m',
      intervalMs: 60000,
      range: {
        from: new Date(1734567600000),
        to: new Date(1734567720000),
      },
      scopedVars: {},
    } as any);

    // Should have two series with correct host names from group_by.group
    expect(result.data).toHaveLength(2);
    expect(result.data[0].name).toBe('server1 CPU');
    expect(result.data[1].name).toBe('server2 CPU');
  });
});
