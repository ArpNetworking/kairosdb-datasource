import React, { useState } from 'react';
import { Button, Card, Stack, Input, Select, Switch, InlineField, Collapse } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { Aggregator, AggregatorParameter } from '../types';

interface Props {
  aggregator: Aggregator;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onParameterChange: (parameterName: string, value: any) => void;
}

export function AggregatorItem({ 
  aggregator, 
  index, 
  isFirst, 
  isLast, 
  onRemove, 
  onMoveUp, 
  onMoveDown,
  onParameterChange
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleParameterChange = (param: AggregatorParameter, value: any) => {
    onParameterChange(param.name, value);
  };

  const renderParameter = (param: AggregatorParameter) => {
    if (!param || !param.name) return null;
    const key = `${aggregator.name || 'unknown'}-${param.name}`;
    const paramValue = param.value || '';
    
    switch (param.type) {
      case 'enum':
        const enumOptions = getEnumOptions(param.name);
        return (
          <InlineField key={key} label={param.name} labelWidth={12}>
            <Select
              width={20}
              value={paramValue ? { label: paramValue, value: paramValue } : null}
              options={enumOptions}
              onChange={(option) => handleParameterChange(param, option?.value)}
            />
          </InlineField>
        );
        
      case 'sampling_unit':
        const unitOptions = [
          { label: 'milliseconds', value: 'milliseconds' },
          { label: 'seconds', value: 'seconds' },
          { label: 'minutes', value: 'minutes' },
          { label: 'hours', value: 'hours' },
          { label: 'days', value: 'days' },
          { label: 'weeks', value: 'weeks' },
          { label: 'months', value: 'months' },
          { label: 'years', value: 'years' }
        ];
        return (
          <InlineField key={key} label={param.name} labelWidth={12}>
            <Select
              width={20}
              value={paramValue ? { label: paramValue, value: paramValue } : null}
              options={unitOptions}
              onChange={(option) => handleParameterChange(param, option?.value)}
            />
          </InlineField>
        );
        
      case 'sampling':
        return (
          <InlineField key={key} label={param.name} labelWidth={12}>
            <Stack direction="row" gap={1} alignItems="center">
              <Input
                width={15}
                type="number"
                value={paramValue || ''}
                onChange={(e) => handleParameterChange(param, parseFloat(e.currentTarget.value) || 0)}
              />
              {param.autoValue !== undefined && (
                <InlineField label="Auto" labelWidth={6}>
                  <Switch
                    value={param.autoValue || false}
                    onChange={(value) => {
                      // Update the autoValue property
                      const updatedParam = { ...param, autoValue: value };
                      onParameterChange(param.name, value ? 'auto' : paramValue);
                    }}
                  />
                </InlineField>
              )}
            </Stack>
          </InlineField>
        );
        
      default:
        return (
          <InlineField key={key} label={param.name} labelWidth={12}>
            <Input
              width={20}
              value={paramValue || ''}
              onChange={(e) => handleParameterChange(param, e.currentTarget.value)}
            />
          </InlineField>
        );
    }
  };

  return (
    <Card>
      <Card.Body>
        <Stack direction="column" gap={1}>
          <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" gap={1} alignItems="center">
              <strong style={{ fontSize: '14px' }}>{aggregator.name || 'Unknown'}</strong>
              {(aggregator.parameters || []).length > 0 && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setIsExpanded(!isExpanded)}
                  icon={isExpanded ? 'angle-up' : 'angle-down'}
                >
                  {(aggregator.parameters || []).length} param{(aggregator.parameters || []).length !== 1 ? 's' : ''}
                </Button>
              )}
            </Stack>
            
            <Stack direction="row" gap={0}>
              <Button
                variant="secondary"
                size="xs"
                onClick={onMoveUp}
                disabled={isFirst}
                icon="arrow-up"
                tooltip="Move up"
              />
              <Button
                variant="secondary"
                size="xs"
                onClick={onMoveDown}
                disabled={isLast}
                icon="arrow-down"
                tooltip="Move down"
              />
              <Button
                variant="destructive"
                size="xs"
                onClick={onRemove}
                icon="trash-alt"
                tooltip="Remove aggregator"
              />
            </Stack>
          </Stack>
          
          {isExpanded && (aggregator.parameters || []).length > 0 && (
            <div style={{ 
              marginTop: '8px',
              padding: '8px',
              backgroundColor: 'rgba(128, 128, 128, 0.05)',
              borderRadius: '4px'
            }}>
              <Stack direction="column" gap={1}>
                {(aggregator.parameters || []).map(renderParameter)}
              </Stack>
            </div>
          )}
        </Stack>
      </Card.Body>
    </Card>
  );
}

function getEnumOptions(parameterName: string): Array<SelectableValue<string>> {
  const enumMaps: { [key: string]: Array<SelectableValue<string>> } = {
    'unit': [
      { label: 'SECONDS', value: 'SECONDS' },
      { label: 'MINUTES', value: 'MINUTES' },
      { label: 'HOURS', value: 'HOURS' },
      { label: 'DAYS', value: 'DAYS' }
    ]
  };
  
  return enumMaps[parameterName] || [];
}