/**
 * Test to reproduce the issue with multiple queries for the same metric
 * 
 * Problem: When multiple targets query the same metric with different aggregators,
 * the name-based mapping overwrites entries, causing alias confusion.
 * 
 * Example: 
 * - Query A: cpu.usage with avg aggregator and alias "$_tag_group_host avg"
 * - Query B: cpu.usage with max aggregator and alias "$_tag_group_host max"
 * 
 * Both create entries for "cpu.usage" in metricNameToTargetMap, but the second
 * overwrites the first, so all results get the "max" alias instead of their correct ones.
 */

describe('Multiple Queries Same Metric Issue', () => {

  test('should demonstrate the mapping collision issue', () => {
    // This simulates what happens in the current code
    
    // Step 1: First target creates mapping entry
    const metricNameToTargetMap: { [metricName: string]: any } = {};
    
    // Query A: cpu.usage with avg aggregator
    const targetA = {
      refId: 'A',
      query: {
        metricName: 'cpu.usage',
        alias: '$_tag_group_host avg',
        aggregators: [{ name: 'avg' }],
        groupBy: { tags: ['host'] }
      }
    };
    
    metricNameToTargetMap['cpu.usage'] = {
      target: targetA,
      variableValues: {}
    };
    
    console.log('After Query A mapping:');
    console.log('  cpu.usage ->', metricNameToTargetMap['cpu.usage'].target.query.alias);
    
    // Step 2: Second target OVERWRITES the mapping
    const targetB = {
      refId: 'B', 
      query: {
        metricName: 'cpu.usage',
        alias: '$_tag_group_host max',
        aggregators: [{ name: 'max' }],
        groupBy: { tags: ['host'] }
      }
    };
    
    metricNameToTargetMap['cpu.usage'] = {
      target: targetB,
      variableValues: {}
    };
    
    console.log('After Query B mapping (OVERWROTE Query A):');
    console.log('  cpu.usage ->', metricNameToTargetMap['cpu.usage'].target.query.alias);
    
    // Step 3: Simulate response processing
    const responseResults = [
      // Results from Query A (avg aggregator)
      { name: 'cpu.usage', tags: { host: ['server1'] }, refId: 'A' },
      { name: 'cpu.usage', tags: { host: ['server2'] }, refId: 'A' },
      
      // Results from Query B (max aggregator)  
      { name: 'cpu.usage', tags: { host: ['server1'] }, refId: 'B' },
      { name: 'cpu.usage', tags: { host: ['server2'] }, refId: 'B' }
    ];
    
    // All results will get the same mapping (Query B's alias)
    const processedResults = responseResults.map(result => {
      const mapping = metricNameToTargetMap[result.name];
      return {
        resultRefId: result.refId,
        resultHost: result.tags.host[0],
        aliasFromMapping: mapping.target.query.alias,
        expectedAlias: result.refId === 'A' ? '$_tag_group_host avg' : '$_tag_group_host max'
      };
    });
    
    console.log('Processed results (showing the problem):');
    processedResults.forEach((item, index) => {
      const isCorrect = item.aliasFromMapping === item.expectedAlias;
      const status = isCorrect ? '✓' : '✗';
      console.log(`  ${status} Result ${index}: refId=${item.resultRefId}, host=${item.resultHost}`);
      console.log(`      Got alias: "${item.aliasFromMapping}"`); 
      console.log(`      Expected:  "${item.expectedAlias}"`);
    });
    
    // Show that all results got the wrong alias (Query B's alias)
    const wrongAliases = processedResults.filter(item => 
      item.resultRefId === 'A' && item.aliasFromMapping !== item.expectedAlias
    );
    
    expect(wrongAliases.length).toBe(2); // Both Query A results have wrong alias
    expect(processedResults[0].aliasFromMapping).toBe('$_tag_group_host max'); // Should be "avg"
    expect(processedResults[1].aliasFromMapping).toBe('$_tag_group_host max'); // Should be "avg"
  });

  test('should demonstrate the correct solution approach', () => {
    // The fix: Include refId in the mapping key to avoid collisions
    
    const metricNameToTargetMap: { [key: string]: any } = {};
    
    // Query A: Use composite key
    const targetA = {
      refId: 'A',
      query: {
        metricName: 'cpu.usage',
        alias: '$_tag_group_host avg',
        aggregators: [{ name: 'avg' }],
        groupBy: { tags: ['host'] }
      }
    };
    
    const keyA = `${targetA.query.metricName}|${targetA.refId}`;
    metricNameToTargetMap[keyA] = {
      target: targetA,
      variableValues: {}
    };
    
    // Query B: Use composite key  
    const targetB = {
      refId: 'B',
      query: {
        metricName: 'cpu.usage', 
        alias: '$_tag_group_host max',
        aggregators: [{ name: 'max' }],
        groupBy: { tags: ['host'] }
      }
    };
    
    const keyB = `${targetB.query.metricName}|${targetB.refId}`;
    metricNameToTargetMap[keyB] = {
      target: targetB,
      variableValues: {}
    };
    
    console.log('With composite keys (no collision):');
    console.log(`  ${keyA} -> ${metricNameToTargetMap[keyA].target.query.alias}`);
    console.log(`  ${keyB} -> ${metricNameToTargetMap[keyB].target.query.alias}`);
    
    // Simulate response processing with composite keys
    const responseResults = [
      { name: 'cpu.usage', tags: { host: ['server1'] }, refId: 'A' },
      { name: 'cpu.usage', tags: { host: ['server2'] }, refId: 'A' },
      { name: 'cpu.usage', tags: { host: ['server1'] }, refId: 'B' },
      { name: 'cpu.usage', tags: { host: ['server2'] }, refId: 'B' }
    ];
    
    const processedResults = responseResults.map(result => {
      const compositeKey = `${result.name}|${result.refId}`;
      const mapping = metricNameToTargetMap[compositeKey];
      return {
        resultRefId: result.refId,
        resultHost: result.tags.host[0],
        aliasFromMapping: mapping?.target.query.alias || 'NOT FOUND',
        compositeKey
      };
    });
    
    console.log('With composite key solution:');
    processedResults.forEach((item, index) => {
      console.log(`  ✓ Result ${index}: refId=${item.resultRefId}, host=${item.resultHost}`);
      console.log(`      Key: ${item.compositeKey}`);
      console.log(`      Alias: "${item.aliasFromMapping}"`);
    });
    
    // Verify all mappings are found and correct
    expect(processedResults.every(item => item.aliasFromMapping !== 'NOT FOUND')).toBe(true);
    expect(processedResults[0].aliasFromMapping).toBe('$_tag_group_host avg');
    expect(processedResults[1].aliasFromMapping).toBe('$_tag_group_host avg');
    expect(processedResults[2].aliasFromMapping).toBe('$_tag_group_host max');
    expect(processedResults[3].aliasFromMapping).toBe('$_tag_group_host max');
  });
});