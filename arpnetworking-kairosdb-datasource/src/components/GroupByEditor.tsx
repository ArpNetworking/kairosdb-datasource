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

  const handleValueChange = (value: GroupBy['value']) => {
    const newGroupBy = {
      ...groupBy,
      value
    };
    onChange(newGroupBy);
  };

  const handleTimeChange = (time: GroupBy['time']) => {
    const newGroupBy = {
      ...groupBy,
      time
    };
    onChange(newGroupBy);
  };

  // Always show GroupBy section when we have available tags or existing groupBy settings
  const shouldShow = availableTags.length > 0 || 
    (groupBy.tags?.length ?? 0) > 0 || 
    groupBy.value?.range_size || 
    groupBy.time?.value;

  if (!shouldShow) {
    return null;
  }

  return (
    <FieldSet label="Group By">
      <Stack direction="column" gap={2}>
        {availableTags.length > 0 && (
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
