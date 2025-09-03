export interface ParsedInput {
  hasVariables: boolean;
  literalParts: string[];
  variables: string[];
  pattern: string;
}

/**
 * Parses a metric name input to identify template variables and literal parts
 * Supports both $variable and ${variable} syntax
 */
export function parseTemplateVariableInput(input: string): ParsedInput {
  if (!input) {
    return {
      hasVariables: false,
      literalParts: [],
      variables: [],
      pattern: ''
    };
  }

  const variables: string[] = [];
  const literalParts: string[] = [];
  
  // Regular expression to match variables: $variableName or ${variableName}
  // variableName can contain letters, numbers, and underscores
  const variableRegex = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}|\$([a-zA-Z_][a-zA-Z0-9_]*)/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = variableRegex.exec(input)) !== null) {
    // Add literal part before this variable (if any)
    if (match.index > lastIndex) {
      const literalPart = input.slice(lastIndex, match.index);
      if (literalPart) {
        literalParts.push(literalPart);
      }
    }
    
    // Add the variable (full match including $ or ${})
    variables.push(match[0]);
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining literal part after last variable (if any)
  if (lastIndex < input.length) {
    const remainingPart = input.slice(lastIndex);
    if (remainingPart) {
      literalParts.push(remainingPart);
    }
  }
  
  // If no variables found, treat entire input as literal
  const hasVariables = variables.length > 0;
  if (!hasVariables) {
    return {
      hasVariables: false,
      literalParts: [input],
      variables: [],
      pattern: input
    };
  }
  
  // Generate search pattern by replacing variables with wildcards
  const pattern = generateSearchPattern(input, variables);
  
  // Clean up literal parts by removing leading/trailing dots and empty parts  
  const cleanedLiteralParts = literalParts
    .map(part => part.replace(/^\.+|\.+$/g, '')) // Remove leading/trailing dots
    .filter(part => part.length > 0); // Remove empty parts
  
  return {
    hasVariables,
    literalParts: cleanedLiteralParts,
    variables,
    pattern
  };
}

/**
 * Generate a search pattern by replacing variables with wildcards
 * Uses * wildcards for flexible substring matching
 */
function generateSearchPattern(input: string, variables: string[]): string {
  let pattern = input;
  
  // Replace each variable with a wildcard
  for (const variable of variables) {
    // Escape special regex characters in the variable name
    const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pattern = pattern.replace(new RegExp(escapedVariable, 'g'), '*');
  }
  
  return pattern;
}


/**
 * Utility function to check if input contains template variables
 */
export function hasTemplateVariables(input: string): boolean {
  return /\$\{[a-zA-Z_][a-zA-Z0-9_]*\}|\$[a-zA-Z_][a-zA-Z0-9_]*/.test(input);
}

/**
 * Extract just the variable names (without $ or {}) for resolution
 */
export function extractVariableNames(variables: string[]): string[] {
  return variables.map(variable => {
    // Remove ${ } or $ prefix
    if (variable.startsWith('${') && variable.endsWith('}')) {
      return variable.slice(2, -1);
    } else if (variable.startsWith('$')) {
      return variable.slice(1);
    }
    return variable;
  });
}