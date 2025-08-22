import { ScopedVars } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { DataSource } from '../datasource';

export interface VariableQuery {
  type: 'metrics' | 'tag_names' | 'tag_values';
  metric?: string;
  tagName?: string;
  pattern?: string;
  filters?: { [key: string]: string };
}

export class VariableQueryParser {
  /**
   * Parse variable query string into structured format
   * Supports:
   * - metrics(pattern)
   * - tag_names(metric)
   * - tag_values(metric, tag_name [, filter1=value1, filter2=value2...])
   * 
   * Also handles legacy formats for backwards compatibility
   */
  static parse(query: string): VariableQuery | null {
    // Remove whitespace
    const cleanQuery = query.trim();

    // Handle legacy format conversions
    const legacyConverted = this.convertLegacyFormat(cleanQuery);
    if (legacyConverted !== cleanQuery) {
      return this.parse(legacyConverted);
    }

    // Metrics query: metrics(pattern)
    // Also support regex patterns like ^metrics\(([\\S ]+)\)$ from old version
    const metricsMatch = cleanQuery.match(/^metrics\s*\(\s*(.*?)\s*\)$/i);
    if (metricsMatch) {
      const pattern = this.cleanParameter(metricsMatch[1]);
      return { type: 'metrics', pattern };
    }

    // Tag names query: tag_names(metric)
    const tagNamesMatch = cleanQuery.match(/^tag_names\s*\(\s*(.*?)\s*\)$/i);
    if (tagNamesMatch) {
      const metric = this.cleanParameter(tagNamesMatch[1]);
      return { type: 'tag_names', metric };
    }

    // Tag values query - support both new and legacy formats:
    // New format: tag_values(metric, tag_name, filter1=value1, filter2=value2, ...)
    // Legacy format: tag_values(metric, filter1=value1, filter2=value2, ..., tag_name)
    const tagValuesMatch = cleanQuery.match(/^tag_values\s*\(\s*(.+)\s*\)$/i);
    if (tagValuesMatch) {
      const params = this.parseParameters(tagValuesMatch[1]);

      if (params.length >= 2) {
        const metric = this.cleanParameter(params[0]);
        
        // Detect format by checking if 2nd parameter contains '=' (filter)
        const secondParam = params[1]?.trim() || '';
        const isLegacyFormat = secondParam.includes('=');
        
        let tagName: string;
        let filterStartIndex: number;
        let filterEndIndex: number;
        
        if (isLegacyFormat) {
          // Legacy format: tag_values(metric, filter1=value1, ..., tag_name)
          tagName = this.cleanParameter(params[params.length - 1]);
          filterStartIndex = 1;
          filterEndIndex = params.length - 1;
        } else {
          // New format: tag_values(metric, tag_name, filter1=value1, ...)
          tagName = this.cleanParameter(params[1]);
          filterStartIndex = 2;
          filterEndIndex = params.length;
        }

        // Parse filters
        const filters: { [key: string]: string } = {};
        for (let i = filterStartIndex; i < filterEndIndex; i++) {
          const param = params[i]?.trim();
          
          // Skip empty parameters
          if (!param) {continue;}
          
          // Check if it's a filter (contains =)
          const filterMatch = param.match(/^(.+?)=(.+)$/);
          if (filterMatch) {
            const key = this.cleanParameter(filterMatch[1]);
            const value = this.cleanParameter(filterMatch[2]);
            filters[key] = value;
          }
        }

        return { type: 'tag_values', metric, tagName, filters };
      }
    }

    return null;
  }

  /**
   * Convert legacy query formats to modern format
   */
  private static convertLegacyFormat(query: string): string {
    // Handle old-style function calls with extra spaces or different formatting
    let converted = query.trim();
    
    // Normalize spacing around parentheses
    converted = converted.replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ')');
    
