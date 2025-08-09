import React from 'react';
import { InlineField, Input, Select, Stack, Switch } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { GroupByTime as GroupByTimeType } from '../types';

interface Props {
  time?: GroupByTimeType;
  onChange: (time?: GroupByTimeType) => void;
}

const TIME_UNITS: Array<SelectableValue<string>> = [
  { label: 'milliseconds', value: 'milliseconds' },
  { label: 'seconds', value: 'seconds' },
  { label: 'minutes', value: 'minutes' },
  { label: 'hours', value: 'hours' },
  { label: 'days', value: 'days' },
  { label: 'weeks', value: 'weeks' },
  { label: 'months', value: 'months' },
  { label: 'years', value: 'years' }
];

export function GroupByTime({ time, onChange }: Props) {
  const isEnabled = !!time?.value;

  const handleEnabledChange = (event: any) => {
    // Extract boolean value from Grafana UI Switch component
    const enabled = event.currentTarget ? event.currentTarget.checked : event;
    
    if (enabled) {
      onChange({ value: 1, unit: 'minutes' });
    } else {
      onChange(undefined);
    }
  };

  const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(event.target.value, 10);
    if (isNaN(newValue) || !time) {
      return;
    }
    onChange({
      ...time,
      value: newValue
    });
  };

  const handleUnitChange = (option: SelectableValue<string>) => {
    if (!option?.value || !time) {
      return;
    }
    onChange({
      ...time,
      unit: option.value
    });
  };

  const handleRangeSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRangeSize = parseInt(event.target.value, 10);
    if (isNaN(newRangeSize) || !time) {
      return;
    }
    onChange({
      ...time,
      range_size: newRangeSize
    });
  };

  return (
    <Stack direction="column" gap={1}>
      <InlineField label="Group by Time" labelWidth={15}>
        <Switch
          value={isEnabled}
          onChange={handleEnabledChange}
        />
      </InlineField>
      
      {isEnabled && time && (
        <Stack direction="column" gap={1}>
          <Stack direction="row" gap={1} alignItems="center">
            <InlineField label="Value" labelWidth={8}>
              <Input
                type="number"
                width={10}
                value={time.value}
                onChange={handleValueChange}
                placeholder="1"
                min={1}
              />
            </InlineField>
            
            <InlineField label="Unit" labelWidth={8}>
              <Select
                width={15}
                value={TIME_UNITS.find(unit => unit.value === time.unit)}
                options={TIME_UNITS}
                onChange={handleUnitChange}
              />
            </InlineField>
          </Stack>
          
          <InlineField 
            label="Range Size" 
            labelWidth={15}
            tooltip="Optional: Number of time periods to group together"
          >
            <Input
              type="number"
              width={15}
              value={time.range_size || ''}
              onChange={handleRangeSizeChange}
              placeholder="Optional"
              min={1}
            />
          </InlineField>
        </Stack>
      )}
    </Stack>
  );
}