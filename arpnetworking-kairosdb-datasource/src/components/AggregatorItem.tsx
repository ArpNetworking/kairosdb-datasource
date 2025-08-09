import React from 'react';
import { Button, Stack, Input, Select, Switch, InlineField, Card } from '@grafana/ui';
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
  onAutoValueChange: (enabled: boolean) => void;
}

export function AggregatorItem({ 
  aggregator, 
  index, 
  isFirst, 
  isLast, 
  onRemove, 
  onMoveUp, 
  onMoveDown,
  onParameterChange,
  onAutoValueChange
}: Props) {

  const handleParameterChange = (param: AggregatorParameter, value: any) => {
    onParameterChange(param.name, value);
  };

  const validatePercentileValue = (value: number): string | null => {
    if (isNaN(value)) {
      return 'Percentile must be a valid number';
    }
    if (value < 0 || value > 1) {
      return 'Percentile must be between 0 and 1 (inclusive)';
    }
    return null;
  };

  const validateSamplingValue = (value: number): string | null => {
    if (isNaN(value)) {
      return 'Value must be a valid number';
    }
    if (value <= 0) {
      return 'Value must be greater than 0';
    }
    return null;
  };

  const isPercentileParameter = (param: AggregatorParameter): boolean => {
    return aggregator.name === 'percentile' && param.name === 'percentile';
  };

  const isSamplingParameter = (param: AggregatorParameter): boolean => {
    return param.type === 'sampling';
  };

  const getValidationError = (param: AggregatorParameter): string | null => {
    if (isPercentileParameter(param)) {
      const numValue = typeof param.value === 'string' ? parseFloat(param.value) : param.value;
      return validatePercentileValue(numValue);
    }
    if (isSamplingParameter(param) && !isAutoEnabled) {
      const numValue = typeof param.value === 'string' ? parseFloat(param.value) : param.value;
      return validateSamplingValue(numValue);
    }
    return null;
  };

  const isAutoEnabled = aggregator.autoValueSwitch?.enabled || false;
  const isDependentParameter = (param: AggregatorParameter) => {
    return aggregator.autoValueSwitch?.dependentParameters.includes(param.type) || false;
  };

  const renderParameter = (param: AggregatorParameter) => {
    if (!param || !param.name) return null;
    const key = `${aggregator.name || 'unknown'}-${param.name}`;
    const paramValue = param.value || '';
    
    // For dependent parameters when auto is enabled, show "auto" and disable
    const isParamDisabled = isAutoEnabled && isDependentParameter(param);
    
    switch (param.type) {
      case 'enum':
        const enumOptions = getEnumOptions(param.name);
        return (
          <InlineField key={key} label={param.name} labelWidth={8} transparent>
            <Select
              width={14}
              value={isParamDisabled ? { label: 'auto', value: 'auto' } : (paramValue ? { label: paramValue, value: paramValue } : null)}
              options={enumOptions}
              isDisabled={isParamDisabled}
              onChange={(option) => {
                if (!isParamDisabled) {
                  handleParameterChange(param, option?.value);
                }
              }}
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
          <InlineField key={key} label={param.name} labelWidth={6} transparent>
            <Select
              width={14}
              value={isParamDisabled ? { label: 'auto', value: 'auto' } : (paramValue ? { label: paramValue, value: paramValue } : null)}
              options={unitOptions}
              isDisabled={isParamDisabled}
              onChange={(option) => {
                if (!isParamDisabled) {
                  handleParameterChange(param, option?.value);
                }
              }}
            />
          </InlineField>
        );
        
      case 'sampling':
        const samplingValidationError = getValidationError(param);
        const hasSamplingError = samplingValidationError !== null;
        
        return (
          <div key={key}>
            <InlineField label={param.name} labelWidth={8} transparent>
              <Input
                width={12}
                type={isParamDisabled ? "text" : "number"}
                value={isParamDisabled ? 'auto' : (paramValue || '')}
                disabled={isParamDisabled}
                readOnly={isParamDisabled}
                invalid={hasSamplingError && !isParamDisabled}
                style={isParamDisabled ? { 
                  backgroundColor: 'rgba(128, 128, 128, 0.1)', 
                  color: 'rgba(204, 204, 220, 0.6)',
                  cursor: 'not-allowed'
                } : (hasSamplingError ? {
                  borderColor: '#e02f44',
                  boxShadow: '0 0 0 2px rgba(224, 47, 68, 0.2)'
                } : undefined)}
                onChange={(e) => {
                  if (!isParamDisabled) {
                    handleParameterChange(param, parseFloat(e.currentTarget.value) || 0);
                  }
                }}
              />
            </InlineField>
            {hasSamplingError && !isParamDisabled && (
              <div style={{ 
                fontSize: '11px', 
                color: '#e02f44', 
                marginTop: '2px',
                marginLeft: '8px'
              }}>
                {samplingValidationError}
              </div>
            )}
          </div>
        );
        
      default:
        const validationError = getValidationError(param);
        const hasError = validationError !== null;
        
        return (
          <div key={key}>
            <InlineField label={param.name} labelWidth={8} transparent>
              <Input
                width={14}
                value={isParamDisabled ? 'auto' : (paramValue || '')}
                disabled={isParamDisabled}
                readOnly={isParamDisabled}
                invalid={hasError && !isParamDisabled}
                style={isParamDisabled ? { 
                  backgroundColor: 'rgba(128, 128, 128, 0.1)', 
                  color: 'rgba(204, 204, 220, 0.6)',
                  cursor: 'not-allowed'
                } : (hasError ? {
                  borderColor: '#e02f44',
                  boxShadow: '0 0 0 2px rgba(224, 47, 68, 0.2)'
                } : undefined)}
                onChange={(e) => {
                  if (!isParamDisabled) {
                    handleParameterChange(param, e.currentTarget.value);
                  }
                }}
              />
            </InlineField>
            {hasError && !isParamDisabled && (
              <div style={{ 
                fontSize: '11px', 
                color: '#e02f44', 
                marginTop: '2px',
                marginLeft: '8px'
              }}>
                {validationError}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <Card>
      <Card.Description>
        <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
          {/* Left side: Aggregator name and auto toggle */}
          <Stack direction="row" gap={2} alignItems="center">
            <strong style={{ fontSize: '14px', minWidth: '60px' }}>{aggregator.name || 'Unknown'}</strong>
            
            {/* Single Auto toggle for the whole aggregator */}
            {aggregator.autoValueSwitch && (
              <InlineField label="Auto" labelWidth={6} transparent>
                <Switch
                  value={isAutoEnabled}
                  onChange={(event) => {
                    const enabled = event.currentTarget.checked;
                    console.log('[AggregatorItem] Auto toggle clicked, new value:', enabled);
                    onAutoValueChange(enabled);
                  }}
                />
              </InlineField>
            )}
          </Stack>
          
          {/* Middle: Parameters inline */}
          <div style={{ flex: 1 }}>
            <Stack direction="row" gap={1} alignItems="center">
              {(aggregator.parameters || []).map(renderParameter)}
            </Stack>
          </div>
          
          {/* Right side: Action buttons */}
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
      </Card.Description>
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