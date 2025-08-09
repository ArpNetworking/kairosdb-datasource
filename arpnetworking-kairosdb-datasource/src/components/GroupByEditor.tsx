import React from 'react';
import { FieldSet, Stack } from '@grafana/ui';
import { GroupBy } from '../types';
import { GroupByTags } from './GroupByTags';
import { GroupByValue } from './GroupByValue';
import { GroupByTime } from './GroupByTime';

interface Props {
  groupBy: GroupBy;
  onChange: (groupBy: GroupBy) => void;
  availableTags?: string[];
  hasMultiValuedTags?: boolean;
}

export function GroupByEditor({ 
  groupBy = { time: undefined, tags: [], value: undefined }, 
  onChange, 
  availableTags = [], 
  hasMultiValuedTags = false 
}: Props) {
  
  const handleTagsChange = (tags: string[]) => {
    onChange({
      ...groupBy,
      tags
    });
  };

  const handleValueChange = (value: GroupByValue['value']) => {
    onChange({
      ...groupBy,
      value
    });
  };

  const handleTimeChange = (time: GroupBy['time']) => {
    onChange({
      ...groupBy,
      time
    });
  };

  // Only show GroupBy section if we have multi-valued tags or existing groupBy settings
  const shouldShow = hasMultiValuedTags || 
    groupBy.tags?.length > 0 || 
    groupBy.value?.range_size || 
    groupBy.time?.value;

  if (!shouldShow) {
    return null;
  }

  return (
    <FieldSet label="Group By">
      <Stack direction="column" gap={2}>
        {hasMultiValuedTags && (
          <GroupByTags
            tags={groupBy.tags || []}
            availableTags={availableTags}
            onChange={handleTagsChange}
          />
        )}
        
        <GroupByValue
          value={groupBy.value}
          onChange={handleValueChange}
        />
        
        <GroupByTime
          time={groupBy.time}
          onChange={handleTimeChange}
        />
      </Stack>
    </FieldSet>
  );
}