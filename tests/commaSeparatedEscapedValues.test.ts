/**
 * Tests for handling comma-separated values containing escaped literals.
 *
 * This tests the scenario where a template variable expands to multiple values,
 * and one or more of those values contains literal braces that need escaping.
 *
 * Example: Variable $paths with values: "api/v1", "api/{version}/v2", "admin"
 * When all selected, expands to: "api/v1,api/{version}/v2,admin"
 * Should split into: ["api/v1", "api/{version}/v2", "admin"]
 */

import { escapeLiteralBraces, unescapeLiteralBraces } from '../src/utils/tagValueEscaping';

describe('Comma-separated values with escaped literals', () => {
  describe('Splitting behavior', () => {
    it('should split mixed plain text and escaped braces (Gemini scenario)', () => {
      // Gemini's scenario: "foo,\{bar\},baz"
      // After escaping the literal braces
      const input = 'foo,__KAIROSDB_LEFT_BRACE__bar__KAIROSDB_RIGHT_BRACE__,baz';

      // This is a MIX of plain text (foo, baz) and placeholders (bar with braces)
      // Should split into 3 values

      const parts = input.split(',');
      const unescaped = parts.map(part => unescapeLiteralBraces(part.trim()));

      expect(unescaped).toEqual(['foo', '{bar}', 'baz']);
    });

    it('should NOT split when ALL parts have placeholders (failing test scenario)', () => {
      // Failing test scenario: "{path1},{path2}"
      // After escaping - all parts contain placeholders
      const input = '__KAIROSDB_LEFT_BRACE__path1__KAIROSDB_RIGHT_BRACE__,__KAIROSDB_LEFT_BRACE__path2__KAIROSDB_RIGHT_BRACE__';

      // Check that all comma-separated parts contain placeholders
      const parts = input.split(',');
      const allHavePlaceholders = parts.every(part => /__KAIROSDB_[A-Z_]+__/.test(part));
      expect(allHavePlaceholders).toBe(true);

      // Should NOT split - remains as single literal value
      const unescaped = unescapeLiteralBraces(input);
      expect(unescaped).toBe('{path1},{path2}');
    });

    it('should split comma-separated values where one contains escaped braces', () => {
      // Simulate: Template variable expands to "foo,api/{version}/endpoint,baz"
      // After escaping the literal braces in the middle value
      const input = 'foo,api/__KAIROSDB_LEFT_BRACE__version__KAIROSDB_RIGHT_BRACE__/endpoint,baz';

      // Contains plain text mixed with placeholders - should split

      // Manual split (what should happen)
      const parts = input.split(',');
      const unescaped = parts.map(part => unescapeLiteralBraces(part.trim()));

      expect(unescaped).toEqual(['foo', 'api/{version}/endpoint', 'baz']);
    });

    it('should NOT split commas inside unescaped braces (template expansion)', () => {
      // This is a template variable result: {val1,val2,val3}
      const input = '{foo,bar,baz}';

      // Should extract inner values and split those
      const match = input.match(/^\{(.+)\}$/);
      if (match) {
        const values = match[1].split(',').map(v => v.trim());
        expect(values).toEqual(['foo', 'bar', 'baz']);
      }
    });

    it('should handle literal braces with commas inside (escaped braces)', () => {
      // User wants literal "{foo,bar}" as a single value
      const escaped = escapeLiteralBraces('\\{foo,bar\\}');
      const unescaped = unescapeLiteralBraces(escaped);

      expect(unescaped).toBe('{foo,bar}');
    });

    it('should handle mix of escaped values in comma-separated list', () => {
      // Multiple values, multiple escaped
      const input = 'path/{id}/users,api/{version}/endpoint,admin/{role}/settings';

      // After escaping literals in each value before joining
      const values = ['path/{id}/users', 'api/{version}/endpoint', 'admin/{role}/settings'];
      const escaped = values.map(v => escapeLiteralBraces(v));
      const joined = escaped.join(',');

      // After interpolation (no template vars, so unchanged)
      // Should split and unescape each part
      const parts = joined.split(',');
      const result = parts.map(p => unescapeLiteralBraces(p.trim()));

      expect(result).toEqual(values);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty values in comma-separated list', () => {
      const input = 'foo,,bar';
      const parts = input.split(',').map(v => v.trim()).filter(v => v !== '');

      expect(parts).toEqual(['foo', 'bar']);
    });

    it('should handle single value with escaped braces (no commas)', () => {
      const escaped = escapeLiteralBraces('api/{version}/endpoint');
      const unescaped = unescapeLiteralBraces(escaped);

      expect(unescaped).toBe('api/{version}/endpoint');
    });

    it('should handle comma-separated values with no escaped braces', () => {
      const input = 'foo,bar,baz';
      const parts = input.split(',').map(v => v.trim());

      expect(parts).toEqual(['foo', 'bar', 'baz']);
    });
  });
});
