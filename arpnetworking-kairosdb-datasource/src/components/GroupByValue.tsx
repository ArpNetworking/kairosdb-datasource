import React from 'react';
import { InlineField, Input, Stack, Switch } from '@grafana/ui';
import { GroupByValue as GroupByValueType } from '../types';

interface Props {
  value?: GroupByValueType;
  onChange: (value?: GroupByValueType) => void;
}

export function GroupByValue({ value, onChange }: Props) {
  const isEnabled = !!value?.range_size;

  const handleEnabledChange = (event: any) => {
    // Extract boolean value from Grafana UI Switch component
    const enabled = event.currentTarget ? event.currentTarget.checked : event;
    
    if (enabled) {
      onChange({ range_size: 100 });
    } else {
      onChange(undefined);
    }
  };

  const handleRangeSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRangeSize = parseInt(event.target.value, 10);
    if (isNaN(newRangeSize)) {
      return;
    }
    onChange({
      range_size: newRangeSize
    });
  };

  return (
    <Stack direction="row" gap={1} alignItems="center">
      <InlineField label="Group by Value" labelWidth={20}>
        <Switch
          value={isEnabled}
          onChange={handleEnabledChange}
        />
      </InlineField>
      
      {isEnabled && (
        <InlineField label="Range Size" labelWidth={15}>
          <Input
            type="number"
            width={20}
            value={value?.range_size || 100}
            onChange={handleRangeSizeChange}
            placeholder="100"
            min={1}
          />
        </InlineField>
      )}
    </Stack>
  );
}