    // Handle legacy tag_values format that might have had different syntax
    // If we see tag_values with more than 2 parameters before filters, handle it
    const tagValuesMatch = converted.match(/^tag_values\s*\(\s*([^)]+)\s*\)$/i);
    if (tagValuesMatch) {
      const params = this.parseParameters(tagValuesMatch[1]);
      if (params.length >= 3) {
        // Check if 3rd parameter looks like a filter (contains =)
        if (params[2] && !params[2].includes('=')) {
          // This might be an old format where there was a 3rd parameter before filters
          // For now, we'll ignore that parameter and treat everything from the 3rd parameter onwards as filters
        }
      }
    }
    
    return converted;
  }

  /**
   * Clean parameter by removing quotes and trimming whitespace
   */
  private static cleanParameter(param: string): string {
    return param.trim().replace(/^["']|["']$/g, '');
  }

  /**
   * Parse comma-separated parameters, respecting quotes and nested commas
   */
  private static parseParameters(paramString: string): string[] {
    const params: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < paramString.length; i++) {
      const char = paramString[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } else if (char === ',' && !inQuotes) {
        params.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      params.push(current.trim());
    }

    return params;
  }
}

export class VariableQueryExecutor {
  constructor(private datasource: DataSource) {}

  /**
   * Execute a parsed variable query
   */
  async execute(query: VariableQuery, scopedVars?: ScopedVars): Promise<Array<{ text: string; value: string }>> {
    try {
      switch (query.type) {
        case 'metrics':
          return await this.executeMetricsQuery(query.pattern || '', scopedVars);

        case 'tag_names':
          return await this.executeTagNamesQuery(query.metric || '', scopedVars);

        case 'tag_values':
          return await this.executeTagValuesQuery(
            query.metric || '',
            query.tagName || '',
            query.filters || {},
            scopedVars
          );

        default:
          console.warn('[VariableQueryExecutor] Unknown query type:', query);
          return [];
      }
    } catch (error) {
      console.error('[VariableQueryExecutor] Error executing query:', error);
      return [];
    }
  }

  /**
   * Execute metrics(pattern) query
   */
  private async executeMetricsQuery(
    pattern: string,
    scopedVars?: ScopedVars
  ): Promise<Array<{ text: string; value: string }>> {
    // Interpolate variables in pattern
    const interpolatedPattern = this.interpolateVariables(pattern, scopedVars);

    // Get filtered metric names (let the datasource handle filtering)
    const filteredMetrics = await this.datasource.getMetricNames(interpolatedPattern);

    return filteredMetrics.map((metric) => ({ text: metric, value: metric }));
  }

  /**
   * Execute tag_names(metric) query
   */
  private async executeTagNamesQuery(
    metric: string,
    scopedVars?: ScopedVars
  ): Promise<Array<{ text: string; value: string }>> {
    // Interpolate variables in metric name
    const interpolatedMetric = this.interpolateVariables(metric, scopedVars);

    // Get tags for the metric
    const tags = await this.datasource.getMetricTags(interpolatedMetric);

    // Extract tag names (keys)
    const tagNames = Object.keys(tags);

    return tagNames.map((tagName) => ({ text: tagName, value: tagName }));
  }

  /**
   * Execute tag_values(metric, tag_name, filters...) query
   */
  private async executeTagValuesQuery(
    metric: string,
    tagName: string,
    filters: { [key: string]: string },
    scopedVars?: ScopedVars
  ): Promise<Array<{ text: string; value: string }>> {
    // Interpolate variables
    const interpolatedMetric = this.interpolateVariables(metric, scopedVars);
    const interpolatedTagName = this.interpolateVariables(tagName, scopedVars);

    // Interpolate filter values and convert to KairosDB filter format
    const kairosFilters: { [key: string]: string[] } = {};
    Object.keys(filters).forEach((key) => {
      const interpolatedValue = this.interpolateVariables(filters[key], scopedVars);
      
      // Skip filters with empty or undefined values, or values that are still variables (not interpolated)
      if (interpolatedValue && 
          interpolatedValue.trim() !== '' && 
          !interpolatedValue.startsWith('$')) {
        
        // Handle multi-value variables (comma-separated)
        const values = interpolatedValue.includes(',')
          ? interpolatedValue.split(',').map(v => v.trim()).filter(v => v !== '')
          : [interpolatedValue];
        
        if (values.length > 0) {
          kairosFilters[key] = values;
        }
      }
    });

    // Use the new method with filters
    const tags = await this.datasource.getMetricTagsWithFilters(interpolatedMetric, kairosFilters);

    if (!tags[interpolatedTagName]) {
      console.warn('[VariableQueryExecutor] Tag not found:', interpolatedTagName);
      return [];
    }

    const tagValues = tags[interpolatedTagName] || [];
    return tagValues.map((value) => ({ text: value, value: value }));
  }

  /**
   * Simple variable interpolation (this matches the pattern from datasource.ts)
   */
  private interpolateVariables(value: string, scopedVars?: ScopedVars): string {
    if (!value) {
      return value;
    }

    try {
      // Use Grafana's built-in template service for variable interpolation
      const templateSrv = getTemplateSrv();
      if (templateSrv && templateSrv.replace) {
        return templateSrv.replace(value, scopedVars);
      }
      throw new Error('Template service not available');
    } catch (error) {
      console.warn(
        '[VariableQueryExecutor] Error interpolating variables, falling back to custom implementation:',
        error
      );

      // Fallback to custom implementation if Grafana's service fails
      if (!scopedVars) {
        return value;
      }

      // Handle both $variable and ${variable} syntax
      return value
        .replace(/\$\{([^}]+)\}/g, (match, varName) => {
          // Handle ${variable} syntax (with potential format specifiers)
          const [name, format] = varName.split(':');
          const variable = scopedVars[name];
          return variable ? this.formatVariable(variable.value, format) : match;
        })
        .replace(/\$(\w+)/g, (match, varName) => {
          // Handle $variable syntax
          const variable = scopedVars[varName];
          return variable ? this.formatVariable(variable.value) : match;
        });
    }
  }

  private formatVariable(value: any, format?: string): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    // Handle array values (multi-value variables)
    if (Array.isArray(value)) {
      switch (format) {
        case 'pipe':
          return value.join('|');
        case 'regex':
          return `(${value.join('|')})`;
        case 'distributed':
          // For distributed queries, each value should be handled separately
          return value.join(',');
        default:
          return value.join(',');
      }
    }

    return String(value);
  }
}
