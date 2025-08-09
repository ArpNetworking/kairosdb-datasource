import React, { useState } from 'react';
import { Button, Select, Card, Stack } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { Aggregator } from '../types';

interface Props {
  availableAggregators: Aggregator[];
  onAdd: (aggregator: Aggregator) => void;
  onCancel: () => void;
}

export function AggregatorEditor({ availableAggregators = [], onAdd, onCancel }: Props) {
  const [selectedAggregator, setSelectedAggregator] = useState<Aggregator | null>(null);

  const aggregatorOptions: Array<SelectableValue<string>> = availableAggregators
    .filter(agg => agg && agg.name)
    .map(agg => ({
      label: agg.name,
      value: agg.name,
      description: getAggregatorDescription(agg.name)
    }));

  const handleAggregatorSelect = (option: SelectableValue<string> | null) => {
    if (option?.value) {
      const aggregator = availableAggregators.find(agg => agg.name === option.value);
      setSelectedAggregator(aggregator || null);
    } else {
      setSelectedAggregator(null);
    }
  };

  const handleAdd = () => {
    if (selectedAggregator) {
      onAdd(selectedAggregator);
    }
  };

  return (
    <Card>
      <Card.Heading>Add Aggregator</Card.Heading>
      <Card.Body>
        <Stack direction="column" gap={2}>
          <Select
            placeholder="Choose an aggregator..."
            options={aggregatorOptions}
            onChange={handleAggregatorSelect}
            value={selectedAggregator ? { 
              label: selectedAggregator.name, 
              value: selectedAggregator.name 
            } : null}
            width={40}
            maxMenuHeight={200}
          />
          
          {selectedAggregator && (
            <div style={{ 
              padding: '8px', 
              backgroundColor: 'rgba(128, 128, 128, 0.1)', 
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              <strong>{selectedAggregator.name}</strong>
              <br />
              {getAggregatorDescription(selectedAggregator.name)}
              
              {(selectedAggregator.parameters || []).length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <strong>Parameters:</strong>
                  <ul style={{ margin: '4px 0 0 16px' }}>
                    {(selectedAggregator.parameters || [])
                      .filter(param => param && param.name)
                      .map(param => (
                        <li key={param.name}>
                          <strong>{param.name}</strong> ({param.type || 'unknown'}): {param.value || 'default'}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <Stack direction="row" gap={1}>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAdd}
              disabled={!selectedAggregator}
            >
              Add
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </Stack>
        </Stack>
      </Card.Body>
    </Card>
  );
}

function getAggregatorDescription(name: string): string {
  const descriptions: { [key: string]: string } = {
    'avg': 'Calculate the average value over a time period',
    'count': 'Count the number of data points in a time period',
    'dev': 'Calculate standard deviation over a time period',
    'diff': 'Calculate the difference between consecutive values',
    'first': 'Return the first value in a time period',
    'last': 'Return the last value in a time period',
    'max': 'Return the maximum value in a time period',
    'min': 'Return the minimum value in a time period',
    'percentile': 'Calculate the specified percentile over a time period',
    'rate': 'Calculate the rate of change per time unit',
    'sampler': 'Sample data points at regular intervals',
    'scale': 'Multiply all values by a scaling factor',
    'sum': 'Calculate the sum of all values in a time period',
  };
  
  return descriptions[name] || `${name} aggregator`;
}