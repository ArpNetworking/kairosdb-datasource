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
 * Escaping syntax:
 * - \$foo → literal "$foo"
 * - \${foo} → literal "${foo}"
 * - {id} → literal "{id}" (only if no $ present)
 * - $foo → template variable (expands to value)
 * - ${foo} → template variable (expands to value)
 */

// Use unique placeholders that are unlikely to appear in real tag values
const LEFT_BRACE_PLACEHOLDER = '__KAIROSDB_LEFT_BRACE__';
const RIGHT_BRACE_PLACEHOLDER = '__KAIROSDB_RIGHT_BRACE__';
const DOLLAR_PLACEHOLDER = '__KAIROSDB_DOLLAR__';

/**
 * Check if a value looks like it contains template variables (after removing escaped dollars)
 */
export function containsTemplateVariable(value: string): boolean {
  if (!value) {
    return false;
  }

  // Remove escaped dollar signs before checking for template variables
  // \$ should not be considered a template variable marker
  const withoutEscapedDollars = value.replace(/\\\$/g, '');

  // Check for $variable or ${variable} syntax
  return /\$\{?[a-zA-Z_]/.test(withoutEscapedDollars);
}

/**
 * Escape literal dollar signs (\$) and curly braces in a tag value.
 *
 * This protects literal characters from being interpreted as template variables.
 * Must be called BEFORE template interpolation.
 *
 * @param value The tag value to escape
 * @returns The value with literal characters replaced by placeholders
 */
export function escapeLiteralBraces(value: string): string {
  if (!value) {
    return value;
  }

  // First, escape \$ to protect literal dollar signs
  // This must be done before checking for template variables
  let escaped = value.replace(/\\\$/g, DOLLAR_PLACEHOLDER);

  // Now check if the value (after removing escaped dollars) contains template variables
  // If it does, we still escape the braces but not everything
  const hasTemplateVars = containsTemplateVariable(value);

  if (!hasTemplateVars) {
    // No template variables - escape all braces
    escaped = escaped
      .replace(/\{/g, LEFT_BRACE_PLACEHOLDER)
      .replace(/\}/g, RIGHT_BRACE_PLACEHOLDER);
  }

  return escaped;
}

/**
 * Restore literal characters (curly braces and dollar signs) after template interpolation
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
    .replace(new RegExp(DOLLAR_PLACEHOLDER, 'g'), '$');
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
         value.includes(DOLLAR_PLACEHOLDER);
}
