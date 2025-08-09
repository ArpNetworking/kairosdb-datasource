import React, { useState, useEffect } from 'react';
import { FieldSet, Stack, LoadingPlaceholder } from '@grafana/ui';
import { TagsSelect } from './TagsSelect';
import { DataSource } from '../datasource';

interface Props {
  metricName: string;
  tags: { [key: string]: string[] };
  onChange: (tags: { [key: string]: string[] }) => void;
  datasource?: DataSource;
}

export function TagsEditor({ metricName, tags = {}, onChange, datasource }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [availableTags, setAvailableTags] = useState<{ [key: string]: string[] }>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!metricName || !datasource) {
      setAvailableTags({});
      setError(null);
      return;
    }

    const loadTags = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const tagData = await datasource.getMetricTags(metricName);
        setAvailableTags(tagData);
        
        // Clean up selected tags that are no longer available
        const newTags: { [key: string]: string[] } = {};
        Object.keys(tagData).forEach(tagName => {
          if (tags[tagName]) {
            newTags[tagName] = tags[tagName].filter(value => 
              tagData[tagName].includes(value) || value.startsWith('$') || 
              (value.startsWith('[') && value.endsWith(']'))
            );
          } else {
            newTags[tagName] = [];
          }
        });
        
        // Only update if tags changed
        if (JSON.stringify(newTags) !== JSON.stringify(tags)) {
          onChange(newTags);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tags');
        setAvailableTags({});
      } finally {
        setIsLoading(false);
      }
    };

    loadTags();
  }, [metricName, datasource]);

  const handleTagChange = (tagName: string, selectedValues: string[]) => {
    const newTags = {
      ...tags,
      [tagName]: selectedValues
    };
    onChange(newTags);
  };

  if (!metricName) {
    return null;
  }

  const tagNames = Object.keys(availableTags);
  const tagCount = tagNames.length;
  const combinations = tagNames.reduce((total, tagName) => {
    const tagValues = availableTags[tagName];
    return total * (tagValues.length || 1);
  }, 1);

  return (
    <FieldSet label="Tags">
      <Stack direction="column" gap={1}>
        {isLoading && (
          <LoadingPlaceholder text="Loading tags..." />
        )}
        
        {error && (
          <div style={{ 
            color: 'rgb(229, 62, 62)', 
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            Unable to load tags: {error}
          </div>
        )}
        
        {!isLoading && !error && tagCount > 0 && (
          <>
            <div style={{ 
              fontSize: '12px', 
              color: 'rgba(204, 204, 220, 0.7)',
              fontWeight: 'bold'
            }}>
              {tagCount} tags, {combinations} combinations
            </div>
            
            {tagNames.map(tagName => (
              <TagsSelect
                key={tagName}
                tagName={tagName}
                tagValues={availableTags[tagName]}
                selectedValues={tags[tagName] || []}
                onChange={(selectedValues) => handleTagChange(tagName, selectedValues)}
              />
            ))}
          </>
        )}
        
        {!isLoading && !error && tagCount === 0 && (
          <div style={{ 
            color: 'rgba(204, 204, 220, 0.7)',
            fontSize: '12px',
            fontStyle: 'italic'
          }}>
            No tags available for this metric
          </div>
        )}
      </Stack>
    </FieldSet>
  );
}