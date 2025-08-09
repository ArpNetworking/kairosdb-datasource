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
  console.log('[MetricNameField] Render called with:', {
    metricName,
    hasOnChange: typeof onChange === 'function',
    hasDatasource: !!datasource,
    datasourceType: datasource?.constructor.name
  });

  const loadOptions = async (inputValue: string): Promise<Array<SelectableValue<string>>> => {
    console.log('[MetricNameField] loadOptions called with inputValue:', inputValue);
    
    if (!datasource) {
      console.log('[MetricNameField] No datasource available, returning empty array');
      return [];
    }

    if (inputValue.length < 2) {
      console.log('[MetricNameField] Input too short (minimum 2 chars), returning empty array');
      return [];
    }

    try {
      console.log('[MetricNameField] Calling datasource.getMetricNames');
      const metrics = await datasource.getMetricNames(inputValue);
      console.log('[MetricNameField] Received metrics:', metrics);
      
      const selectableOptions = metrics.map(metric => ({
        label: metric,
        value: metric
      }));
      console.log('[MetricNameField] Converted to selectable options:', selectableOptions);

      return selectableOptions;
    } catch (error) {
      console.error('[MetricNameField] Error loading metric names:', error);
      return [];
    }
  };

  const handleSelectionChange = (option: SelectableValue<string> | null) => {
    console.log('[MetricNameField] handleSelectionChange called with:', option);
    const value = option?.value || '';
    console.log('[MetricNameField] Calling onChange with:', value);
    onChange(value);
  };

  const handleInputChange = (inputValue: string) => {
    console.log('[MetricNameField] handleInputChange called with:', inputValue);
    // Don't call onChange here - let AsyncSelect handle typing vs selection
    // onChange will be called by handleSelectionChange when user selects/types a complete value
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
      tooltip="Start typing to search for available metrics. Use ^ prefix (e.g., '^system') for prefix matching, or regular search for 'contains' matching."
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
        onBlur={() => {
          console.log('[MetricNameField] onBlur triggered');
        }}
      />
    </InlineField>
  );
}