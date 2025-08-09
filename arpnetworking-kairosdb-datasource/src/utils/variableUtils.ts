import { ScopedVars } from '@grafana/data';
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
   */
  static parse(query: string): VariableQuery | null {
    console.log('[VariableQueryParser] Parsing query:', query, 'type:', typeof query, 'length:', query ? query.length : 'undefined');
    
    // Remove whitespace
    const cleanQuery = query.trim();
    console.log('[VariableQueryParser] Clean query:', cleanQuery);
    
    // Metrics query: metrics(pattern)
    const metricsMatch = cleanQuery.match(/^metrics\(\s*(.+)\s*\)$/i);
    if (metricsMatch) {
      const pattern = metricsMatch[1].replace(/['"]/g, ''); // Remove quotes
      console.log('[VariableQueryParser] Parsed metrics query with pattern:', pattern);
      return { type: 'metrics', pattern };
    }
    
    // Tag names query: tag_names(metric)
    const tagNamesMatch = cleanQuery.match(/^tag_names\(\s*(.+)\s*\)$/i);
    if (tagNamesMatch) {
      const metric = tagNamesMatch[1].replace(/['"]/g, ''); // Remove quotes
      console.log('[VariableQueryParser] Parsed tag_names query with metric:', metric);
      return { type: 'tag_names', metric };
    }
    
    // Tag values query: tag_values(metric, tag_name [, filter1=value1, filter2=value2...])
    const tagValuesMatch = cleanQuery.match(/^tag_values\(\s*(.+)\s*\)$/i);
    if (tagValuesMatch) {
      const params = this.parseParameters(tagValuesMatch[1]);
      
      if (params.length >= 2) {
        const metric = params[0].replace(/['"]/g, '');
        const tagName = params[1].replace(/['"]/g, '');
        
        // Parse filters from remaining parameters
        const filters: { [key: string]: string } = {};
        for (let i = 2; i < params.length; i++) {
          const filterMatch = params[i].match(/^(.+?)=(.+)$/);
          if (filterMatch) {
            const key = filterMatch[1].trim().replace(/['"]/g, '');
            const value = filterMatch[2].trim().replace(/['"]/g, '');
            filters[key] = value;
          }
        }
        
        console.log('[VariableQueryParser] Parsed tag_values query:', { metric, tagName, filters });
        return { type: 'tag_values', metric, tagName, filters };
      }
    }
    
    console.warn('[VariableQueryParser] Could not parse query:', query);
    return null;
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
    console.log('[VariableQueryExecutor] Executing query:', query);
    
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
  private async executeMetricsQuery(pattern: string, scopedVars?: ScopedVars): Promise<Array<{ text: string; value: string }>> {
    console.log('[VariableQueryExecutor] Executing metrics query with pattern:', pattern);
    
    // Interpolate variables in pattern
    const interpolatedPattern = this.interpolateVariables(pattern, scopedVars);
    console.log('[VariableQueryExecutor] Interpolated pattern:', interpolatedPattern);
    
    // Get filtered metric names (let the datasource handle filtering)
    const filteredMetrics = await this.datasource.getMetricNames(interpolatedPattern);
    
    console.log('[VariableQueryExecutor] Found', filteredMetrics.length, 'metrics matching pattern');
    return filteredMetrics.map(metric => ({ text: metric, value: metric }));
  }
  
  /**
   * Execute tag_names(metric) query
   */
  private async executeTagNamesQuery(metric: string, scopedVars?: ScopedVars): Promise<Array<{ text: string; value: string }>> {
    console.log('[VariableQueryExecutor] Executing tag_names query for metric:', metric);
    
    // Interpolate variables in metric name
    const interpolatedMetric = this.interpolateVariables(metric, scopedVars);
    console.log('[VariableQueryExecutor] Interpolated metric:', interpolatedMetric);
    
    // Get tags for the metric
    const tags = await this.datasource.getMetricTags(interpolatedMetric);
    
    // Extract tag names (keys)
    const tagNames = Object.keys(tags);
    
    console.log('[VariableQueryExecutor] Found tag names:', tagNames);
    return tagNames.map(tagName => ({ text: tagName, value: tagName }));
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
    console.log('[VariableQueryExecutor] Executing tag_values query:', { metric, tagName, filters });
    
    // Interpolate variables
    const interpolatedMetric = this.interpolateVariables(metric, scopedVars);
    const interpolatedTagName = this.interpolateVariables(tagName, scopedVars);
    
    // Interpolate filter values
    const interpolatedFilters: { [key: string]: string } = {};
    Object.keys(filters).forEach(key => {
      interpolatedFilters[key] = this.interpolateVariables(filters[key], scopedVars);
    });
    
    console.log('[VariableQueryExecutor] Interpolated values:', { 
      metric: interpolatedMetric, 
      tagName: interpolatedTagName, 
      filters: interpolatedFilters 
    });
    
    // For now, get all tags and filter (future enhancement: use KairosDB filtering)
    const tags = await this.datasource.getMetricTags(interpolatedMetric);
    
    if (!tags[interpolatedTagName]) {
      console.warn('[VariableQueryExecutor] Tag not found:', interpolatedTagName);
      return [];
    }
    
    let tagValues = tags[interpolatedTagName] || [];
    
    // Apply filters (this is a simplified implementation)
    // In a full implementation, you'd want to query KairosDB with filters
    if (Object.keys(interpolatedFilters).length > 0) {
      console.log('[VariableQueryExecutor] Filters detected but not fully implemented in tag values query');
      // For now, return all values - full filtering would require additional KairosDB queries
    }
    
    console.log('[VariableQueryExecutor] Found tag values:', tagValues);
    return tagValues.map(value => ({ text: value, value: value }));
  }
  
  /**
   * Simple variable interpolation (this matches the pattern from datasource.ts)
   */
  private interpolateVariables(value: string, scopedVars?: ScopedVars): string {
    if (!value || !scopedVars) {
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