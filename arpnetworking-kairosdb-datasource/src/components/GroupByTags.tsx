import React from 'react';
import { InlineField, MultiSelect } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

interface Props {
  tags: string[];
  availableTags: string[];
  onChange: (tags: string[]) => void;
}

export function GroupByTags({ tags = [], availableTags = [], onChange }: Props) {
  const options: Array<SelectableValue<string>> = availableTags.map(tag => ({
    label: tag,
    value: tag
  }));

  const selectedOptions = tags.map(tag => ({
    label: tag,
    value: tag
  }));

  const handleChange = (selected: Array<SelectableValue<string>>) => {
    const newTags = selected.map(option => option.value!).filter(Boolean);
    onChange(newTags);
  };

  return (
    <InlineField 
      label="Group by Tags" 
      labelWidth={20}
      tooltip="Group results by tag values"
    >
      <MultiSelect
        width={50}
        options={options}
        value={selectedOptions}
        onChange={handleChange}
        placeholder="Select tags to group by..."
        closeMenuOnSelect={false}
      />
    </InlineField>
  );
}
