/**
 * Integration tests for tag value interpolation with literal curly braces.
 *
 * These tests verify that:
 * 1. Literal curly braces in tag values are preserved (e.g., "some/path/{id}/something")
 * 2. Template variables are properly expanded
 * 3. Multi-value template variables are split correctly
 * 4. Edge cases and combinations work as expected
 */

import { DataSource } from '../src/datasource';
import { DataSourceInstanceSettings } from '@grafana/data';
import { KairosDBDataSourceOptions } from '../src/types';

// Mock Grafana runtime
jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn(),
  getTemplateSrv: () => ({
    replace: (value: string, scopedVars?: any) => {
      // Mock template service that simulates Grafana's behavior
      if (!value) {
        return value;
      }

      // Handle $variable syntax
      let result = value.replace(/\$(\w+)/g, (match, varName) => {
        if (scopedVars && scopedVars[varName]) {
          const varValue = scopedVars[varName].value;
          if (Array.isArray(varValue) && varValue.length > 1) {
            return `{${varValue.join(',')}}`;
          }
          return String(varValue);
        }
        return match;
      });

      // Handle ${variable} syntax
      result = result.replace(/\$\{(\w+)\}/g, (match, varName) => {
        if (scopedVars && scopedVars[varName]) {
          const varValue = scopedVars[varName].value;
          if (Array.isArray(varValue) && varValue.length > 1) {
            return `{${varValue.join(',')}}`;
          }
          return String(varValue);
        }
        return match;
      });

      return result;
    },
  }),
  isFetchError: jest.fn(),
}));

