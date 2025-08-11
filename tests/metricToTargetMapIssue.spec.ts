/**
 * Test to identify the root cause of the multiple time series issue
 *
 * The issue is that metricToTargetMap assumes a 1:1 correspondence between
 * expanded metrics and response results, but groupby queries break this assumption.
 */

import { DataSource } from '../src/datasource';
import { ScopedVars } from '@grafana/data';

describe('MetricToTargetMap Issue Analysis', () => {
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

  test('should show the mapping issue with single metric + groupby', () => {
    // The problem: We send 1 metric but get multiple results due to groupby

    // This is what we build in the request phase
    const requestMetrics = ['cpu.usage']; // 1 metric sent to KairosDB

    // This is what KairosDB returns for a groupby query
    const responseResults = [
      { name: 'cpu.usage', tags: { host: ['server1'] } },
      { name: 'cpu.usage', tags: { host: ['server2'] } },
      { name: 'cpu.usage', tags: { host: ['server3'] } },
    ];

    // Current metricToTargetMap logic assumes:
    // metricToTargetMap[0] maps to responseResults[0]
    // metricToTargetMap[1] maps to responseResults[1]
    // metricToTargetMap[2] maps to responseResults[2]

    // But we only have metricToTargetMap[0] because we only sent 1 metric!
    // So responseResults[1] and responseResults[2] have no mapping and get skipped.

    console.log('Request metrics count:', requestMetrics.length);
    console.log('Response results count:', responseResults.length);
    console.log(
      'Problem: We have',
      responseResults.length,
      'results but only',
      requestMetrics.length,
      'mapping entries'
    );

    expect(requestMetrics.length).toBe(1);
    expect(responseResults.length).toBe(3);
    // This mismatch is the root cause of the issue
  });

  test('should show how expansion affects the mapping', () => {
    // Let's trace through what happens with multi-value variables + groupby

    const scopedVars: ScopedVars = {
      service: { text: 'web,api', value: ['web', 'api'] },
    };

    // Step 1: expandMetricNames creates multiple metrics
    const expansion = (datasource as any).expandMetricNames('$service.cpu', 'A', scopedVars);
    console.log('Expanded metrics:', expansion.names);

    // Step 2: We send these metrics to KairosDB
    const requestMetrics = expansion.names; // ['web.cpu', 'api.cpu']

    // Step 3: With groupby, each metric can return multiple results
    const responseResults = [
      // web.cpu results (grouped by host)
      { name: 'web.cpu', tags: { host: ['web01'] } },
      { name: 'web.cpu', tags: { host: ['web02'] } },

      // api.cpu results (grouped by host)
      { name: 'api.cpu', tags: { host: ['api01'] } },
      { name: 'api.cpu', tags: { host: ['api02'] } },
    ];

    // Step 4: Current metricToTargetMap has 2 entries (one per expanded metric)
    // But we have 4 response results!
    // metricToTargetMap[0] -> web.cpu expansion info
    // metricToTargetMap[1] -> api.cpu expansion info
    // metricToTargetMap[2] -> undefined (doesn't exist!)
    // metricToTargetMap[3] -> undefined (doesn't exist!)

    console.log('Expanded metrics count:', requestMetrics.length);
    console.log('Response results count:', responseResults.length);
    console.log('MetricToTargetMap entries:', requestMetrics.length);
    console.log('Missing mappings for results 2 and 3');

    expect(requestMetrics.length).toBe(2);
    expect(responseResults.length).toBe(4);
    // Only first 2 results will be processed, the rest will be skipped
  });

  test('should demonstrate the correct mapping approach', () => {
    // The fix: We need to map by metric name, not by index

    const responseResults = [
      { name: 'web.cpu', tags: { host: ['web01'] } },
      { name: 'web.cpu', tags: { host: ['web02'] } },
      { name: 'api.cpu', tags: { host: ['api01'] } },
      { name: 'api.cpu', tags: { host: ['api02'] } },
    ];

    // Instead of index-based mapping: metricToTargetMap[responseIndex]
    // We should use name-based mapping: metricNameToTargetMap[result.name]

    const metricNameToTargetMap = {
      'web.cpu': {
        target: {
          /* web target info */
        },
        variableValues: { service: { text: 'web', value: 'web' } },
      },
      'api.cpu': {
        target: {
          /* api target info */
        },
        variableValues: { service: { text: 'api', value: 'api' } },
      },
    };

    // Now all results can find their mapping:
    responseResults.forEach((result) => {
      const mapping = metricNameToTargetMap[result.name];
      expect(mapping).toBeDefined();
      console.log(`Result ${result.name} with host ${result.tags.host[0]} maps to:`, mapping?.variableValues);
    });
  });
});
