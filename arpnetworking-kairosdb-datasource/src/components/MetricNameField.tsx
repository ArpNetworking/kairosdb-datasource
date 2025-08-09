import React from 'react';
import { InlineField, AsyncSelect } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { DataSource } from '../datasource';

interface Props {
  metricName: string;
  onChange: (metricName: string) => void;
  datasource?: DataSource;
}

export function MetricNameField({ metricName = '', onChange, datasource }: Props) {
  const loadOptions = async (inputValue: string): Promise<Array<SelectableValue<string>>> => {
    if (!datasource) {
      return [];
    }

    if (inputValue.length < 2) {
      return [];
    }

    // Don't try to load options for template variables
    if (inputValue.includes('$') || inputValue.includes('{')) {
      return [];
    }

    try {
      const metrics = await datasource.getMetricNames(inputValue);
      return metrics.map(metric => ({
        label: metric,
        value: metric
      }));
    } catch (error) {
      console.error('[MetricNameField] Error loading metric names:', error);
      return [];
    }
  };

  const handleSelectionChange = (option: SelectableValue<string> | null) => {
    const value = option?.value || '';
    onChange(value);
  };

  const handleInputChange = (inputValue: string) => {
    // For template variables (starting with $ or containing variables), update immediately
    if (inputValue.includes('$') || inputValue.includes('{')) {
      onChange(inputValue);
    }
    // Otherwise, let AsyncSelect handle typing vs selection through handleSelectionChange
  };

  // Convert current string value to SelectableValue for AsyncSelect
  const currentValue: SelectableValue<string> | undefined = metricName ? {
    label: metricName,
    value: metricName
  } : undefined;

  return (
    <InlineField 
      label="Metric Name" 
      labelWidth={20}
      tooltip="Start typing to search for available metrics. Use ^ prefix (e.g., '^system') for prefix matching, or template variables (e.g., '$metric_name')."
      required
    >
      <AsyncSelect
        width={50}
        value={currentValue}
        placeholder="Type to search (use ^ for prefix search)..."
        loadOptions={loadOptions}
        onChange={handleSelectionChange}
        onInputChange={handleInputChange}
        allowCustomValue={true}
        defaultOptions={false}
        cacheOptions={true}
        isClearable={true}
        backspaceRemovesValue={false}
        noOptionsMessage="No metrics found"
        loadingMessage="Loading metrics..."
        onBlur={() => {}}
      />
    </InlineField>
  );
}