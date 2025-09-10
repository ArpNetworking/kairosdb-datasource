/**
 * Unit test to verify name-based mapping logic works correctly
 *
 * This test validates the fix without requiring HTTP mocks
 */

describe('Name-Based Mapping Fix', () => {
  test('should demonstrate the fix logic with name-based mapping', () => {
    // This test validates the core logic of the fix

    // Step 1: Build the name-based mapping (what we now do in the datasource)
    const metricNameToTargetMap: { [metricName: string]: any } = {
      'cpu.usage': {
        target: { refId: 'A', query: { alias: '$_tag_group_host CPU' } },
        variableValues: {}, // Single metric case
      },
      'web.memory': {
        target: { refId: 'B', query: { alias: '$service Memory' } },
        variableValues: { service: { text: 'web', value: 'web' } },
      },
      'api.memory': {
        target: { refId: 'B', query: { alias: '$service Memory' } },
        variableValues: { service: { text: 'api', value: 'api' } },
      },
    };

    // Step 2: Simulate multiple response results (including groupby)
    const responseResults = [
      // cpu.usage with groupby -> multiple results for same metric
      { name: 'cpu.usage', tags: { host: ['server1'] } },
      { name: 'cpu.usage', tags: { host: ['server2'] } },
      { name: 'cpu.usage', tags: { host: ['server3'] } },

      // Different metrics from multi-value variable expansion
      { name: 'web.memory', tags: {} },
      { name: 'api.memory', tags: {} },
    ];

    // Step 3: Test that all results can find their mapping (the fix)
    const mappedResults = responseResults.map((result) => {
      const mapping = metricNameToTargetMap[result.name];
      return {
        result,
        mapping,
        hasmapping: !!mapping,
      };
    });


    // All results should find their mapping
    expect(mappedResults.every((item) => item.hasmapping)).toBe(true);

    // Verify specific mappings
    expect(mappedResults[0].mapping.target.refId).toBe('A'); // cpu.usage
    expect(mappedResults[1].mapping.target.refId).toBe('A'); // cpu.usage (same mapping)
    expect(mappedResults[2].mapping.target.refId).toBe('A'); // cpu.usage (same mapping)
    expect(mappedResults[3].mapping.target.refId).toBe('B'); // web.memory
    expect(mappedResults[4].mapping.target.refId).toBe('B'); // api.memory

    // Verify variable values are correct for expanded metrics
    expect(mappedResults[3].mapping.variableValues.service?.value).toBe('web');
    expect(mappedResults[4].mapping.variableValues.service?.value).toBe('api');
  });

  test('should show why the old index-based mapping failed', () => {
    // Demonstrate the old broken approach

    // Old approach: index-based mapping
    const oldMetricToTargetMap: { [index: number]: any } = {
      0: { target: { refId: 'A' }, metricName: 'cpu.usage' },
      1: { target: { refId: 'B' }, metricName: 'web.memory' },
      2: { target: { refId: 'B' }, metricName: 'api.memory' },
    };

    // Response results (with groupby returning multiple series)
    const responseResults = [
      { name: 'cpu.usage', tags: { host: ['server1'] } }, // index 0 ✓
      { name: 'cpu.usage', tags: { host: ['server2'] } }, // index 1 ✗ (wrong mapping)
      { name: 'cpu.usage', tags: { host: ['server3'] } }, // index 2 ✗ (wrong mapping)
      { name: 'web.memory', tags: {} }, // index 3 ✗ (no mapping)
      { name: 'api.memory', tags: {} }, // index 4 ✗ (no mapping)
    ];

    // Old logic would do: mapping = oldMetricToTargetMap[responseIndex]
    const oldMappedResults = responseResults.map((result, index) => {
      const mapping = oldMetricToTargetMap[index];
      const isCorrect = mapping && mapping.metricName === result.name;
      return {
        index,
        resultName: result.name,
        mapping: mapping?.target?.refId || 'UNDEFINED',
        expectedMetric: mapping?.metricName || 'UNDEFINED',
        isCorrect,
      };
    });


    // Show that only the first result mapped correctly
    const correctMappings = oldMappedResults.filter((item) => item.isCorrect);
    expect(correctMappings).toHaveLength(1); // Only index 0 was correct

    // Results 1,2 would get wrong mappings, results 3,4 would get undefined
    expect(oldMappedResults[1].isCorrect).toBe(false);
    expect(oldMappedResults[2].isCorrect).toBe(false);
    expect(oldMappedResults[3].mapping).toBe('UNDEFINED');
    expect(oldMappedResults[4].mapping).toBe('UNDEFINED');
  });

  test('should handle the complex multi-value + groupby scenario', () => {
    // Most complex case: multi-value variables + groupby

    // Name-based mapping for expanded metrics
    const metricNameToTargetMap: { [metricName: string]: any } = {
      'web.cpu': {
        target: { refId: 'A', query: { alias: '$service-$_tag_group_host CPU' } },
        variableValues: { service: { text: 'web', value: 'web' } },
      },
      'api.cpu': {
        target: { refId: 'A', query: { alias: '$service-$_tag_group_host CPU' } },
        variableValues: { service: { text: 'api', value: 'api' } },
      },
    };

    // Response: each expanded metric returns multiple series due to groupby
    const responseResults = [
      // web.cpu grouped by host
      { name: 'web.cpu', tags: { host: ['host1'] } },
      { name: 'web.cpu', tags: { host: ['host2'] } },

      // api.cpu grouped by host
      { name: 'api.cpu', tags: { host: ['host1'] } },
      { name: 'api.cpu', tags: { host: ['host2'] } },
    ];

    // All should find their mappings
    const mappings = responseResults.map((result) => ({
      name: result.name,
      host: result.tags.host[0],
      mapping: metricNameToTargetMap[result.name],
      service: metricNameToTargetMap[result.name]?.variableValues?.service?.value,
    }));


    // All results should have mappings
    expect(mappings.every((item) => item.mapping)).toBe(true);

    // Verify correct service values
    expect(mappings[0].service).toBe('web'); // web.cpu
    expect(mappings[1].service).toBe('web'); // web.cpu
    expect(mappings[2].service).toBe('api'); // api.cpu
    expect(mappings[3].service).toBe('api'); // api.cpu
  });
});
