import React, { useState } from 'react';
import { InlineField, AsyncSelect, Input } from '@grafana/ui';
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
  
  const [isLoading, setIsLoading] = useState(false);

  const loadOptions = async (inputValue: string): Promise<Array<SelectableValue<string>>> => {
    console.log('[MetricNameField] loadOptions called with inputValue:', inputValue);
    
    if (!datasource || inputValue.length < 1) {
      console.log('[MetricNameField] No datasource or short input, returning empty array');
      return [];
    }

    setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  const [inputValue, setInputValue] = React.useState(metricName);

  // Update local state when prop changes
  React.useEffect(() => {
    setInputValue(metricName);
  }, [metricName]);

  const handleInputChange = (inputValue: string) => {
    console.log('[MetricNameField] handleInputChange called with:', inputValue);
    setInputValue(inputValue);
    // Also update the parent immediately
    onChange(inputValue);
  };

  const handleSelectionChange = (option: SelectableValue<string> | null) => {
    console.log('[MetricNameField] handleSelectionChange called with:', option);
    const value = option?.value || '';
    console.log('[MetricNameField] Calling onChange with:', value);
    setInputValue(value);
    onChange(value);
  };

  const handleBlur = () => {
    console.log('[MetricNameField] handleBlur - persisting inputValue:', inputValue);
    // Ensure the current input value is saved on blur
    onChange(inputValue);
  };

  return (
    <InlineField 
      label="Metric Name" 
      labelWidth={12}
      tooltip="Start typing to search for available metrics"
      required
    >
      <div>
        {/* Temporarily use a simple Input to debug state management */}
        <Input
          id="metric-name-field"
          width={40}
          value={inputValue}
          placeholder="Type metric name..."
          onChange={(e) => handleInputChange(e.currentTarget.value)}
          onBlur={handleBlur}
        />
        <div style={{ fontSize: '10px', color: 'gray', marginTop: '2px' }}>
          Debug: inputValue="{inputValue}", metricName="{metricName}"
        </div>
      </div>
    </InlineField>
  );
}