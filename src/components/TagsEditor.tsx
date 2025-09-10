import React, { useState, useEffect, useCallback } from 'react';
import { FieldSet, Stack, LoadingPlaceholder, Button } from '@grafana/ui';
import { TagsSelect } from './TagsSelect';
import { ManualTagEntry } from './ManualTagEntry';
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
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualTags, setManualTags] = useState<{ [key: string]: string[] }>({});

  const loadTags = useCallback(async () => {
    if (!metricName || !datasource) {
      setAvailableTags({});
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tagData = await datasource.getMetricTags(metricName);
      setAvailableTags(tagData);

      // Clean up selected tags that are no longer available
      const newTags: { [key: string]: string[] } = {};
      Object.keys(tagData).forEach((tagName) => {
        if (tags[tagName]) {
          newTags[tagName] = tags[tagName].filter(
            (value) =>
              tagData[tagName].includes(value) ||
              value.startsWith('$') ||
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
  }, [metricName, datasource, tags, onChange]);

  useEffect(() => {
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricName, datasource]); // Intentionally omit onChange and tags to avoid infinite loops

  const handleTagChange = (tagName: string, selectedValues: string[]) => {
    const newTags = {
      ...tags,
      [tagName]: selectedValues,
    };
    onChange(newTags);
  };

  const handleManualTagAdd = useCallback((tagName: string, tagValue: string) => {
    // Add to manual tags tracking
    const newManualTags = {
      ...manualTags,
      [tagName]: manualTags[tagName] ? [...manualTags[tagName], tagValue] : [tagValue],
    };
    setManualTags(newManualTags);

    // Add to current tags
    const newTags = {
      ...tags,
      [tagName]: tags[tagName] ? [...tags[tagName], tagValue] : [tagValue],
    };
    onChange(newTags);
    setShowManualEntry(false);
  }, [tags, manualTags, onChange]);

  const handleManualTagCancel = useCallback(() => {
    setShowManualEntry(false);
  }, []);

  if (!metricName) {
    return null;
  }

  // Combine available tags from server with manual tags
  const allTags = { ...availableTags };
  Object.keys(manualTags).forEach(tagName => {
    if (!allTags[tagName]) {
      allTags[tagName] = [];
    }
    // Add manual values that aren't already in available tags
    manualTags[tagName].forEach(value => {
      if (!allTags[tagName].includes(value)) {
        allTags[tagName].push(value);
      }
    });
  });

  // Include any tag names from current selection that aren't in available or manual
  Object.keys(tags).forEach(tagName => {
    if (!allTags[tagName]) {
      allTags[tagName] = [];
    }
  });

  const tagNames = Object.keys(allTags);
  const tagCount = tagNames.length;
  const combinations = tagNames.reduce((total, tagName) => {
    const tagValues = allTags[tagName];
    return total * Math.max(tagValues.length, 1);
  }, 1);

  return (
    <FieldSet 
      label={
          <Stack direction="row" alignItems="center" gap={1}>
          <span>Tags</span>
          {metricName && (
            <Button
              size="sm"
              variant="secondary"
              icon="sync"
              onClick={loadTags}
              disabled={isLoading}
              tooltip="Refresh tags"
            />
          )}
          <Button
            size="sm"
            variant="secondary"
            icon="plus"
            onClick={() => setShowManualEntry(true)}
            disabled={showManualEntry}
            tooltip="Add custom tag"
          >
            Add Tag
          </Button>
        </Stack>
      }
    >
      <Stack direction="column" gap={1}>
        {isLoading && <LoadingPlaceholder text="Loading tags..." />}

        {error && (
          <div
            style={{
              color: 'rgb(229, 62, 62)',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
          >
            Unable to load tags: {error}
          </div>
        )}

        {!isLoading && !error && tagCount > 0 && (
          <>
            <div
              style={{
                fontSize: '12px',
                color: 'rgba(204, 204, 220, 0.7)',
                fontWeight: 'bold',
              }}
            >
              {tagCount} tags, {combinations} combinations
            </div>

            {tagNames.map((tagName) => (
              <TagsSelect
                key={tagName}
                tagName={tagName}
                tagValues={allTags[tagName]}
                selectedValues={tags[tagName] || []}
                onChange={(selectedValues) => handleTagChange(tagName, selectedValues)}
              />
            ))}
          </>
        )}

        {!isLoading && !error && tagCount === 0 && !showManualEntry && (
          <div
            style={{
              color: 'rgba(204, 204, 220, 0.7)',
              fontSize: '12px',
              fontStyle: 'italic',
            }}
          >
            No tags available for this metric. Use &quot;Add Tag&quot; to create custom tags.
          </div>
        )}

        {showManualEntry && (
          <ManualTagEntry
            onAdd={handleManualTagAdd}
            onCancel={handleManualTagCancel}
            existingTagNames={tagNames}
          />
        )}
      </Stack>
    </FieldSet>
  );
}
