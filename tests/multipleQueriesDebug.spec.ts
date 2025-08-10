/**
 * Debug test to understand how multiple queries with same metric but different aggregators work
 */

import { DataSource } from '../src/datasource';
import { ScopedVars } from '@grafana/data';

describe('Multiple Queries Debug', () => {
  let datasource: DataSource;

  beforeEach(() => {
    datasource = new DataSource({
      id: 1,
      uid: 'test-uid',
      type: 'arpnetworking-kairosdb-datasource',
      name: 'Test KairosDB',
      url: 'http://localhost:8080',
      access: 'proxy',
      jsonData: {},
    });
  });

  test('should understand what happens when we have multiple targets with same metric', () => {
    // This simulates the user's scenario exactly

    const scopedVars: ScopedVars = {};

    const targets = [
      // Target A: avg aggregator
      {
        refId: 'A',
        query: {
          metricName: 'cpu.usage',
          alias: '$_tag_group_host avg',
          tags: {},
          groupBy: { tags: ['host'], time: [], value: [] },
          aggregators: [{ name: 'avg', parameters: [] }],
        },
      },
      // Target B: max aggregator
      {
        refId: 'B',
        query: {
          metricName: 'cpu.usage',
          alias: '$_tag_group_host max',
          tags: {},
          groupBy: { tags: ['host'], time: [], value: [] },
          aggregators: [{ name: 'max', parameters: [] }],
        },
      },
    ];

    // Test metric expansion (this should work fine since no multi-value variables)
    targets.forEach((target) => {
      const expansion = (datasource as any).expandMetricNames(target.query.metricName, target.refId, scopedVars);
      expect(expansion.names).toEqual(['cpu.usage']);
    });

    // Test building the composite keys
    const metricNameToTargetMap: { [compositeKey: string]: any } = {};
    const metricOrderToRefId: { [metricName: string]: string[] } = {};

    targets.forEach((target) => {
      const expansion = (datasource as any).expandMetricNames(target.query.metricName, target.refId, scopedVars);

      expansion.names.forEach((metricName: string, index: number) => {
        const compositeKey = `${metricName}|${target.refId}`;
        metricNameToTargetMap[compositeKey] = {
          target: target,
          variableValues: expansion.variableValues[index],
        };

        if (!metricOrderToRefId[metricName]) {
          metricOrderToRefId[metricName] = [];
        }
        metricOrderToRefId[metricName].push(target.refId);
      });
    });

    expect(metricOrderToRefId['cpu.usage']).toEqual(['A', 'B']);

    // Test what KairosDB response would look like

    // Case 1: If KairosDB returns results in same order as metrics were sent
    const simulatedResponse = {
      queries: [
        {
          results: [
            // Results for first metric (avg aggregator)
            { name: 'cpu.usage', tags: { host: ['server1'] }, values: [[1640995200000, 75.0]] },
            { name: 'cpu.usage', tags: { host: ['server2'] }, values: [[1640995200000, 80.0]] },

            // Results for second metric (max aggregator)
            { name: 'cpu.usage', tags: { host: ['server1'] }, values: [[1640995200000, 95.0]] },
            { name: 'cpu.usage', tags: { host: ['server2'] }, values: [[1640995200000, 98.0]] },
          ],
        },
      ],
    };

    // Verify simulated results structure
    expect(simulatedResponse.queries[0].results).toHaveLength(4);

    // Test the mapping logic
    const metricResultCount: { [metricName: string]: number } = {};

    simulatedResponse.queries[0].results.forEach((result, resultIndex) => {
      const metricName = result.name;

      if (!metricResultCount[metricName]) {
        metricResultCount[metricName] = 0;
      }

      const refIdOrder = metricOrderToRefId[metricName];
      const totalResultsForMetric = simulatedResponse.queries[0].results.filter((r) => r.name === metricName).length;
      const resultsPerTarget = Math.ceil(totalResultsForMetric / refIdOrder.length);
      const refIdIndex = Math.floor(metricResultCount[metricName] / resultsPerTarget);
      const refId = refIdOrder[refIdIndex] || refIdOrder[refIdOrder.length - 1];
      const compositeKey = `${metricName}|${refId}`;

      const mappingInfo = metricNameToTargetMap[compositeKey];

      // Verify mapping exists and is correct
      expect(mappingInfo).toBeDefined();
      if (mappingInfo) {
        expect(['$_tag_group_host avg', '$_tag_group_host max']).toContain(mappingInfo.target.query.alias);
      }

      metricResultCount[metricName]++;
    });
  });
});
