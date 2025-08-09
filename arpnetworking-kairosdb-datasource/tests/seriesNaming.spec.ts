/**
 * Tests for series naming logic - ensuring only relevant tags are included
 * 
 * These tests verify that series names only include tags that were explicitly
 * specified in the query's tags section or groupBy.tags, not all tags from the response.
 */

import { DataSource } from '../src/datasource';

describe('Series Naming', () => {
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

  describe('getRelevantTagKeys', () => {
    test('should only include tags specified in query.tags', () => {
      const targetQuery = {
        metricName: 'cpu.usage',
        tags: {
          host: ['server1'],
          datacenter: ['us-east-1']
          // Note: service not included in query
        },
        groupBy: { tags: [], time: [], value: [] }
      };

      const resultTags = {
        host: ['server1'],
        datacenter: ['us-east-1'], 
        service: ['web'], // This should NOT be included
        cluster: ['prod'] // This should NOT be included
      };

      const relevantKeys = (datasource as any).getRelevantTagKeys(targetQuery, resultTags);
      
      expect(relevantKeys).toContain('host');
      expect(relevantKeys).toContain('datacenter');
      expect(relevantKeys).not.toContain('service');
      expect(relevantKeys).not.toContain('cluster');
      expect(relevantKeys).toHaveLength(2);
    });

    test('should only include tags specified in groupBy.tags', () => {
      const targetQuery = {
        metricName: 'cpu.usage',
        tags: {}, // No tags specified
        groupBy: {
          tags: ['host'], // Only grouping by host
          time: [],
          value: []
        }
      };

      const resultTags = {
        host: ['server1'],
        datacenter: ['us-east-1'], // Should NOT be included
        service: ['web'],          // Should NOT be included
        cluster: ['prod']          // Should NOT be included
      };

      const relevantKeys = (datasource as any).getRelevantTagKeys(targetQuery, resultTags);
      
      expect(relevantKeys).toContain('host');
      expect(relevantKeys).not.toContain('datacenter');
      expect(relevantKeys).not.toContain('service');
      expect(relevantKeys).not.toContain('cluster');
      expect(relevantKeys).toHaveLength(1);
    });

    test('should include tags from both query.tags and groupBy.tags without duplicates', () => {
      const targetQuery = {
        metricName: 'cpu.usage',
        tags: {
          host: ['server1'],
          datacenter: ['us-east-1']
        },
        groupBy: {
          tags: ['host', 'service'], // host is duplicate, service is new
          time: [],
          value: []
        }
      };

      const resultTags = {
        host: ['server1'],
        datacenter: ['us-east-1'],
        service: ['web'],
        cluster: ['prod'] // Should NOT be included
      };

      const relevantKeys = (datasource as any).getRelevantTagKeys(targetQuery, resultTags);
      
      expect(relevantKeys).toContain('host');
      expect(relevantKeys).toContain('datacenter');
      expect(relevantKeys).toContain('service');
      expect(relevantKeys).not.toContain('cluster');
      expect(relevantKeys).toHaveLength(3);
    });

    test('should handle empty query.tags and empty groupBy.tags', () => {
      const targetQuery = {
        metricName: 'cpu.usage',
        tags: {},
        groupBy: { tags: [], time: [], value: [] }
      };

      const resultTags = {
        host: ['server1'],
        datacenter: ['us-east-1'],
        service: ['web'],
        cluster: ['prod']
      };

      const relevantKeys = (datasource as any).getRelevantTagKeys(targetQuery, resultTags);
      
      expect(relevantKeys).toHaveLength(0);
    });

    test('should handle missing tags in result', () => {
      const targetQuery = {
        metricName: 'cpu.usage',
        tags: {
          host: ['server1'],
          datacenter: ['us-east-1']
        },
        groupBy: { tags: ['service'], time: [], value: [] }
      };

      const resultTags = {
        host: ['server1']
        // datacenter and service are missing from result
      };

      const relevantKeys = (datasource as any).getRelevantTagKeys(targetQuery, resultTags);
      
      expect(relevantKeys).toContain('host');
      expect(relevantKeys).not.toContain('datacenter'); // Missing from result
      expect(relevantKeys).not.toContain('service');    // Missing from result
      expect(relevantKeys).toHaveLength(1);
    });

    test('should handle query.tags with empty arrays', () => {
      const targetQuery = {
        metricName: 'cpu.usage',
        tags: {
          host: [], // Empty array - should not be included
          datacenter: ['us-east-1']
        },
        groupBy: { tags: [], time: [], value: [] }
      };

      const resultTags = {
        host: ['server1'],
        datacenter: ['us-east-1']
      };

      const relevantKeys = (datasource as any).getRelevantTagKeys(targetQuery, resultTags);
      
      expect(relevantKeys).not.toContain('host'); // Empty in query
      expect(relevantKeys).toContain('datacenter');
      expect(relevantKeys).toHaveLength(1);
    });
  });
});