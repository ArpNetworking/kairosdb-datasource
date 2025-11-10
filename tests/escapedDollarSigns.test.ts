/**
 * Comprehensive tests for escaped dollar sign handling
 */

import {
  containsTemplateVariable,
  escapeLiteralBraces,
  unescapeLiteralBraces,
  hasEscapedBraces,
} from '../src/utils/tagValueEscaping';

describe('Escaped dollar sign detection', () => {
  describe('containsTemplateVariable', () => {
    it('should NOT detect \\$foo as containing template variable', () => {
      expect(containsTemplateVariable('\\$foo')).toBe(false);
    });

    it('should NOT detect \\${foo} as containing template variable', () => {
      expect(containsTemplateVariable('\\${foo}')).toBe(false);
    });

    it('should detect $foo as containing template variable', () => {
      expect(containsTemplateVariable('$foo')).toBe(true);
    });

    it('should detect ${foo} as containing template variable', () => {
      expect(containsTemplateVariable('${foo}')).toBe(true);
    });

    it('should NOT detect literal-\\$var-value as template variable', () => {
      expect(containsTemplateVariable('literal-\\$var-value')).toBe(false);
    });

    it('should handle mix of escaped and real template variables', () => {
      // Has both \$foo (escaped) and $bar (real variable)
      expect(containsTemplateVariable('\\$foo-$bar')).toBe(true);
    });

    it('should NOT detect only escaped dollars', () => {
      expect(containsTemplateVariable('\\$foo and \\$bar')).toBe(false);
    });

    it('should handle path with escaped dollar', () => {
      expect(containsTemplateVariable('path/\\${id}/something')).toBe(false);
    });
  });
});

describe('Escaped dollar sign escaping and unescaping', () => {
  describe('escapeLiteralBraces with dollar signs', () => {
    it('should escape \\$foo to placeholder', () => {
      const result = escapeLiteralBraces('\\$foo');
      expect(result).toContain('__KAIROSDB_DOLLAR__');
      expect(result).not.toContain('\\$');
    });

    it('should escape \\${foo} to placeholder', () => {
      const result = escapeLiteralBraces('\\${foo}');
      expect(result).toContain('__KAIROSDB_DOLLAR__');
      expect(result).toContain('__KAIROSDB_LEFT_BRACE__');
      expect(result).toContain('__KAIROSDB_RIGHT_BRACE__');
    });

    it('should NOT escape $foo (real template variable)', () => {
      const result = escapeLiteralBraces('$foo');
      expect(result).toBe('$foo');
      expect(result).not.toContain('__KAIROSDB_DOLLAR__');
    });

    it('should handle multiple escaped dollars', () => {
      const result = escapeLiteralBraces('\\$foo-\\$bar');
      expect(result).toContain('__KAIROSDB_DOLLAR__');
      // Should have 2 dollar placeholders
      const count = (result.match(/__KAIROSDB_DOLLAR__/g) || []).length;
      expect(count).toBe(2);
    });

    it('should handle mixed escaped dollar and real variable', () => {
      const input = '\\$literal-$variable';
      const result = escapeLiteralBraces(input);

      // \$ should be escaped
      expect(result).toContain('__KAIROSDB_DOLLAR__');
      // But $variable should remain for template interpolation
      expect(result).toContain('$variable');
    });
  });

  describe('unescapeLiteralBraces with dollar signs', () => {
    it('should restore escaped dollar sign', () => {
      const escaped = '__KAIROSDB_DOLLAR__foo';
      const result = unescapeLiteralBraces(escaped);
      expect(result).toBe('$foo');
    });

    it('should restore escaped ${...}', () => {
      const escaped = '__KAIROSDB_DOLLAR____KAIROSDB_LEFT_BRACE__foo__KAIROSDB_RIGHT_BRACE__';
      const result = unescapeLiteralBraces(escaped);
      expect(result).toBe('${foo}');
    });

    it('should restore multiple escaped dollars', () => {
      const escaped = '__KAIROSDB_DOLLAR__foo-__KAIROSDB_DOLLAR__bar';
      const result = unescapeLiteralBraces(escaped);
      expect(result).toBe('$foo-$bar');
    });
  });

  describe('hasEscapedBraces with dollar signs', () => {
    it('should detect escaped dollar placeholder', () => {
      expect(hasEscapedBraces('text__KAIROSDB_DOLLAR__value')).toBe(true);
    });

    it('should detect escaped brace placeholders', () => {
      expect(hasEscapedBraces('text__KAIROSDB_LEFT_BRACE__value')).toBe(true);
      expect(hasEscapedBraces('text__KAIROSDB_RIGHT_BRACE__value')).toBe(true);
    });

    it('should not detect regular text', () => {
      expect(hasEscapedBraces('regular text')).toBe(false);
    });
  });
});

