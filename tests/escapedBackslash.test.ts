/**
 * Comprehensive tests for backslash escape sequences
 */

import {
  containsTemplateVariable,
  escapeLiteralBraces,
  unescapeLiteralBraces,
  hasEscapedBraces,
} from '../src/utils/tagValueEscaping';

describe('Backslash escape sequences', () => {
  describe('Basic escape sequences', () => {
    it('should handle \\\\ as escaped backslash', () => {
      const escaped = escapeLiteralBraces('\\\\');
      const unescaped = unescapeLiteralBraces(escaped);
      expect(unescaped).toBe('\\');
    });

    it('should handle \\$ as escaped dollar', () => {
      const escaped = escapeLiteralBraces('\\$');
      const unescaped = unescapeLiteralBraces(escaped);
      expect(unescaped).toBe('$');
    });

    it('should handle \\{ as escaped left brace', () => {
      const escaped = escapeLiteralBraces('\\{');
      const unescaped = unescapeLiteralBraces(escaped);
      expect(unescaped).toBe('{');
    });

    it('should handle \\} as escaped right brace', () => {
      const escaped = escapeLiteralBraces('\\}');
      const unescaped = unescapeLiteralBraces(escaped);
      expect(unescaped).toBe('}');
    });
  });

  describe('Combinations with template variables', () => {
    it('should handle \\\\$foo as literal backslash + template variable', () => {
      const input = '\\\\$foo';
      expect(containsTemplateVariable(input)).toBe(true);

      const escaped = escapeLiteralBraces(input);
      // Should have backslash placeholder + $foo unchanged
      expect(escaped).toContain('__KAIROSDB_BACKSLASH__');
      expect(escaped).toContain('$foo');

      // After template replacement (simulated)
      const interpolated = escaped.replace('$foo', 'bar');
      const unescaped = unescapeLiteralBraces(interpolated);
      expect(unescaped).toBe('\\bar');
    });

    it('should handle \\\\\\$foo as literal backslash + literal dollar', () => {
      const input = '\\\\\\$foo';
      expect(containsTemplateVariable(input)).toBe(false);

      const escaped = escapeLiteralBraces(input);
      const unescaped = unescapeLiteralBraces(escaped);
      expect(unescaped).toBe('\\$foo');
    });

    it('should handle \\\\\\\\$foo as two literal backslashes + template variable', () => {
      const input = '\\\\\\\\$foo';
      expect(containsTemplateVariable(input)).toBe(true);

      const escaped = escapeLiteralBraces(input);
      // Should have two backslash placeholders + $foo
      const backslashCount = (escaped.match(/__KAIROSDB_BACKSLASH__/g) || []).length;
      expect(backslashCount).toBe(2);
      expect(escaped).toContain('$foo');

      // After template replacement
      const interpolated = escaped.replace('$foo', 'bar');
      const unescaped = unescapeLiteralBraces(interpolated);
      expect(unescaped).toBe('\\\\bar');
    });
  });

  describe('Answer to user question: \\\\\\${foo}', () => {
    it('should produce literal \\${foo}', () => {
      const input = '\\\\\\${foo}';

      // Should NOT contain template variable
      expect(containsTemplateVariable(input)).toBe(false);

      const escaped = escapeLiteralBraces(input);
      const unescaped = unescapeLiteralBraces(escaped);

      // Result should be literal: \${foo}
      expect(unescaped).toBe('\\${foo}');
    });

    it('should handle \\\\\\$\\{foo\\} as all literals', () => {
      const input = '\\\\\\$\\{foo\\}';

      expect(containsTemplateVariable(input)).toBe(false);

      const escaped = escapeLiteralBraces(input);
      const unescaped = unescapeLiteralBraces(escaped);

      expect(unescaped).toBe('\\${foo}');
    });
  });

  describe('Complex escape patterns', () => {
    it('should handle path\\\\\\$var\\\\value', () => {
      const input = 'path\\\\\\$var\\\\value';
      expect(containsTemplateVariable(input)).toBe(false);

      const escaped = escapeLiteralBraces(input);
      const unescaped = unescapeLiteralBraces(escaped);

      expect(unescaped).toBe('path\\$var\\value');
    });

    it('should handle multiple escape sequences in sequence', () => {
      const input = '\\\\\\$\\{\\}';

      const escaped = escapeLiteralBraces(input);
      const unescaped = unescapeLiteralBraces(escaped);

      expect(unescaped).toBe('\\${}');
    });

    it('should handle mixed escaped and unescaped', () => {
      const input = 'literal\\\\and\\$price={value}';
      expect(containsTemplateVariable(input)).toBe(false);

      const escaped = escapeLiteralBraces(input);
      const unescaped = unescapeLiteralBraces(escaped);

      expect(unescaped).toBe('literal\\and$price={value}');
    });
  });

  describe('Edge cases', () => {
    it('should handle trailing backslash (not an escape)', () => {
      const input = 'value\\';

      const escaped = escapeLiteralBraces(input);
      const unescaped = unescapeLiteralBraces(escaped);

      // Trailing backslash is not an escape sequence
      expect(unescaped).toBe('value\\');
    });

    it('should handle backslash before non-escapable character', () => {
      const input = '\\x\\y\\z';

      const escaped = escapeLiteralBraces(input);
      const unescaped = unescapeLiteralBraces(escaped);

      // \x, \y, \z are not escape sequences, backslashes preserved
      expect(unescaped).toBe('\\x\\y\\z');
    });

    it('should handle empty string', () => {
      const escaped = escapeLiteralBraces('');
      const unescaped = unescapeLiteralBraces(escaped);
      expect(unescaped).toBe('');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle Windows path with literal backslashes', () => {
      const input = 'C:\\\\Users\\\\file.txt';

      const escaped = escapeLiteralBraces(input);
      const unescaped = unescapeLiteralBraces(escaped);

      expect(unescaped).toBe('C:\\Users\\file.txt');
    });

    it('should handle regex with escaped backslash and dollar', () => {
      const input = '\\\\d+\\$';

      const escaped = escapeLiteralBraces(input);
      const unescaped = unescapeLiteralBraces(escaped);

      expect(unescaped).toBe('\\d+$');
    });

    it('should handle literal \\${variable} in documentation', () => {
      const input = 'Use \\\\\\${variable} to insert value';

      const escaped = escapeLiteralBraces(input);
      const unescaped = unescapeLiteralBraces(escaped);

      expect(unescaped).toBe('Use \\${variable} to insert value');
    });

    it('should handle price=\\$100 (escaped dollar only)', () => {
      const input = 'price=\\$100';

      const escaped = escapeLiteralBraces(input);
      const unescaped = unescapeLiteralBraces(escaped);

      expect(unescaped).toBe('price=$100');
    });

    it('should mix literal backslash with template variable', () => {
      const input = 'path\\\\$environment\\\\config';
      expect(containsTemplateVariable(input)).toBe(true);

      const escaped = escapeLiteralBraces(input);
      // Simulate template interpolation
      const interpolated = escaped.replace('$environment', 'prod');
      const unescaped = unescapeLiteralBraces(interpolated);

      expect(unescaped).toBe('path\\prod\\config');
    });
  });
});

