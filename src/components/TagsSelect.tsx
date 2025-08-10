import React, { useState } from 'react';
import { Button, InlineField, Stack, Tooltip } from '@grafana/ui';
import { TagInput } from './TagInput';

interface Props {
  tagName: string;
  tagValues: string[];
  selectedValues: string[];
  onChange: (selectedValues: string[]) => void;
}

export function TagsSelect({ tagName, tagValues = [], selectedValues = [], onChange }: Props) {
  const [segments, setSegments] = useState(() => {
    const initialSegments = selectedValues.map((value, index) => ({ id: index, value }));
    return [...initialSegments, { id: Date.now(), value: null }]; // Add plus button
  });

  const handleSegmentChange = (segmentId: number, value: string | null) => {
    const newSegments = segments.map(segment => 
      segment.id === segmentId ? { ...segment, value } : segment
    );
    
    // If this was the plus button and now has a value, add a new plus button
    const wasLastSegment = segments[segments.length - 1]?.id === segmentId;
    if (wasLastSegment && value !== null) {
      newSegments.push({ id: Date.now(), value: null });
    }
    
    setSegments(newSegments);
    updateSelectedValues(newSegments);
  };

  const handleSegmentRemove = (segmentId: number) => {
    const newSegments = segments.filter(segment => segment.id !== segmentId);
    
    // Ensure we always have a plus button at the end
    const hasPlusButton = newSegments.some(segment => segment.value === null);
    if (!hasPlusButton) {
      newSegments.push({ id: Date.now(), value: null });
    }
    
    setSegments(newSegments);
    updateSelectedValues(newSegments);
  };

  const updateSelectedValues = (newSegments: typeof segments) => {
    const values = newSegments
      .filter(segment => segment.value !== null)
      .map(segment => segment.value!);
    onChange(values);
  };

  return (
    <Stack direction="row" gap={1} alignItems="center">
      <InlineField 
        label={
          <Tooltip content={`Values: ${tagValues.join(', ')}`} placement="top">
            <span style={{ cursor: 'help' }}>{tagName}</span>
          </Tooltip>
        }
        labelWidth={20}
      >
        <div></div>
      </InlineField>
      
      <Stack direction="row" gap={0.5} alignItems="center" wrap>
        {segments.map((segment, index) => (
          <div key={segment.id} style={{ display: 'flex', alignItems: 'center' }}>
            <TagInput
              segment={segment}
              tagValues={tagValues}
              onChange={(value) => handleSegmentChange(segment.id, value)}
            />
            
            {segment.value !== null && index < segments.length - 1 && (
              <Button
                variant="secondary"
                size="xs"
                onClick={() => handleSegmentRemove(segment.id)}
                icon="times"
                style={{ marginLeft: '4px' }}
                tooltip="Remove tag value"
              />
            )}
          </div>
        ))}
      </Stack>
    </Stack>
  );
}
