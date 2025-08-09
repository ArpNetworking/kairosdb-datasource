import React, { ChangeEvent } from 'react';
import { InlineField, Input, Stack, FieldSet, Collapse } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { KairosDBDataSourceOptions, KairosDBQuery, DEFAULT_QUERY } from '../types';
import { MetricNameField } from './MetricNameField';
import { Aggregators } from './Aggregators';
import { TagsEditor } from './TagsEditor';
import { GroupByEditor } from './GroupByEditor';

type Props = QueryEditorProps<DataSource, KairosDBQuery, KairosDBDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props) {
  console.log('[QueryEditor] Render called with:', {
    query: JSON.stringify(query, null, 2),
    hasOnChange: typeof onChange === 'function',
    hasOnRunQuery: typeof onRunQuery === 'function',
    hasDatasource: !!datasource
  });

  // Initialize query with defaults if empty - ensure all properties exist
  const currentQuery = {
    metricName: '',
    alias: '',
    tags: {},
    groupBy: {
      time: undefined,
      tags: [],
      value: undefined
    },
    aggregators: [],
    overrideScalar: false,
    ...query.query
  };
  
  console.log('[QueryEditor] Current query after merging:', JSON.stringify(currentQuery, null, 2));
  
  // Ensure we have a valid query object
  React.useEffect(() => {
    if (!query.query) {
      onChange({
        ...query,
        query: currentQuery
      });
    }
  }, []);  // Remove dependencies to avoid infinite loops

  const onMetricNameChange = (metricName: string) => {
    console.log('[QueryEditor] onMetricNameChange called with:', metricName);
    const newQuery = { 
      ...query, 
      query: {
        ...currentQuery,
        metricName
      }
    };
    console.log('[QueryEditor] Calling onChange with:', JSON.stringify(newQuery, null, 2));
    onChange(newQuery);
    console.log('[QueryEditor] Calling onRunQuery');
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

  const onAggregatorsChange = (aggregators: any[]) => {
    onChange({
      ...query,
      query: {
        ...currentQuery,
        aggregators
      }
    });
    onRunQuery();
  };

  const onTagsChange = (tags: { [key: string]: string[] }) => {
    onChange({
      ...query,
      query: {
        ...currentQuery,
        tags
      }
    });
    onRunQuery();
  };

  const onGroupByChange = (groupBy: any) => {
    onChange({
      ...query,
      query: {
        ...currentQuery,
        groupBy
      }
    });
    onRunQuery();
  };

  const getCollapsedText = (): string => {
    console.log('[QueryEditor] getCollapsedText called with currentQuery:', JSON.stringify(currentQuery, null, 2));
    
    if (!currentQuery?.metricName) {
      console.log('[QueryEditor] No metric name, returning default text');
      return 'SELECT * FROM <metric>';
    }
    
    let str = "SELECT ";
    
    const aggregators = currentQuery.aggregators || [];
    if (aggregators.length > 0) {
      aggregators.slice().reverse().forEach((agg) => {
        if (agg?.name) {
          str += agg.name + "(";
        }
      });
      str += "*";
      aggregators.forEach(() => {
        str += ")";
      });
    } else {
      str += "*";
    }

    if (currentQuery.alias) {
      str += " as " + currentQuery.alias;
    }

    str += " FROM " + currentQuery.metricName;

    const tags = currentQuery.tags || {};
    const tagKeys = Object.keys(tags).filter(key => 
      tags[key] && Array.isArray(tags[key]) && tags[key].length > 0
    );
    
    if (tagKeys.length > 0) {
      str += " WHERE " + tagKeys.map(key => {
        const values = tags[key] || [];
        return values.length > 1 ? `${key}=[${values.join(',')}]` : `${key}=${values[0] || ''}`;
      }).join(', ');
    }

    // Add GROUP BY clause
    const groupByParts: string[] = [];
    const groupBy = currentQuery.groupBy || {};
    
    if (groupBy.tags && Array.isArray(groupBy.tags) && groupBy.tags.length > 0) {
      groupByParts.push(...groupBy.tags.filter(Boolean));
    }
    
    if (groupBy.value?.range_size) {
      groupByParts.push(`value(${groupBy.value.range_size})`);
    }
    
    if (groupBy.time?.value && groupBy.time?.unit) {
      const time = groupBy.time;
      let timeStr = `time(${time.value}${time.unit})`;
      if (time.range_size) {
        timeStr = `time(${time.value}${time.unit}, ${time.range_size})`;
      }
      groupByParts.push(timeStr);
    }
    
    if (groupByParts.length > 0) {
      str += " GROUP BY " + groupByParts.join(', ');
    }

    return str;
  };

  return (
    <Collapse 
      label="Query" 
      collapsible={true}
      isOpen={true}
      onToggle={() => {}}
    >
      <Stack direction="column" gap={2}>
        <FieldSet label="Query">
          <Stack direction="column" gap={1}>
            <MetricNameField
              metricName={currentQuery.metricName || ''}
              onChange={onMetricNameChange}
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
          </Stack>
        </FieldSet>

        <TagsEditor
          metricName={currentQuery.metricName || ''}
          tags={currentQuery.tags || {}}
          onChange={onTagsChange}
          datasource={datasource}
        />

        <GroupByEditor
          groupBy={currentQuery.groupBy || { time: undefined, tags: [], value: undefined }}
          onChange={onGroupByChange}
          availableTags={Object.keys(currentQuery.tags || {})}
          hasMultiValuedTags={Object.values(currentQuery.tags || {}).some(values => Array.isArray(values) && values.length > 1)}
        />

        <Aggregators
          aggregators={currentQuery.aggregators || []}
          onChange={onAggregatorsChange}
        />

        <FieldSet label="Preview">
          <div style={{ 
            backgroundColor: 'rgba(128, 128, 128, 0.1)', 
            padding: '8px', 
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            {getCollapsedText()}
          </div>
        </FieldSet>
      </Stack>
    </Collapse>
  );
}
