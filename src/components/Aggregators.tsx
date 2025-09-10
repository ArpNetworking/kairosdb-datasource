import React from 'react';
import { Button, FieldSet, Stack, Dropdown, Menu } from '@grafana/ui';
import { Aggregator } from '../types';
import { AggregatorItem } from './AggregatorItem';
import { AVAILABLE_AGGREGATORS } from '../aggregators';
import { formatAggregatorDisplayName } from '../utils/parameterUtils';

interface Props {
  aggregators: Aggregator[];
  onChange: (aggregators: Aggregator[]) => void;
  availableAggregators?: Aggregator[];
}

export function Aggregators({ aggregators = [], onChange, availableAggregators = AVAILABLE_AGGREGATORS }: Props) {
  const handleAdd = (aggregator: Aggregator) => {
    if (!aggregator || !aggregator.name) {
      return;
    }

    // Clone the aggregator to avoid reference issues
    const newAggregator: Aggregator = {
      name: aggregator.name,
      parameters: (aggregator.parameters || []).map((param) => ({ ...param })),
      autoValueSwitch: aggregator.autoValueSwitch ? { ...aggregator.autoValueSwitch } : undefined,
    };
    onChange([...aggregators, newAggregator]);
  };

  const handleRemove = (index: number) => {
    const newAggregators = aggregators.filter((_, i) => i !== index);
    onChange(newAggregators);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) {
      return;
    }
    const newAggregators = [...aggregators];
    [newAggregators[index - 1], newAggregators[index]] = [newAggregators[index], newAggregators[index - 1]];
    onChange(newAggregators);
  };

  const handleMoveDown = (index: number) => {
    if (index >= aggregators.length - 1) {
      return;
    }
    const newAggregators = [...aggregators];
    [newAggregators[index], newAggregators[index + 1]] = [newAggregators[index + 1], newAggregators[index]];
    onChange(newAggregators);
  };

  const handleParameterChange = (index: number, parameterName: string, value: any) => {
    if (index < 0 || index >= aggregators.length) {
      return;
    }

    const newAggregators = [...aggregators];
    const aggregator = newAggregators[index];
    if (!aggregator || !aggregator.parameters) {
      return;
    }

    const parameter = aggregator.parameters.find((p) => p && p.name === parameterName);
    if (parameter) {
      parameter.value = value;
      parameter.text = value ? value.toString() : '';
    }
    onChange(newAggregators);
  };

  const handleAutoValueChange = (index: number, enabled: boolean) => {
    if (index < 0 || index >= aggregators.length) {
      return;
    }

    const newAggregators = [...aggregators];
    const aggregator = newAggregators[index];
    if (!aggregator || !aggregator.autoValueSwitch) {
      return;
    }

    aggregator.autoValueSwitch.enabled = enabled;
    onChange(newAggregators);
  };

  const handleVisibilityChange = (index: number, visible: boolean) => {
    if (index < 0 || index >= aggregators.length) {
      return;
    }

    const newAggregators = [...aggregators];
    const aggregator = newAggregators[index];
    if (!aggregator) {
      return;
    }

    aggregator.visible = visible;
    onChange(newAggregators);
  };

  return (
    <FieldSet label="Aggregators">
      <Stack direction="column" gap={2}>
        <Stack direction="row" gap={1} alignItems="center">
          <Dropdown
            overlay={() => (
              <Menu>
                {availableAggregators.map((aggregator) => (
                  <Menu.Item key={aggregator.name} label={formatAggregatorDisplayName(aggregator.name)} onClick={() => handleAdd(aggregator)} />
                ))}
              </Menu>
            )}
          >
            <Button variant="secondary" size="sm" icon="plus">
              Add Aggregator
            </Button>
          </Dropdown>
          {aggregators.length > 0 && (
            <span style={{ fontSize: '12px', color: 'rgba(204, 204, 220, 0.7)' }}>
              {aggregators.length} aggregator{aggregators.length !== 1 ? 's' : ''}
            </span>
          )}
        </Stack>

        <Stack direction="column" gap={1}>
          {aggregators
            .filter((aggregator) => aggregator && aggregator.name)
            .map((aggregator, index) => (
              <AggregatorItem
                key={`${aggregator.name}-${index}`}
                aggregator={aggregator}
                index={index}
                isFirst={index === 0}
                isLast={index === aggregators.length - 1}
                onRemove={() => handleRemove(index)}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                onParameterChange={(paramName, value) => handleParameterChange(index, paramName, value)}
                onAutoValueChange={(enabled) => handleAutoValueChange(index, enabled)}
                onVisibilityChange={(visible) => handleVisibilityChange(index, visible)}
              />
            ))}
        </Stack>

        {aggregators.length === 0 && (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: 'rgba(204, 204, 220, 0.7)',
              fontSize: '12px',
              fontStyle: 'italic',
            }}
          >
            No aggregators configured. Add an aggregator to process your metric data.
          </div>
        )}
      </Stack>
    </FieldSet>
  );
}
