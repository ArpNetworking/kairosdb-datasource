import React from 'react';
import { InlineField, Input } from '@grafana/ui';
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