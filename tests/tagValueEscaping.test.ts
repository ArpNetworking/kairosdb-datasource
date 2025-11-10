import {
  containsTemplateVariable,
  escapeLiteralBraces,
  unescapeLiteralBraces,
  escapeTagValues,
  unescapeTagValues,
  hasEscapedBraces,
} from '../src/utils/tagValueEscaping';

describe('tagValueEscaping', () => {
  describe('containsTemplateVariable', () => {
    it('should detect $variable syntax', () => {
      expect(containsTemplateVariable('$environment')).toBe(true);
      expect(containsTemplateVariable('prefix-$environment')).toBe(true);
      expect(containsTemplateVariable('$environment-suffix')).toBe(true);
    });

    it('should detect ${variable} syntax', () => {
      expect(containsTemplateVariable('${environment}')).toBe(true);
      expect(containsTemplateVariable('prefix-${environment}')).toBe(true);
      expect(containsTemplateVariable('${environment}-suffix')).toBe(true);
    });

    it('should not detect literal braces', () => {
      expect(containsTemplateVariable('some/path/{id}/something')).toBe(false);
      expect(containsTemplateVariable('{literal}')).toBe(false);
      expect(containsTemplateVariable('test{123}value')).toBe(false);
    });

    it('should not detect other special characters', () => {
      expect(containsTemplateVariable('test#value')).toBe(false);
      expect(containsTemplateVariable('test@value')).toBe(false);
      expect(containsTemplateVariable('test%value')).toBe(false);
    });

    it('should handle empty/null values', () => {
      expect(containsTemplateVariable('')).toBe(false);
      expect(containsTemplateVariable(null as any)).toBe(false);
      expect(containsTemplateVariable(undefined as any)).toBe(false);
    });

    it('should detect variables with numbers in the name', () => {
      // Variables can contain numbers after the first character
      expect(containsTemplateVariable('$var1')).toBe(true);
      expect(containsTemplateVariable('$my_var_2')).toBe(true);
      expect(containsTemplateVariable('${var123}')).toBe(true);
    });

    it('should detect variables starting with underscore', () => {
      expect(containsTemplateVariable('$_private')).toBe(true);
      expect(containsTemplateVariable('$_var123')).toBe(true);
      expect(containsTemplateVariable('${_internal}')).toBe(true);
    });

    it('should NOT detect dollar followed by number (invalid variable name)', () => {
      // Variable names cannot START with a number (JavaScript identifier rules)
      expect(containsTemplateVariable('price=$100')).toBe(false);
      expect(containsTemplateVariable('$123')).toBe(false);
      expect(containsTemplateVariable('cost=$99.99')).toBe(false);
    });

    it('should NOT detect dollar followed by special characters', () => {
      expect(containsTemplateVariable('price=$')).toBe(false);
      expect(containsTemplateVariable('$-value')).toBe(false);
      expect(containsTemplateVariable('$.property')).toBe(false);
      expect(containsTemplateVariable('$@user')).toBe(false);
    });

    it('should detect variables in complex strings', () => {
      expect(containsTemplateVariable('api/v1/$service/endpoint')).toBe(true);
      expect(containsTemplateVariable('metric_$env_$region')).toBe(true);
      expect(containsTemplateVariable('value-${var_name_123}-suffix')).toBe(true);
    });
  });

  describe('escapeLiteralBraces', () => {
    it('should escape literal curly braces', () => {
      const result = escapeLiteralBraces('some/path/{id}/something');
      expect(result).toContain('__KAIROSDB_LEFT_BRACE__');
      expect(result).toContain('__KAIROSDB_RIGHT_BRACE__');
      expect(result).not.toContain('{');
      expect(result).not.toContain('}');
    });

    it('should not escape values with template variables', () => {
      expect(escapeLiteralBraces('$environment')).toBe('$environment');
      expect(escapeLiteralBraces('${environment}')).toBe('${environment}');
      expect(escapeLiteralBraces('prefix-$var')).toBe('prefix-$var');
    });

    it('should handle multiple braces', () => {
      const result = escapeLiteralBraces('path/{id}/sub/{type}/value');
      expect(result).toBe('path/__KAIROSDB_LEFT_BRACE__id__KAIROSDB_RIGHT_BRACE__/sub/__KAIROSDB_LEFT_BRACE__type__KAIROSDB_RIGHT_BRACE__/value');
    });

    it('should handle nested braces', () => {
      const result = escapeLiteralBraces('outer{inner{deep}}');
      expect(result).not.toContain('{');
      expect(result).not.toContain('}');
    });

    it('should handle empty/null values', () => {
      expect(escapeLiteralBraces('')).toBe('');
      expect(escapeLiteralBraces(null as any)).toBe(null);
      expect(escapeLiteralBraces(undefined as any)).toBe(undefined);
    });
  });

  describe('unescapeLiteralBraces', () => {
    it('should restore escaped braces', () => {
      const escaped = 'some/path/__KAIROSDB_LEFT_BRACE__id__KAIROSDB_RIGHT_BRACE__/something';
      expect(unescapeLiteralBraces(escaped)).toBe('some/path/{id}/something');
    });

    it('should handle multiple escaped braces', () => {
      const escaped = 'path/__KAIROSDB_LEFT_BRACE__id__KAIROSDB_RIGHT_BRACE__/sub/__KAIROSDB_LEFT_BRACE__type__KAIROSDB_RIGHT_BRACE__/value';
      expect(unescapeLiteralBraces(escaped)).toBe('path/{id}/sub/{type}/value');
    });

    it('should not affect unescaped text', () => {
      expect(unescapeLiteralBraces('normal text')).toBe('normal text');
      expect(unescapeLiteralBraces('$variable')).toBe('$variable');
    });

    it('should handle empty/null values', () => {
      expect(unescapeLiteralBraces('')).toBe('');
      expect(unescapeLiteralBraces(null as any)).toBe(null);
      expect(unescapeLiteralBraces(undefined as any)).toBe(undefined);
    });
  });

  describe('escapeTagValues and unescapeTagValues', () => {
    it('should escape array of values', () => {
      const values = ['some/path/{id}/something', 'another/{type}/path'];
      const escaped = escapeTagValues(values);
      expect(escaped.length).toBe(2);
      expect(escaped[0]).toContain('__KAIROSDB_LEFT_BRACE__');
      expect(escaped[1]).toContain('__KAIROSDB_LEFT_BRACE__');
    });

    it('should unescape array of values', () => {
      const escaped = [
        'some/path/__KAIROSDB_LEFT_BRACE__id__KAIROSDB_RIGHT_BRACE__/something',
        'another/__KAIROSDB_LEFT_BRACE__type__KAIROSDB_RIGHT_BRACE__/path'
      ];
      const unescaped = unescapeTagValues(escaped);
      expect(unescaped.length).toBe(2);
      expect(unescaped[0]).toBe('some/path/{id}/something');
      expect(unescaped[1]).toBe('another/{type}/path');
    });

    it('should handle mixed literal and template variable values', () => {
      const values = ['some/path/{id}/something', '$environment', 'literal-value'];
      const escaped = escapeTagValues(values);
      expect(escaped[0]).toContain('__KAIROSDB_LEFT_BRACE__'); // Literal escaped
      expect(escaped[1]).toBe('$environment'); // Template variable not escaped
      expect(escaped[2]).toBe('literal-value'); // No braces, unchanged
    });
  });

  describe('hasEscapedBraces', () => {
    it('should detect escaped braces', () => {
      expect(hasEscapedBraces('text__KAIROSDB_LEFT_BRACE__value')).toBe(true);
      expect(hasEscapedBraces('text__KAIROSDB_RIGHT_BRACE__value')).toBe(true);
      expect(hasEscapedBraces('__KAIROSDB_LEFT_BRACE____KAIROSDB_RIGHT_BRACE__')).toBe(true);
    });

    it('should not detect regular text', () => {
      expect(hasEscapedBraces('normal text')).toBe(false);
      expect(hasEscapedBraces('some/path/value')).toBe(false);
      expect(hasEscapedBraces('$variable')).toBe(false);
    });

    it('should handle empty/null values', () => {
      expect(hasEscapedBraces('')).toBe(false);
      expect(hasEscapedBraces(null as any)).toBe(false);
      expect(hasEscapedBraces(undefined as any)).toBe(false);
    });
  });

  describe('Round-trip escaping', () => {
    it('should preserve literal braces through escape/unescape cycle', () => {
      const original = 'some/path/{id}/something';
      const escaped = escapeLiteralBraces(original);
      const unescaped = unescapeLiteralBraces(escaped);
      expect(unescaped).toBe(original);
    });

    it('should preserve template variables through escape/unescape cycle', () => {
      const original = '$environment';
      const escaped = escapeLiteralBraces(original);
      const unescaped = unescapeLiteralBraces(escaped);
      expect(unescaped).toBe(original);
      expect(escaped).toBe(original); // Should not be modified
    });

    it('should handle complex paths', () => {
      const original = 'api/v1/{version}/users/{userId}/posts/{postId}';
      const escaped = escapeLiteralBraces(original);
      const unescaped = unescapeLiteralBraces(escaped);
      expect(unescaped).toBe(original);
    });
  });
});
