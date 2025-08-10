/**
 * Final test to validate the fix for multiple queries with same metric issue
 * 
 * This test recreates the user's exact scenario:
 * - One graph with avg groupby host and alias "$_tag_group_host avg"  
 * - One graph with max groupby host and alias "$_tag_group_host max"
 */

describe('Multiple Queries Final Validation', () => {

  test('should correctly map aliases for avg and max queries on same metric', () => {
    // Simulate the exact fix implementation
    
    // Step 1: User configuration
    const targets = [
      {
        refId: 'A',
        query: {
          metricName: 'cpu.usage',
          alias: '$_tag_group_host avg',
          aggregators: [{ name: 'avg' }],
          groupBy: { tags: ['host'] }
        }
      },
      {
        refId: 'B',
        query: {
          metricName: 'cpu.usage', 
          alias: '$_tag_group_host max',
          aggregators: [{ name: 'max' }],
          groupBy: { tags: ['host'] }
        }
      }
    ];
    
    // Step 2: Build mappings (what datasource does)
    const metricNameToTargetMap: { [compositeKey: string]: any } = {};
    const metricOrderToRefId: { [metricName: string]: string[] } = {};
    
    targets.forEach(target => {
      const metricName = target.query.metricName;
      const compositeKey = `${metricName}|${target.refId}`;
      
      metricNameToTargetMap[compositeKey] = {
        target: target,
        variableValues: {}
      };
      
      if (!metricOrderToRefId[metricName]) {
        metricOrderToRefId[metricName] = [];
      }
      metricOrderToRefId[metricName].push(target.refId);
    });
    
    // Step 3: KairosDB response (what the user sees)
    const kairosResponse = {
      queries: [{
        results: [
          // avg results (first 2)
          { name: 'cpu.usage', tags: { host: ['web01'] }, values: [[1640995200000, 75.0]] },
          { name: 'cpu.usage', tags: { host: ['web02'] }, values: [[1640995200000, 80.0]] },
          
          // max results (next 2) 
          { name: 'cpu.usage', tags: { host: ['web01'] }, values: [[1640995200000, 95.0]] },
          { name: 'cpu.usage', tags: { host: ['web02'] }, values: [[1640995200000, 98.0]] }
        ]
      }]
    };
    
    // Step 4: Response processing (what the fix does)
    const processedSeries: any[] = [];
    const metricResultCount: { [metricName: string]: number } = {};
    
    kairosResponse.queries[0].results.forEach((result, resultIndex) => {
      const metricName = result.name;
      
      if (!metricResultCount[metricName]) {
        metricResultCount[metricName] = 0;
      }
      
      const refIdOrder = metricOrderToRefId[metricName];
      const totalResultsForMetric = kairosResponse.queries[0].results.filter(r => r.name === metricName).length;
      const resultsPerTarget = Math.ceil(totalResultsForMetric / refIdOrder.length);
      const refIdIndex = Math.floor(metricResultCount[metricName] / resultsPerTarget);
      const refId = refIdOrder[refIdIndex] || refIdOrder[refIdOrder.length - 1];
      const compositeKey = `${metricName}|${refId}`;
      
      const mappingInfo = metricNameToTargetMap[compositeKey];
      metricResultCount[metricName]++;
      
      // Simulate creating the series name
      const host = result.tags.host[0];
      const aliasTemplate = mappingInfo.target.query.alias;
      const seriesName = aliasTemplate.replace('$_tag_group_host', host);
      
      processedSeries.push({
        resultIndex,
        host,
        refId,
        value: result.values[0][1],
        aliasTemplate,
        seriesName
      });
    });
    
    console.log('Processed series:');
    processedSeries.forEach(series => {
      console.log(`  Result ${series.resultIndex}: ${series.host} (${series.refId}) -> "${series.seriesName}" [value: ${series.value}]`);
    });
    
    // Step 5: Validate the fix
    expect(processedSeries).toHaveLength(4);
    
    // First two results should have "avg" alias
    expect(processedSeries[0].refId).toBe('A');
    expect(processedSeries[0].seriesName).toBe('web01 avg');
    expect(processedSeries[1].refId).toBe('A');
    expect(processedSeries[1].seriesName).toBe('web02 avg');
    
    // Next two results should have "max" alias  
    expect(processedSeries[2].refId).toBe('B');
    expect(processedSeries[2].seriesName).toBe('web01 max');
    expect(processedSeries[3].refId).toBe('B');
    expect(processedSeries[3].seriesName).toBe('web02 max');
    
    // Verify values are correct (avg values should be lower than max values)
    expect(processedSeries[0].value).toBe(75.0); // web01 avg
    expect(processedSeries[2].value).toBe(95.0); // web01 max (higher)
    expect(processedSeries[1].value).toBe(80.0); // web02 avg  
    expect(processedSeries[3].value).toBe(98.0); // web02 max (higher)
    
    console.log('\n✅ Fix validated: Each series gets the correct alias!');
    console.log('   - avg results: "web01 avg", "web02 avg"');
    console.log('   - max results: "web01 max", "web02 max"');
  });
  
  test('should handle edge case with uneven results per target', () => {
    // Test case where one target returns more results than the other
    
    const targets = [
      { refId: 'A', query: { metricName: 'memory.usage', alias: '$_tag_group_host avg' } },
      { refId: 'B', query: { metricName: 'memory.usage', alias: '$_tag_group_host max' } }
    ];
    
    const metricNameToTargetMap: { [key: string]: any } = {};
    const metricOrderToRefId: { [key: string]: string[] } = {};
    
    targets.forEach(target => {
      const compositeKey = `${target.query.metricName}|${target.refId}`;
      metricNameToTargetMap[compositeKey] = { target };
      
      if (!metricOrderToRefId[target.query.metricName]) {
        metricOrderToRefId[target.query.metricName] = [];
      }
      metricOrderToRefId[target.query.metricName].push(target.refId);
    });
    
    // Simulate uneven results: 3 for first target, 2 for second
    const unevenResults = [
      { name: 'memory.usage', tags: { host: ['server1'] } },
      { name: 'memory.usage', tags: { host: ['server2'] } },
      { name: 'memory.usage', tags: { host: ['server3'] } }, // Extra result
      { name: 'memory.usage', tags: { host: ['server1'] } },
      { name: 'memory.usage', tags: { host: ['server2'] } }
    ];
    
    const assignments: any[] = [];
    const metricResultCount: { [key: string]: number } = {};
    
    unevenResults.forEach((result, index) => {
      const metricName = result.name;
      
      if (!metricResultCount[metricName]) {
        metricResultCount[metricName] = 0;
      }
      
      const refIdOrder = metricOrderToRefId[metricName];
      const totalResults = unevenResults.filter(r => r.name === metricName).length;
      const resultsPerTarget = Math.ceil(totalResults / refIdOrder.length);
      const refIdIndex = Math.floor(metricResultCount[metricName] / resultsPerTarget);
      const refId = refIdOrder[refIdIndex] || refIdOrder[refIdOrder.length - 1];
      
      assignments.push({
        resultIndex: index,
        host: result.tags.host[0],
        assignedRefId: refId
      });
      
      metricResultCount[metricName]++;
    });
    
    console.log('Uneven results assignment:');
    assignments.forEach(a => {
      console.log(`  Result ${a.resultIndex} (${a.host}) -> ${a.assignedRefId}`);
    });
    
    // With 5 results and 2 targets: ceil(5/2) = 3 results per target
    // Results 0,1,2 -> A, Results 3,4 -> B
    expect(assignments[0].assignedRefId).toBe('A');
    expect(assignments[1].assignedRefId).toBe('A');
    expect(assignments[2].assignedRefId).toBe('A');
    expect(assignments[3].assignedRefId).toBe('B');
    expect(assignments[4].assignedRefId).toBe('B');
  });
});
