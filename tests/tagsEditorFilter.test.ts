/**
 * Tests for TagsEditor filter logic integration with literal brace escaping.
 *
 * This tests the integration between:
 * 1. TagsEditor's tag value filtering (which values to preserve when server returns fresh data)
 * 2. The literal brace escaping system (which happens at interpolation time)
 *
 * The filter logic must preserve values with literal braces so they aren't removed
 * when tags are refreshed from the server.
 */

import { containsTemplateVariable } from '../src/utils/tagValueEscaping';

describe('TagsEditor Filter Logic Integration', () => {
  /**
   * Simulates the filter logic from TagsEditor.tsx lines 40-51
   * This determines which tag values to keep when the server returns fresh tag data
   */
  function filterTagValues(
    currentValues: string[],
    serverValues: string[]
  ): string[] {
    return currentValues.filter(
      (value) =>
        // Keep if value exists in server data
        serverValues.includes(value) ||
        // Keep if it's a template variable
        containsTemplateVariable(value) ||
        // Keep if it's in special bracket format (legacy)
        (value.startsWith('[') && value.endsWith(']')) ||
        // Keep if it contains literal curly braces (e.g., "some/path/{id}/something")
        // These are valid literal values and should be preserved
        (value.includes('{') || value.includes('}'))
    );
  }

  describe('Literal brace preservation', () => {
    it('should preserve tag value with literal braces when server returns it', () => {
      const currentValues = ['some/path/{id}/something'];
      const serverValues = ['some/path/{id}/something', 'other/value'];

      const result = filterTagValues(currentValues, serverValues);

      expect(result).toContain('some/path/{id}/something');
    });

    it('should preserve manually-entered tag value with literal braces even if not in server data', () => {
      const currentValues = ['some/path/{id}/something'];
      const serverValues = ['other/value'];

      const result = filterTagValues(currentValues, serverValues);

      // Should be kept because it contains literal braces
      expect(result).toContain('some/path/{id}/something');
    });

    it('should preserve multiple literal brace values', () => {
      const currentValues = [
        'api/{version}/users/{userId}',
        'path/{type}/resource',
        'normal-value'
      ];
      const serverValues = ['normal-value'];

      const result = filterTagValues(currentValues, serverValues);

      expect(result).toContain('api/{version}/users/{userId}');
      expect(result).toContain('path/{type}/resource');
      expect(result).toContain('normal-value');
    });

    it('should preserve values with only left brace', () => {
      const currentValues = ['incomplete/{path'];
      const serverValues = [];

      const result = filterTagValues(currentValues, serverValues);

      expect(result).toContain('incomplete/{path');
    });

    it('should preserve values with only right brace', () => {
      const currentValues = ['incomplete/path}'];
      const serverValues = [];

      const result = filterTagValues(currentValues, serverValues);

      expect(result).toContain('incomplete/path}');
    });
  });

  describe('Template variable preservation', () => {
    it('should preserve template variables', () => {
      const currentValues = ['$environment', '${region}', 'literal-value'];
      const serverValues = ['literal-value'];

      const result = filterTagValues(currentValues, serverValues);

      expect(result).toContain('$environment');
      expect(result).toContain('${region}');
      expect(result).toContain('literal-value');
    });

    it('should NOT preserve non-template variable values that are not in server data', () => {
      const currentValues = ['old-value', 'another-old'];
      const serverValues = ['new-value'];

      const result = filterTagValues(currentValues, serverValues);

      // Old values should be removed
      expect(result).not.toContain('old-value');
      expect(result).not.toContain('another-old');
    });
  });

  describe('Legacy bracket format', () => {
    it('should preserve values in bracket format', () => {
      const currentValues = ['[special]', '[another]'];
      const serverValues = [];

      const result = filterTagValues(currentValues, serverValues);

      expect(result).toContain('[special]');
      expect(result).toContain('[another]');
    });
  });

  describe('Mixed scenarios', () => {
    it('should handle mix of literal braces, template variables, and server values', () => {
      const currentValues = [
        'some/path/{id}/something',        // Literal braces
        '$environment',                     // Template variable
        'server-value',                     // In server data
        'old-manual-value',                 // Not in server data, should be removed
        'api/{version}/endpoint',           // Literal braces
        '${region}'                         // Template variable
      ];
      const serverValues = ['server-value', 'another-server-value'];

      const result = filterTagValues(currentValues, serverValues);

      expect(result).toContain('some/path/{id}/something');
      expect(result).toContain('$environment');
      expect(result).toContain('server-value');
      expect(result).not.toContain('old-manual-value');
      expect(result).toContain('api/{version}/endpoint');
      expect(result).toContain('${region}');
    });

    it('should distinguish between literal braces and template variable braces', () => {
      const currentValues = [
        'literal/path/{id}',                // Literal braces - should keep
        '$var',                             // Template variable - should keep
        'composite-$var-value',             // Template variable in composite - should keep
        'plain-value'                       // Plain value not in server - should remove
      ];
      const serverValues = [];

      const result = filterTagValues(currentValues, serverValues);

      expect(result).toContain('literal/path/{id}');
      expect(result).toContain('$var');
      expect(result).toContain('composite-$var-value');
      expect(result).not.toContain('plain-value');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty server values', () => {
      const currentValues = [
        'some/path/{id}/something',
        '$environment'
      ];
      const serverValues: string[] = [];

      const result = filterTagValues(currentValues, serverValues);

      // Both should be preserved (one has braces, one is template variable)
      expect(result).toHaveLength(2);
      expect(result).toContain('some/path/{id}/something');
      expect(result).toContain('$environment');
    });

    it('should handle empty current values', () => {
      const currentValues: string[] = [];
      const serverValues = ['value1', 'value2'];

      const result = filterTagValues(currentValues, serverValues);

      expect(result).toHaveLength(0);
    });

    it('should handle nested braces', () => {
      const currentValues = ['outer{inner{deep}}'];
      const serverValues = [];

      const result = filterTagValues(currentValues, serverValues);

      expect(result).toContain('outer{inner{deep}}');
    });

    it('should handle URL-like patterns with braces', () => {
      const currentValues = [
        'https://api.example.com/{version}/users/{id}',
        'http://localhost:8080/api/{endpoint}'
      ];
      const serverValues = [];

      const result = filterTagValues(currentValues, serverValues);

      expect(result).toHaveLength(2);
      expect(result).toContain('https://api.example.com/{version}/users/{id}');
      expect(result).toContain('http://localhost:8080/api/{endpoint}');
    });
  });
});
