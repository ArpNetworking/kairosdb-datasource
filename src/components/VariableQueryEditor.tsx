import React, { useState, useEffect } from 'react';
import { InlineField, InlineFieldRow, Input, Select, Button, Stack, Card, Alert, AsyncSelect } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { DataSource } from '../datasource';

interface Props {
  datasource: DataSource;
  query: string;
  onChange: (query: string) => void;
}

interface VariableQueryState {
  type: 'metrics' | 'tag_names' | 'tag_values' | 'custom';
  pattern?: string;
  metric?: string;
  tagName?: string;
  filters: Array<{ key: string; value: string; id: string }>;
  customQuery?: string;
}

const QUERY_TYPE_OPTIONS: Array<SelectableValue<string>> = [
  { label: 'Metrics (pattern)', value: 'metrics', description: 'Find metric names containing a pattern' },
  { label: 'Tag Names', value: 'tag_names', description: 'Get tag names for a specific metric' },
  { label: 'Tag Values', value: 'tag_values', description: 'Get tag values with optional filters' },
  { label: 'Custom Query', value: 'custom', description: 'Write custom variable query' },
];

export function VariableQueryEditor({ datasource, query, onChange }: Props) {
  const [state, setState] = useState<VariableQueryState>(() => {
    return parseQueryToState(query);
  });

  const [metrics, setMetrics] = useState<string[]>([]);
  const [tags, setTags] = useState<{ [key: string]: string[] }>({});

  // Load available metrics on mount
  useEffect(() => {
    loadMetrics();
  }, []);

  // Load tags when metric changes
  useEffect(() => {
    if (state.metric && (state.type === 'tag_names' || state.type === 'tag_values')) {
      loadTags(state.metric);
    }
  }, [state.metric, state.type]);

  // Update query string when state changes
  useEffect(() => {
    const queryString = buildQueryString(state);
    if (queryString !== query) {
      onChange(queryString);
    }
  }, [state]);

  const loadMetrics = async () => {
    try {
      const metricNames = await datasource.getMetricNames();
      setMetrics(metricNames);
    } catch (error) {
      console.error('[VariableQueryEditor] Error loading metrics:', error);
    }
  };

  const loadTags = async (metric: string) => {
    try {
      const metricTags = await datasource.getMetricTags(metric);
      setTags(metricTags);
    } catch (error) {
      console.error('[VariableQueryEditor] Error loading tags for metric:', metric, error);
      setTags({});
    }
  };

  const handleTypeChange = (option: SelectableValue<string>) => {
    setState((prev) => ({
      ...prev,
      type: (option.value as any) || 'metrics',
      // Reset other fields when type changes
      pattern: undefined,
      metric: undefined,
      tagName: undefined,
      filters: [],
      customQuery: undefined,
    }));
  };

  const handlePatternChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({
      ...prev,
      pattern: event.target.value,
    }));
  };

  const handleMetricChange = (option: SelectableValue<string>) => {
    setState((prev) => ({
      ...prev,
      metric: option.value || undefined,
    }));
  };

  const handleTagNameChange = (option: SelectableValue<string>) => {
    setState((prev) => ({
      ...prev,
      tagName: option.value || undefined,
    }));
  };

  const handleCustomQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({
      ...prev,
      customQuery: event.target.value,
    }));
  };

  const addFilter = () => {
    setState((prev) => ({
      ...prev,
      filters: [...prev.filters, { key: '', value: '', id: Date.now().toString() }],
    }));
  };

  const updateFilter = (id: string, field: 'key' | 'value', newValue: string) => {
    setState((prev) => ({
      ...prev,
      filters: prev.filters.map((filter) => (filter.id === id ? { ...filter, [field]: newValue } : filter)),
    }));
  };

  const removeFilter = (id: string) => {
    setState((prev) => ({
      ...prev,
      filters: prev.filters.filter((filter) => filter.id !== id),
    }));
  };

  const getMetricOptions = (inputValue: string): Promise<Array<SelectableValue<string>>> => {
    return Promise.resolve(
      metrics
        .filter((metric) => !inputValue || metric.toLowerCase().includes(inputValue.toLowerCase()))
        .slice(0, 100) // Limit results for performance
        .map((metric) => ({ label: metric, value: metric }))
    );
  };

  const getTagNameOptions = (): Array<SelectableValue<string>> => {
    return Object.keys(tags).map((tagName) => ({ label: tagName, value: tagName }));
  };

  const renderQueryTypeFields = () => {
    switch (state.type) {
      case 'metrics':
        return (
          <InlineFieldRow>
            <InlineField label="Pattern" tooltip="Pattern to match in metric names">
              <Input
                width={30}
                value={state.pattern || ''}
                onChange={handlePatternChange}
                placeholder="e.g., cpu, disk.usage"
              />
            </InlineField>
          </InlineFieldRow>
        );

      case 'tag_names':
        return (
          <InlineFieldRow>
            <InlineField label="Metric" tooltip="Metric name to get tag names for">
              <AsyncSelect
                width={30}
                value={state.metric ? { label: state.metric, value: state.metric } : null}
                loadOptions={getMetricOptions}
                defaultOptions
                onChange={handleMetricChange}
                placeholder="Select or type metric name"
              />
            </InlineField>
          </InlineFieldRow>
        );

      case 'tag_values':
        const tagNameOptions = getTagNameOptions();

        return (
          <Stack direction="column" gap={1}>
            <InlineFieldRow>
              <InlineField label="Metric" tooltip="Metric name to get tag values for">
                <AsyncSelect
                  width={30}
                  value={state.metric ? { label: state.metric, value: state.metric } : null}
                  loadOptions={getMetricOptions}
                  defaultOptions
                  onChange={handleMetricChange}
                  placeholder="Select or type metric name"
                />
              </InlineField>
            </InlineFieldRow>

            {state.metric && (
              <InlineFieldRow>
                <InlineField label="Tag Name" tooltip="Tag name to get values for">
                  <Select
                    width={30}
                    value={state.tagName ? { label: state.tagName, value: state.tagName } : null}
                    options={tagNameOptions}
                    onChange={handleTagNameChange}
                    placeholder="Select tag name"
                  />
                </InlineField>
              </InlineFieldRow>
            )}

            {/* Filters */}
            {state.filters.length > 0 && (
              <Card>
                <Card.Heading>Filters (optional)</Card.Heading>
                <Card.Description>
                  <Stack direction="column" gap={1}>
                    {state.filters.map((filter) => (
                      <InlineFieldRow key={filter.id}>
                        <InlineField label="Tag">
                          <Input
                            width={12}
                            value={filter.key}
                            onChange={(e) => updateFilter(filter.id, 'key', e.currentTarget.value)}
                            placeholder="tag name"
                          />
                        </InlineField>
                        <InlineField label="Value">
                          <Input
                            width={12}
                            value={filter.value}
                            onChange={(e) => updateFilter(filter.id, 'value', e.currentTarget.value)}
                            placeholder="tag value or $variable"
                          />
                        </InlineField>
                        <Button
                          variant="destructive"
                          size="sm"
                          icon="trash-alt"
                          onClick={() => removeFilter(filter.id)}
                        />
                      </InlineFieldRow>
                    ))}
                  </Stack>
                </Card.Description>
              </Card>
            )}

            <InlineFieldRow>
              <Button variant="secondary" size="sm" icon="plus" onClick={addFilter}>
                Add Filter
              </Button>
            </InlineFieldRow>
          </Stack>
        );

      case 'custom':
        return (
          <InlineFieldRow>
            <InlineField label="Query" tooltip="Custom variable query">
              <Input
                width={50}
                value={state.customQuery || ''}
                onChange={handleCustomQueryChange}
                placeholder="metrics(pattern) | tag_names(metric) | tag_values(metric, tag_name, filter1=value1)"
              />
            </InlineField>
          </InlineFieldRow>
        );

      default:
        return null;
    }
  };

  const getExampleQuery = () => {
    switch (state.type) {
      case 'metrics':
        return 'metrics(cpu)';
      case 'tag_names':
        return 'tag_names(system.cpu.usage)';
      case 'tag_values':
        return 'tag_values(system.cpu.usage, host)';
      default:
        return '';
    }
  };

  return (
    <Stack direction="column" gap={2}>
      <InlineFieldRow>
        <InlineField label="Query Type" tooltip="Type of variable query to create">
          <Select
            width={20}
            value={QUERY_TYPE_OPTIONS.find((opt) => opt.value === state.type)}
            options={QUERY_TYPE_OPTIONS}
            onChange={handleTypeChange}
          />
        </InlineField>
      </InlineFieldRow>

      {renderQueryTypeFields()}

      {state.type !== 'custom' && (
        <Alert severity="info" title="Generated Query">
          <code>{buildQueryString(state) || getExampleQuery()}</code>
        </Alert>
      )}

      <Alert severity="info" title="Variable Query Examples">
        <div style={{ fontSize: '12px' }}>
          <strong>Metrics:</strong> <code>metrics(cpu)</code> - Find metrics containing "cpu"
          <br />
          <strong>Tag Names:</strong> <code>tag_names(system.cpu.usage)</code> - Get tag names for metric
          <br />
          <strong>Tag Values:</strong> <code>tag_values(system.cpu.usage, host)</code> - Get host values
          <br />
          <strong>With Filters:</strong> <code>tag_values(system.cpu.usage, host, datacenter=us-east-1)</code>
          <br />
          <strong>With Variables:</strong> <code>tag_values($metric, host, region=$region)</code>
        </div>
      </Alert>
    </Stack>
  );
}

