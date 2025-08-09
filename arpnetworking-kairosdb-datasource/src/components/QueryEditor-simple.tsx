import React, { ChangeEvent } from 'react';
import { InlineField, Input, Stack, FieldSet } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { KairosDBDataSourceOptions, KairosDBQuery } from '../types';
import { MetricNameField } from './MetricNameField';
import { TagsEditor } from './TagsEditor';

type Props = QueryEditorProps<DataSource, KairosDBQuery, KairosDBDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props) {
  console.log('[QueryEditor-Simple] Render called with:', {
    query: JSON.stringify(query, null, 2),
    hasOnChange: typeof onChange === 'function',
    hasOnRunQuery: typeof onRunQuery === 'function',
    hasDatasource: !!datasource
  });

  // Simple query object with tags
  const currentQuery = {
    metricName: '',
    alias: '',
    tags: {},
    ...query.query
  };
  
  console.log('[QueryEditor-Simple] Current query after merging:', JSON.stringify(currentQuery, null, 2));

  const onMetricNameChange = (metricName: string) => {
    console.log('[QueryEditor-Simple] onMetricNameChange called with:', metricName);
    console.log('[QueryEditor-Simple] Current query before update:', JSON.stringify(query, null, 2));
    const newQuery = { 
      ...query, 
      query: {
        ...currentQuery,
        metricName
      }
    };
    console.log('[QueryEditor-Simple] Calling onChange with:', JSON.stringify(newQuery, null, 2));
    onChange(newQuery);
    console.log('[QueryEditor-Simple] After onChange, calling onRunQuery');
    onRunQuery();
  };

  const onAliasChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...query,
      query: {
        ...currentQuery,
        alias: event.target.value
      }
    });
  };

  const onTagsChange = (tags: { [key: string]: string[] }) => {
    console.log('[QueryEditor-Simple] onTagsChange called with:', tags);
    onChange({
      ...query,
      query: {
        ...currentQuery,
        tags
      }
    });
    onRunQuery();
  };

  return (
    <FieldSet label="Simple Query Editor (with MetricNameField + TagsEditor)">
      <Stack direction="column" gap={2}>
        <MetricNameField
          metricName={currentQuery.metricName || ''}
          onChange={onMetricNameChange}
          datasource={datasource}
        />
        
        <TagsEditor
          metricName={currentQuery.metricName || ''}
          tags={currentQuery.tags || {}}
          onChange={onTagsChange}
          datasource={datasource}
        />
        
        <InlineField label="Alias" labelWidth={12}>
          <Input
            id="query-editor-alias"
            onChange={onAliasChange}
            value={currentQuery.alias || ''}
            placeholder="Optional alias for the series"
            width={40}
          />
        </InlineField>
        
        <div style={{ 
          backgroundColor: 'rgba(128, 128, 128, 0.1)', 
          padding: '8px', 
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          Query: SELECT * FROM {currentQuery.metricName || '<metric>'}
          {currentQuery.alias && ` AS ${currentQuery.alias}`}
          {Object.keys(currentQuery.tags || {}).length > 0 && (
            <div style={{ marginTop: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
              Tags: {Object.entries(currentQuery.tags || {}).map(([key, values]) => 
                `${key}=[${Array.isArray(values) ? values.join(',') : values}]`
              ).join(' AND ')}
            </div>
          )}
        </div>
      </Stack>
    </FieldSet>
  );
}