describe('Tag Interpolation with Literal Braces', () => {
  let datasource: DataSource;

  beforeEach(() => {
    const instanceSettings: DataSourceInstanceSettings<KairosDBDataSourceOptions> = {
      id: 1,
      uid: 'test',
      type: 'kairosdb',
      name: 'KairosDB',
      url: 'http://localhost:8080',
      jsonData: {},
      meta: {} as any,
      access: 'proxy',
      readOnly: false,
    };

    datasource = new DataSource(instanceSettings);
  });

  describe('Literal curly braces in tag values', () => {
    it('should preserve literal braces without template variables', () => {
      const tags = {
        target: ['some/path/{id}/something'],
      };

      // @ts-ignore - accessing private method for testing
      const result = datasource.interpolateTagsWithTemplateSrv(tags, {});

      expect(result.target).toHaveLength(1);
      expect(result.target[0]).toBe('some/path/{id}/something');
    });

    it('should preserve multiple literal braces in same value', () => {
      const tags = {
        path: ['api/{version}/users/{userId}/posts'],
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, {});

      expect(result.path).toHaveLength(1);
      expect(result.path[0]).toBe('api/{version}/users/{userId}/posts');
    });

    it('should preserve literal braces across multiple tag values', () => {
      const tags = {
        target: ['some/path/{id}/something', 'another/{type}/path'],
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, {});

      expect(result.target).toHaveLength(2);
      expect(result.target[0]).toBe('some/path/{id}/something');
      expect(result.target[1]).toBe('another/{type}/path');
    });

    it('should handle nested literal braces', () => {
      const tags = {
        config: ['outer{inner{deep}}'],
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, {});

      expect(result.config).toHaveLength(1);
      expect(result.config[0]).toBe('outer{inner{deep}}');
    });
  });

  describe('Template variable interpolation', () => {
    it('should expand single-value template variable', () => {
      const tags = {
        environment: ['$env'],
      };

      const scopedVars = {
        env: { text: 'production', value: 'production' },
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, scopedVars);

      expect(result.environment).toHaveLength(1);
      expect(result.environment[0]).toBe('production');
    });

    it('should expand multi-value template variable', () => {
      const tags = {
        location: ['$locations'],
      };

      const scopedVars = {
        locations: { text: 'All', value: ['Attic', 'Bedroom', 'Office'] },
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, scopedVars);

      expect(result.location).toHaveLength(3);
      expect(result.location).toEqual(['Attic', 'Bedroom', 'Office']);
    });

    it('should expand ${variable} syntax', () => {
      const tags = {
        region: ['${region}'],
      };

      const scopedVars = {
        region: { text: 'us-west', value: 'us-west' },
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, scopedVars);

      expect(result.region).toHaveLength(1);
      expect(result.region[0]).toBe('us-west');
    });
  });

  describe('Combination of literals and template variables', () => {
    it('should handle template variable with literal braces in same tag list', () => {
      const tags = {
        path: ['some/path/{id}/something', '$dynamicPath'],
      };

      const scopedVars = {
        dynamicPath: { text: 'api/users', value: 'api/users' },
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, scopedVars);

      expect(result.path).toHaveLength(2);
      expect(result.path[0]).toBe('some/path/{id}/something');
      expect(result.path[1]).toBe('api/users');
    });

    it('should preserve literal braces when expanding multi-value variables in other tags', () => {
      const tags = {
        target: ['some/path/{id}/something'],
        environment: ['$environments'],
      };

      const scopedVars = {
        environments: { text: 'All', value: ['dev', 'staging', 'prod'] },
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, scopedVars);

      expect(result.target).toHaveLength(1);
      expect(result.target[0]).toBe('some/path/{id}/something');
      expect(result.environment).toHaveLength(3);
      expect(result.environment).toEqual(['dev', 'staging', 'prod']);
    });
  });

  describe('Composite values with template variables', () => {
    it('should expand composite values with prefix', () => {
      const tags = {
        host: ['server-$locations'],
      };

      const scopedVars = {
        locations: { text: 'All', value: ['attic', 'bedroom', 'office'] },
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, scopedVars);

      expect(result.host).toHaveLength(3);
      expect(result.host).toEqual(['server-attic', 'server-bedroom', 'server-office']);
    });

    it('should expand composite values with suffix', () => {
      const tags = {
        host: ['$locations-server'],
      };

      const scopedVars = {
        locations: { text: 'All', value: ['attic', 'bedroom', 'office'] },
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, scopedVars);

      expect(result.host).toHaveLength(3);
      expect(result.host).toEqual(['attic-server', 'bedroom-server', 'office-server']);
    });

    it('should expand composite values with prefix and suffix', () => {
      const tags = {
        host: ['server-$locations-prod'],
      };

      const scopedVars = {
        locations: { text: 'All', value: ['attic', 'bedroom', 'office'] },
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, scopedVars);

      expect(result.host).toHaveLength(3);
      expect(result.host).toEqual(['server-attic-prod', 'server-bedroom-prod', 'server-office-prod']);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty tag values', () => {
      const tags = {
        empty: [''],
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, {});

      expect(result.empty).toBeUndefined();
    });

    it('should handle undefined/null values', () => {
      const tags = {
        target: ['some/path/{id}/something'],
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, undefined);

      expect(result.target).toHaveLength(1);
      expect(result.target[0]).toBe('some/path/{id}/something');
    });

    it('should handle special characters with literal braces', () => {
      const tags = {
        regex: ['/api/v[0-9]+/{resource}/.*'],
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, {});

      expect(result.regex).toHaveLength(1);
      expect(result.regex[0]).toBe('/api/v[0-9]+/{resource}/.*');
    });

    it('should not treat literal comma-separated braces as multi-value', () => {
      const tags = {
        // This is a single literal value, not a multi-value expansion
        paths: ['{path1},{path2}'],
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, {});

      // Should remain as single value since it's not from template variable expansion
      expect(result.paths).toHaveLength(1);
      expect(result.paths[0]).toBe('{path1},{path2}');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle REST API path patterns', () => {
      const tags = {
        endpoint: ['POST /api/v1/users/{userId}/documents/{documentId}'],
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, {});

      expect(result.endpoint).toHaveLength(1);
      expect(result.endpoint[0]).toBe('POST /api/v1/users/{userId}/documents/{documentId}');
    });

    it('should handle URL templates', () => {
      const tags = {
        url: ['https://example.com/api/{version}/resources/{id}?filter={filter}'],
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, {});

      expect(result.url).toHaveLength(1);
      expect(result.url[0]).toBe('https://example.com/api/{version}/resources/{id}?filter={filter}');
    });

    it('should handle Spring path patterns', () => {
      const tags = {
        path: ['/api/users/{userId:[0-9]+}'],
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, {});

      expect(result.path).toHaveLength(1);
      expect(result.path[0]).toBe('/api/users/{userId:[0-9]+}');
    });

    it('should combine REST paths with Grafana variables', () => {
      const tags = {
        endpoint: ['POST /api/v1/users/{userId}/documents'],
        environment: ['$env'],
      };

      const scopedVars = {
        env: { text: 'production', value: 'production' },
      };

      // @ts-ignore
      const result = datasource.interpolateTagsWithTemplateSrv(tags, scopedVars);

      expect(result.endpoint).toHaveLength(1);
      expect(result.endpoint[0]).toBe('POST /api/v1/users/{userId}/documents');
      expect(result.environment).toHaveLength(1);
      expect(result.environment[0]).toBe('production');
    });
  });
});
