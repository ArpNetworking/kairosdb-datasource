import React, { useState } from 'react';
import { Button, Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

interface Segment {
  id: number;
  value: string | null;
}

interface Props {
  segment: Segment;
  tagValues: string[];
  onChange: (value: string | null) => void;
}

export function TagInput({ segment, tagValues, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (option: SelectableValue<string> | null) => {
    onChange(option?.value || null);
    setIsOpen(false);
  };

  // If this is a plus button (value is null)
  if (segment.value === null) {
    return (
      <>
        <Button variant="secondary" size="xs" onClick={() => setIsOpen(!isOpen)} icon="plus" aria-label="Add tag" />

        {isOpen && (
          <div
            style={{
              position: 'absolute',
              zIndex: 1000,
              marginTop: '24px',
              minWidth: '200px',
            }}
          >
            <Select
              placeholder="Select tag value..."
              options={tagValues.map((value) => ({ label: value, value }))}
              onChange={handleChange}
              onCloseMenu={() => setIsOpen(false)}
              autoFocus
              openMenuOnFocus
              allowCustomValue
              width={25}
            />
          </div>
        )}
      </>
    );
  }

  // This is a selected value, show it as a segment
  return (
    <>
      <Button
        variant="secondary"
        size="xs"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          backgroundColor: 'rgba(36, 41, 46, 1)',
          color: 'rgb(204, 204, 220)',
          border: '1px solid rgba(36, 41, 46, 1)',
          borderRadius: '3px',
          fontSize: '11px',
          padding: '2px 6px',
        }}
      >
        {segment.value}
      </Button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            zIndex: 1000,
            marginTop: '24px',
            minWidth: '200px',
          }}
        >
          <Select
            value={{ label: segment.value, value: segment.value }}
            options={[
              { label: segment.value, value: segment.value },
              ...tagValues.filter((value) => value !== segment.value).map((value) => ({ label: value, value })),
            ]}
            onChange={handleChange}
            onCloseMenu={() => setIsOpen(false)}
            autoFocus
            openMenuOnFocus
            allowCustomValue
            width={25}
          />
        </div>
      )}
    </>
  );
}
