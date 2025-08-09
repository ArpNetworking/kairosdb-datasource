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
      jsonData: {}
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
          aggregators: [{ name: 'avg', parameters: [] }]
        }
      },
      // Target B: max aggregator
      {
        refId: 'B', 
        query: {
          metricName: 'cpu.usage',
          alias: '$_tag_group_host max',
          tags: {},
          groupBy: { tags: ['host'], time: [], value: [] },
          aggregators: [{ name: 'max', parameters: [] }]
        }
      }
    ];
    
    console.log('=== TARGET CONFIGURATION ===');
    targets.forEach(target => {
      console.log(`Target ${target.refId}:`);
      console.log(`  Metric: ${target.query.metricName}`);
      console.log(`  Alias: ${target.query.alias}`);
      console.log(`  Aggregators: ${target.query.aggregators.map(a => a.name).join(', ')}`);
      console.log(`  GroupBy: ${target.query.groupBy.tags.join(', ')}`);
    });
    
    // Step 1: Test metric expansion (this should work fine since no multi-value variables)
    console.log('\n=== METRIC EXPANSION ===');
    targets.forEach(target => {
      const expansion = (datasource as any).expandMetricNames(target.query.metricName, target.refId, scopedVars);
      console.log(`Target ${target.refId} expansion:`, expansion.names);
    });
    
    // Step 2: Simulate building the composite keys
    console.log('\n=== COMPOSITE KEY MAPPING ===');
    const metricNameToTargetMap: { [compositeKey: string]: any } = {};
    const metricOrderToRefId: { [metricName: string]: string[] } = {};
    
    targets.forEach(target => {
      const expansion = (datasource as any).expandMetricNames(target.query.metricName, target.refId, scopedVars);
      
      expansion.names.forEach((metricName: string, index: number) => {
        const compositeKey = `${metricName}|${target.refId}`;
        metricNameToTargetMap[compositeKey] = {
          target: target,
          variableValues: expansion.variableValues[index]
        };
        
        if (!metricOrderToRefId[metricName]) {
          metricOrderToRefId[metricName] = [];
        }
        metricOrderToRefId[metricName].push(target.refId);
        
        console.log(`Created mapping: ${compositeKey} -> alias: "${target.query.alias}"`);
      });
    });
    
    console.log('\nmetricOrderToRefId:', metricOrderToRefId);
    
    // Step 3: Simulate what KairosDB response would look like
    // The key question: do avg and max aggregators make the results distinguishable?
    console.log('\n=== SIMULATED KAIROS RESPONSE ===');
    
    // Case 1: If KairosDB returns results in same order as metrics were sent
    const simulatedResponse = {
      queries: [{
        results: [
          // Results for first metric (avg aggregator)
          { name: 'cpu.usage', tags: { host: ['server1'] }, values: [[1640995200000, 75.0]] },
          { name: 'cpu.usage', tags: { host: ['server2'] }, values: [[1640995200000, 80.0]] },
          
          // Results for second metric (max aggregator) 
          { name: 'cpu.usage', tags: { host: ['server1'] }, values: [[1640995200000, 95.0]] },
          { name: 'cpu.usage', tags: { host: ['server2'] }, values: [[1640995200000, 98.0]] }
        ]
      }]
    };
    
    console.log('Simulated results:');
    simulatedResponse.queries[0].results.forEach((result, index) => {
      console.log(`  Result ${index}: ${result.name}, host=${result.tags.host[0]}, value=${result.values[0][1]}`);
    });
    
    // Step 4: Test the mapping logic
    console.log('\n=== MAPPING RESULTS ===');
    const metricResultCount: { [metricName: string]: number } = {};
    
    simulatedResponse.queries[0].results.forEach((result, resultIndex) => {
      const metricName = result.name;
      
      if (!metricResultCount[metricName]) {
        metricResultCount[metricName] = 0;
      }
      
      const refIdOrder = metricOrderToRefId[metricName];
      const totalResultsForMetric = simulatedResponse.queries[0].results.filter(r => r.name === metricName).length;
      const resultsPerTarget = Math.ceil(totalResultsForMetric / refIdOrder.length);
      const refIdIndex = Math.floor(metricResultCount[metricName] / resultsPerTarget);
      const refId = refIdOrder[refIdIndex] || refIdOrder[refIdOrder.length - 1];
      const compositeKey = `${metricName}|${refId}`;
      
      const mappingInfo = metricNameToTargetMap[compositeKey];
      
      console.log(`Result ${resultIndex}:`);
      console.log(`  Metric: ${metricName}, Host: ${result.tags.host[0]}`);
      console.log(`  Calculated refId: ${refId} (refIdIndex: ${refIdIndex})`);
      console.log(`  Composite key: ${compositeKey}`);
      console.log(`  Found mapping: ${!!mappingInfo}`);
      if (mappingInfo) {
        console.log(`  Target alias: "${mappingInfo.target.query.alias}"`);
      }
      
      metricResultCount[metricName]++;
    });
  });
});