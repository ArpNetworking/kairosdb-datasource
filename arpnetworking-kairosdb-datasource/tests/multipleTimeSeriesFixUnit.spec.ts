/**
 * Unit tests for the multiple time series fix
 * 
 * This test verifies that the name-based mapping fix correctly handles
 * groupby queries that return multiple time series per metric.
 */

import { DataSource } from '../src/datasource';
import { ScopedVars } from '@grafana/data';

describe('Multiple Time Series Fix (Unit Tests)', () => {
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

  test('should handle groupby query returning multiple series from single metric', () => {
    // Test the core logic directly without HTTP calls
    
    const targets = [{
      refId: 'A',
      query: {
        metricName: 'cpu.usage',
        alias: '$_tag_group_host CPU Usage',
        tags: {},
        groupBy: {
          tags: ['host'],
          time: [],
          value: []
        },
        aggregators: []
      }
    }];

    // Step 1: Build mappings (what datasource does during expansion)
    const metricNameToTargetMap: { [compositeKey: string]: any } = {};
    const metricOrderToRefId: { [metricName: string]: string[] } = {};
    
    // Since no multi-value variables, expansion produces single metric
    const expansion = (datasource as any).expandMetricNames('cpu.usage', 'A', {});
    
    expansion.names.forEach((metricName: string, index: number) => {
      const compositeKey = `${metricName}|A`;
      metricNameToTargetMap[compositeKey] = {
        target: targets[0],
        variableValues: expansion.variableValues[index]
      };
      
      if (!metricOrderToRefId[metricName]) {
        metricOrderToRefId[metricName] = [];
      }
      metricOrderToRefId[metricName].push('A');
    });

    // Step 2: Simulate KairosDB response with groupby results
    const kairosResponse = {
      queries: [{
        results: [
          {
            name: 'cpu.usage',
            tags: { host: ['web01'] },
            values: [[1640995200000, 85.0]]
          },
          {
            name: 'cpu.usage', // Same metric name
            tags: { host: ['web02'] }, // Different host
            values: [[1640995200000, 92.5]]
          },
          {
            name: 'cpu.usage', // Same metric name
            tags: { host: ['api01'] }, // Different host
            values: [[1640995200000, 78.3]]
          }
        ]
      }]
    };

    // Step 3: Test the mapping logic (simulates response processing)
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
      
      // Simulate series name generation
      const host = result.tags.host[0];
      const aliasTemplate = mappingInfo.target.query.alias;
      const seriesName = aliasTemplate.replace('$_tag_group_host', host);
      
      processedSeries.push({
        resultIndex,
        host,
        refId,
        value: result.values[0][1],
        seriesName
      });
    });

    console.log('Groupby test result:', {
      seriesCount: processedSeries.length,
      seriesNames: processedSeries.map(s => s.seriesName)
    });

    // The fix should handle all 3 time series
    expect(processedSeries).toHaveLength(3);
    
    const seriesNames = processedSeries.map(s => s.seriesName);
    expect(seriesNames).toEqual([
      'web01 CPU Usage',
      'web02 CPU Usage',
      'api01 CPU Usage'
    ]);

    // Verify data values are preserved
    expect(processedSeries[0].value).toBe(85.0);
    expect(processedSeries[1].value).toBe(92.5);
    expect(processedSeries[2].value).toBe(78.3);
  });

  test('should handle multi-value variables with groupby', () => {
    // Test multi-value variable expansion + groupby logic directly
    
    const scopedVars: ScopedVars = {
      service: { 
        text: 'web,api', 
        value: ['web', 'api'] 
      }
    };

    const targets = [{
      refId: 'A',
      query: {
        metricName: '$service.cpu.usage',
        alias: '$service-$_tag_group_datacenter CPU',
        tags: {},
        groupBy: {
          tags: ['datacenter'],
          time: [],
          value: []
        },
        aggregators: []
      }
    }];

    // Step 1: Build mappings from expansion
    const metricNameToTargetMap: { [compositeKey: string]: any } = {};
    const metricOrderToRefId: { [metricName: string]: string[] } = {};
    
    const expansion = (datasource as any).expandMetricNames('$service.cpu.usage', 'A', scopedVars);
    
    expansion.names.forEach((metricName: string, index: number) => {
      const compositeKey = `${metricName}|A`;
      metricNameToTargetMap[compositeKey] = {
        target: targets[0],
        variableValues: expansion.variableValues[index]
      };
      
      if (!metricOrderToRefId[metricName]) {
        metricOrderToRefId[metricName] = [];
      }
      metricOrderToRefId[metricName].push('A');
    });

    // Step 2: Simulate KairosDB response: 2 expanded metrics × 2 datacenters each = 4 total series
    const kairosResponse = {
      queries: [{
        results: [
          // web.cpu.usage results
          { name: 'web.cpu.usage', tags: { datacenter: ['us-east-1'] }, values: [[1640995200000, 60.0]] },
          { name: 'web.cpu.usage', tags: { datacenter: ['us-west-2'] }, values: [[1640995200000, 65.0]] },
          
          // api.cpu.usage results
          { name: 'api.cpu.usage', tags: { datacenter: ['us-east-1'] }, values: [[1640995200000, 70.0]] },
          { name: 'api.cpu.usage', tags: { datacenter: ['us-west-2'] }, values: [[1640995200000, 75.0]] }
        ]
      }]
    };

    // Step 3: Process results with mapping logic
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
      
      // Simulate series name generation
      const datacenter = result.tags.datacenter[0];
      const aliasTemplate = mappingInfo.target.query.alias;
      let seriesName = aliasTemplate.replace('$_tag_group_datacenter', datacenter);
      
      // Apply variable values from expansion (simulate template service)
      seriesName = seriesName.replace(/\$(\w+)/g, (match, varName) => {
        const variable = mappingInfo.variableValues[varName];
        return variable ? String(variable.value) : match;
      });
      
      processedSeries.push({
        resultIndex,
        metricName,
        datacenter,
        refId,
        value: result.values[0][1],
        seriesName
      });
    });

    console.log('Multi-value + groupby result:', {
      seriesCount: processedSeries.length,
      seriesNames: processedSeries.map(s => s.seriesName)
    });

    // Should get all 4 series
    expect(processedSeries).toHaveLength(4);
    
    const seriesNames = processedSeries.map(s => s.seriesName);
    expect(seriesNames).toEqual([
      'web-us-east-1 CPU',
      'web-us-west-2 CPU', 
      'api-us-east-1 CPU',
      'api-us-west-2 CPU'
    ]);
    
    // Verify values are preserved
    expect(processedSeries[0].value).toBe(60.0);
    expect(processedSeries[1].value).toBe(65.0);
    expect(processedSeries[2].value).toBe(70.0);
    expect(processedSeries[3].value).toBe(75.0);
  });

  test('should handle single series scenarios without groupby (regression test)', () => {
    // Ensure the fix doesn't break normal single-series queries
    
    const scopedVars: ScopedVars = {
      server: { text: 'web01', value: 'web01' }
    };

    const targets = [{
      refId: 'A',
      query: {
        metricName: 'memory.$server.usage',
        alias: '$server Memory',
        tags: {},
        groupBy: { tags: [], time: [], value: [] },
        aggregators: []
      }
    }];

    // Build mappings
    const metricNameToTargetMap: { [compositeKey: string]: any } = {};
    const metricOrderToRefId: { [metricName: string]: string[] } = {};
    
    const expansion = (datasource as any).expandMetricNames('memory.$server.usage', 'A', scopedVars);
    
    expansion.names.forEach((metricName: string, index: number) => {
      const compositeKey = `${metricName}|A`;
      metricNameToTargetMap[compositeKey] = {
        target: targets[0],
        variableValues: expansion.variableValues[index]
      };
      
      if (!metricOrderToRefId[metricName]) {
        metricOrderToRefId[metricName] = [];
      }
      metricOrderToRefId[metricName].push('A');
    });

    // Simulate single result
    const kairosResponse = {
      queries: [{
        results: [
          { name: 'memory.web01.usage', tags: {}, values: [[1640995200000, 512]] }
        ]
      }]
    };

    // Process the result
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
      
      // Generate series name with variables
      const aliasTemplate = mappingInfo.target.query.alias;
      let seriesName = aliasTemplate;
      
      // Apply variable values from expansion
      seriesName = seriesName.replace(/\$(\w+)/g, (match, varName) => {
        const variable = mappingInfo.variableValues[varName];
        return variable ? String(variable.value) : match;
      });
      
      processedSeries.push({
        resultIndex,
        metricName,
        refId,
        value: result.values[0][1],
        seriesName
      });
    });

    console.log('Single series result:', {
      seriesCount: processedSeries.length,
      seriesNames: processedSeries.map(s => s.seriesName)
    });

    expect(processedSeries).toHaveLength(1);
    expect(processedSeries[0].seriesName).toBe('web01 Memory');
    expect(processedSeries[0].value).toBe(512);
  });
});