/**
 * Parse existing query string to populate editor state
 */
function parseQueryToState(query: string): VariableQueryState {
  if (!query) {
    return { type: 'metrics', filters: [] };
  }

  // Clean up legacy formatting
  const cleanedQuery = query.trim()
    .replace(/\s*\(\s*/g, '(')  // Remove spaces around parentheses
    .replace(/\s*\)\s*/g, ')');

  // Try to parse as function calls with more flexible regex
  const metricsMatch = cleanedQuery.match(/^metrics\s*\(\s*(.+?)\s*\)$/i);
  if (metricsMatch) {
    return {
      type: 'metrics',
      pattern: metricsMatch[1].trim().replace(/^["']|["']$/g, ''),
      filters: [],
    };
  }

  const tagNamesMatch = cleanedQuery.match(/^tag_names\s*\(\s*(.+?)\s*\)$/i);
  if (tagNamesMatch) {
    return {
      type: 'tag_names',
      metric: tagNamesMatch[1].trim().replace(/^["']|["']$/g, ''),
      filters: [],
    };
  }

  const tagValuesMatch = cleanedQuery.match(/^tag_values\s*\(\s*(.+)\s*\)$/i);
  if (tagValuesMatch) {
    const params = parseParameters(tagValuesMatch[1]);

    if (params.length >= 2) {
      const metric = params[0].trim().replace(/^["']|["']$/g, '');
      
      // Use the same detection logic as VariableQueryParser
      // Detect format by checking if 2nd parameter contains '=' (filter)
      const secondParam = params[1]?.trim() || '';
      const isLegacyFormat = secondParam.includes('=');
      
      let tagName: string;
      let filterStartIndex: number;
      let filterEndIndex: number;
      
      if (isLegacyFormat) {
        // Legacy format: tag_values(metric, filter1=value1, ..., tag_name)
        tagName = params[params.length - 1].trim().replace(/^["']|["']$/g, '');
        filterStartIndex = 1;
        filterEndIndex = params.length - 1;
      } else {
        // New format: tag_values(metric, tag_name, filter1=value1, ...)
        tagName = params[1].trim().replace(/^["']|["']$/g, '');
        filterStartIndex = 2;
        filterEndIndex = params.length;
      }

      const filters: Array<{ key: string; value: string; id: string }> = [];
      for (let i = filterStartIndex; i < filterEndIndex; i++) {
        const param = params[i]?.trim();
        if (!param) continue;
        
        const filterMatch = param.match(/^(.+?)=(.+)$/);
        if (filterMatch) {
          const key = filterMatch[1].trim().replace(/^["']|["']$/g, '');
          const value = filterMatch[2].trim().replace(/^["']|["']$/g, '');
          filters.push({ key, value, id: Date.now().toString() + i });
        }
      }

      return { type: 'tag_values', metric, tagName, filters };
    }
  }

  // Check if it's a simple metric pattern (backwards compatibility)
  if (!cleanedQuery.includes('(') && !cleanedQuery.includes(')')) {
    // Treat as a metric pattern query
    return {
      type: 'metrics',
      pattern: cleanedQuery,
      filters: [],
    };
  }

  // Fallback to custom query
  return { type: 'custom', customQuery: query, filters: [] };
}

/**
 * Build query string from editor state
 */
function buildQueryString(state: VariableQueryState): string {
  switch (state.type) {
    case 'metrics':
      return state.pattern ? `metrics(${state.pattern})` : '';

    case 'tag_names':
      return state.metric ? `tag_names(${state.metric})` : '';

    case 'tag_values':
      if (!state.metric || !state.tagName) {
        return '';
      }

      let query = `tag_values(${state.metric}, ${state.tagName}`;

      // Add filters
      const validFilters = state.filters.filter((f) => f.key && f.value);
      if (validFilters.length > 0) {
        const filterStrings = validFilters.map((f) => `${f.key}=${f.value}`);
        query += ', ' + filterStrings.join(', ');
      }

      query += ')';
      return query;

    case 'custom':
      return state.customQuery || '';

    default:
      return '';
  }
}

/**
 * Parse comma-separated parameters, respecting quotes
 */
function parseParameters(paramString: string): string[] {
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
