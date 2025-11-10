/**
 * Utilities for handling literal curly braces and dollar signs in tag values.
 *
 * Tag values can contain literal curly braces (e.g., "some/path/{id}/something")
 * or literal dollar signs (e.g., "\$foo") which should not be interpreted as
 * Grafana template variables.
 *
 * We use placeholder substitution to protect literal characters during template
 * variable interpolation.
 *
 * Escaping syntax (backslash-based):
 * - \\ → literal "\"
 * - \$ → literal "$"
 * - \{ → literal "{"
 * - \} → literal "}"
 * - {id} → literal "{id}" (only if no $ present)
 * - $foo → template variable (expands to value)
 * - ${foo} → template variable (expands to value)
 *
 * Examples:
 * - \$foo → literal "$foo"
 * - \\$foo → literal "\" + template variable $foo → "\<expanded>"
 * - \\\$foo → literal "\" + literal "$" → "\$foo"
 * - \\\${foo} → literal "\${foo}"
 */

// Use unique placeholders that are unlikely to appear in real tag values
const LEFT_BRACE_PLACEHOLDER = '__KAIROSDB_LEFT_BRACE__';
const RIGHT_BRACE_PLACEHOLDER = '__KAIROSDB_RIGHT_BRACE__';
const DOLLAR_PLACEHOLDER = '__KAIROSDB_DOLLAR__';
const BACKSLASH_PLACEHOLDER = '__KAIROSDB_BACKSLASH__';

/**
 * Process escape sequences and check for template variables.
 * Returns the processed string with escape sequences replaced by placeholders,
 * and whether the string contains template variables.
 */
function processEscapeSequences(value: string): { processed: string; hasTemplateVars: boolean } {
  let result = '';
  let hasTemplateVars = false;
  let i = 0;

  while (i < value.length) {
    if (value[i] === '\\' && i + 1 < value.length) {
      const next = value[i + 1];
      if (next === '\\') {
        // Escaped backslash
        result += BACKSLASH_PLACEHOLDER;
        i += 2;
        continue;
      } else if (next === '$') {
        // Escaped dollar
        result += DOLLAR_PLACEHOLDER;
        i += 2;
        continue;
      } else if (next === '{') {
        // Escaped left brace
        result += LEFT_BRACE_PLACEHOLDER;
        i += 2;
        continue;
      } else if (next === '}') {
        // Escaped right brace
        result += RIGHT_BRACE_PLACEHOLDER;
        i += 2;
        continue;
      }
      // Not a recognized escape sequence, keep the backslash
      result += value[i];
      i += 1;
    } else {
      // Check if this is start of a template variable
      if (value[i] === '$' && i + 1 < value.length && /[a-zA-Z_{]/.test(value[i + 1])) {
        hasTemplateVars = true;
      }
      result += value[i];
      i += 1;
    }
  }

  return { processed: result, hasTemplateVars };
}

/**
 * Check if a value looks like it contains template variables (after processing escapes)
 */
export function containsTemplateVariable(value: string): boolean {
  if (!value) {
    return false;
  }

  const { hasTemplateVars } = processEscapeSequences(value);
  return hasTemplateVars;
}

/**
 * Escape literal characters using backslash escape sequences.
 *
 * Processes escape sequences (\\, \$, \{, \}) and protects literal characters
 * from template interpolation. Also escapes unescaped braces if no template vars present.
 *
 * Must be called BEFORE template interpolation.
 *
 * @param value The tag value to escape
 * @returns The value with escape sequences processed and literal chars protected
 */
export function escapeLiteralBraces(value: string): string {
  if (!value) {
    return value;
  }

  // Process all escape sequences and detect template variables
  const { processed, hasTemplateVars } = processEscapeSequences(value);

  // If no template variables, also escape any remaining unescaped braces
  if (!hasTemplateVars) {
    return processed
      .replace(/\{/g, LEFT_BRACE_PLACEHOLDER)
      .replace(/\}/g, RIGHT_BRACE_PLACEHOLDER);
  }

  return processed;
}

/**
 * Restore literal characters after template interpolation
 *
 * @param value The interpolated value
 * @returns The value with placeholders restored to original characters
 */
export function unescapeLiteralBraces(value: string): string {
  if (!value) {
    return value;
  }

  return value
    .replace(new RegExp(LEFT_BRACE_PLACEHOLDER, 'g'), '{')
    .replace(new RegExp(RIGHT_BRACE_PLACEHOLDER, 'g'), '}')
    .replace(new RegExp(DOLLAR_PLACEHOLDER, 'g'), '$')
    .replace(new RegExp(BACKSLASH_PLACEHOLDER, 'g'), '\\');
}

/**
 * Escape an array of tag values
 *
 * @param values Array of tag values
 * @returns Array with literal braces escaped
 */
export function escapeTagValues(values: string[]): string[] {
  return values.map(v => escapeLiteralBraces(v));
}

/**
 * Unescape an array of tag values
 *
 * @param values Array of interpolated tag values
 * @returns Array with placeholders restored to braces
 */
export function unescapeTagValues(values: string[]): string[] {
  return values.map(v => unescapeLiteralBraces(v));
}

/**
 * Check if a value contains our placeholders (indicating it had literal characters)
 */
export function hasEscapedBraces(value: string): boolean {
  if (!value) {
    return false;
  }
  return value.includes(LEFT_BRACE_PLACEHOLDER) ||
         value.includes(RIGHT_BRACE_PLACEHOLDER) ||
         value.includes(DOLLAR_PLACEHOLDER) ||
         value.includes(BACKSLASH_PLACEHOLDER);
}
