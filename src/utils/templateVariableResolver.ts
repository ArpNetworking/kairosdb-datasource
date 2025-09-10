import { getTemplateSrv } from '@grafana/runtime';
import { parseTemplateVariableInput, hasTemplateVariables } from './templateVariableParser';

export interface SearchStrategy {
  type: 'resolved' | 'pattern' | 'partial' | 'combined' | 'literal';
  searchTerm: string;
  description: string;
}

/**
 * Attempts to resolve template variables in the input using Grafana's templateSrv
 * Returns the resolved string or null if resolution failed
 */
export function resolveTemplateVariables(input: string): string | null {
  // Quick check: if no variables, return original input
  if (!hasTemplateVariables(input)) {
    return input;
  }

  // Handle empty input
  if (!input) {
    return input;
  }

  try {
    const templateSrv = getTemplateSrv();
    
    if (!templateSrv || typeof templateSrv.replace !== 'function') {
      return null;
    }

    const resolved = templateSrv.replace(input);
    
    // If the result is the same as input, resolution failed (variables weren't replaced)
    if (resolved === input) {
      return null;
    }

    return resolved;
  } catch (error) {
    // Template service error, variable doesn't exist, etc.
    console.warn('[TemplateVariableResolver] Failed to resolve variables:', error);
    return null;
  }
}

/**
 * Generate all possible search terms for an input with template variables
 * Returns resolved values (potentially multiple), wildcard pattern, and original template
 */
export function getAllSearchTerms(input: string): string[] {
  const searchTerms: string[] = [];

  // Handle empty or whitespace-only inputs
  const trimmed = input?.trim();
  if (!trimmed) {
    return [];
  }

  // Handle inputs without variables - just return the input
  if (!hasTemplateVariables(trimmed)) {
    return [trimmed];
  }

  // Step 1: Try to resolve variables to all possible values
  const resolvedTerms = resolveAllTemplateValues(trimmed);
  if (resolvedTerms && resolvedTerms.length > 0) {
    searchTerms.push(...resolvedTerms);
  }

  // Step 2: Add wildcard pattern as fallback
  const parsed = parseTemplateVariableInput(trimmed);
  if (parsed.pattern && !searchTerms.includes(parsed.pattern)) {
    searchTerms.push(parsed.pattern);
  }

  // Step 3: Add original templated string so users can select the variable
  if (!searchTerms.includes(trimmed)) {
    searchTerms.push(trimmed);
  }

  // Remove duplicates while preserving order
  return [...new Set(searchTerms)];
}

/**
 * Resolve template variables to all their possible values
 * Returns array of all resolved combinations
 */
function resolveAllTemplateValues(input: string): string[] | null {
  try {
    const templateSrv = getTemplateSrv();
    
    if (!templateSrv || typeof templateSrv.replace !== 'function') {
      return null;
    }

    // Use templateSrv.replace with multi-value expansion
    // This should handle cases where variables have multiple values
    const resolved = templateSrv.replace(input, undefined, 'pipe'); // 'pipe' format gives us all values
    
    // If the result is the same as input, resolution failed
    if (resolved === input) {
      return null;
    }

    // If resolved contains pipe separator, split into multiple terms
    if (typeof resolved === 'string' && resolved.includes('|')) {
      return resolved.split('|').map(term => term.trim()).filter(term => term.length > 0);
    }

    // Single resolved value
    return [resolved];
  } catch (error) {
    console.warn('[TemplateVariableResolver] Failed to resolve template variables:', error);
    return null;
  }
}


/**
 * Generate search strategies using the new multi-value approach
 * This maintains compatibility with existing tests while using the improved logic
 */
export function generateSearchStrategies(input: string): SearchStrategy[] {
  const searchTerms = getAllSearchTerms(input);
  const strategies: SearchStrategy[] = [];

  for (let i = 0; i < searchTerms.length; i++) {
    const term = searchTerms[i];
    
    if (term === input) {
      // Original templated string
      if (hasTemplateVariables(input)) {
        strategies.push({
          type: 'literal',
          searchTerm: term,
          description: 'Template variable (use as-is)'
        });
      } else {
        strategies.push({
          type: 'literal',
          searchTerm: term,
          description: 'Exact match'
        });
      }
    } else if (term.includes('*')) {
      // Wildcard pattern
      strategies.push({
        type: 'pattern',
        searchTerm: term,
        description: 'Pattern matching with wildcards'
      });
    } else {
      // Resolved value
      strategies.push({
        type: 'resolved',
        searchTerm: term,
        description: i === 0 ? 'Resolved variable' : `Resolved variable (${i + 1})`
      });
    }
  }

  return strategies;
}

/**
 * Get the best (first) search strategy for an input
 */
export function getBestSearchStrategy(input: string): SearchStrategy {
  const strategies = generateSearchStrategies(input);
  return strategies[0];
}

/**
 * Get the best search term for simple cases (just returns the first search term)
 */
export function getBestSearchTerm(input: string): string {
  const terms = getAllSearchTerms(input);
  return terms[0];
}