describe('Round-trip escaping with dollar signs', () => {
  it('should preserve \\$foo through escape/unescape cycle', () => {
    const original = '\\$foo';
    const escaped = escapeLiteralBraces(original);
    const unescaped = unescapeLiteralBraces(escaped);
    expect(unescaped).toBe('$foo'); // \$ becomes literal $
  });

  it('should preserve \\${foo} through escape/unescape cycle', () => {
    const original = '\\${foo}';
    const escaped = escapeLiteralBraces(original);
    const unescaped = unescapeLiteralBraces(escaped);
    expect(unescaped).toBe('${foo}'); // \${foo} becomes literal ${foo}
  });

  it('should preserve literal-\\$var-value through cycle', () => {
    const original = 'literal-\\$var-value';
    const escaped = escapeLiteralBraces(original);
    const unescaped = unescapeLiteralBraces(escaped);
    expect(unescaped).toBe('literal-$var-value');
  });

  it('should preserve path/\\${id}/something through cycle', () => {
    const original = 'path/\\${id}/something';
    const escaped = escapeLiteralBraces(original);
    const unescaped = unescapeLiteralBraces(escaped);
    expect(unescaped).toBe('path/${id}/something');
  });
});

describe('Real-world scenarios with escaped dollars', () => {
  it('should handle price with dollar sign', () => {
    const original = 'price=\\$100';
    const escaped = escapeLiteralBraces(original);
    const unescaped = unescapeLiteralBraces(escaped);
    expect(unescaped).toBe('price=$100');
  });

  it('should handle currency codes', () => {
    const original = 'currency=\\$USD';
    const escaped = escapeLiteralBraces(original);
    const unescaped = unescapeLiteralBraces(escaped);
    expect(unescaped).toBe('currency=$USD');
  });

  it('should handle shell-like variables that should be literal', () => {
    const original = 'command=ls \\$HOME';
    const escaped = escapeLiteralBraces(original);
    const unescaped = unescapeLiteralBraces(escaped);
    expect(unescaped).toBe('command=ls $HOME');
  });

  it('should handle regex patterns with escaped dollars', () => {
    const original = 'pattern=\\^\\w+\\$';
    const escaped = escapeLiteralBraces(original);
    const unescaped = unescapeLiteralBraces(escaped);
    // Only \$ is unescaped (to $), other backslashes are preserved
    expect(unescaped).toBe('pattern=\\^\\w+$');
  });

  it('should preserve template variable while escaping literal dollar', () => {
    const original = 'metric=\\$foo.value-$env';
    const escaped = escapeLiteralBraces(original);

    // \$foo should be escaped, but $env should remain
    expect(escaped).toContain('__KAIROSDB_DOLLAR__');
    expect(escaped).toContain('$env');

    // After "template interpolation" (simulated by replacing $env)
    const interpolated = escaped.replace('$env', 'production');
    const unescaped = unescapeLiteralBraces(interpolated);

    expect(unescaped).toBe('metric=$foo.value-production');
  });
});
