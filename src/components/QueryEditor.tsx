import React, { ChangeEvent } from 'react';
import { InlineField, Input, Stack, FieldSet, Collapse } from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from '../datasource';
import { KairosDBDataSourceOptions, KairosDBQuery } from '../types';
import { MetricNameField } from './MetricNameField';
import { Aggregators } from './Aggregators';
import { TagsEditor } from './TagsEditor';
import { GroupByEditor } from './GroupByEditor';
import { MigrationUtils } from '../utils/migrationUtils';

type Props = QueryEditorProps<DataSource, KairosDBQuery, KairosDBDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery, datasource }: Props) {
  const [availableTags, setAvailableTags] = React.useState<string[]>([]);

  // Initialize query with defaults if empty - ensure all properties exist
  const baseQuery = {
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

  // Migrate aggregators from old format if needed
  const currentQuery = {
    ...baseQuery,
    aggregators: baseQuery.aggregators && MigrationUtils.needsMigration(baseQuery.aggregators)
      ? MigrationUtils.migrateAggregators(baseQuery.aggregators)
      : baseQuery.aggregators
  };
  
  
  // Ensure we have a valid query object and persist migrated data
  React.useEffect(() => {
    if (!query.query) {
      onChange({
        ...query,
        query: currentQuery
      });
    } else if (baseQuery.aggregators && MigrationUtils.needsMigration(baseQuery.aggregators)) {
      // Persist migrated aggregators back to the dashboard
      onChange({
        ...query,
        query: currentQuery
      });
    }
  }, []);  // Remove dependencies to avoid infinite loops

  // Load available tags when metric name changes
  React.useEffect(() => {
    const loadAvailableTags = async () => {
      if (currentQuery.metricName && datasource) {
        try {
          const tagData = await datasource.getMetricTags(currentQuery.metricName);
          setAvailableTags(Object.keys(tagData));
        } catch (error) {
          console.error('[QueryEditor] Error loading available tags:', error);
          setAvailableTags([]);
        }
      } else {
        setAvailableTags([]);
      }
    };

    loadAvailableTags();
  }, [currentQuery.metricName, datasource]);

  const onMetricNameChange = (metricName: string) => {
    const newQuery = { 
      ...query, 
      query: {
        ...currentQuery,
        metricName
      }
    };
    onChange(newQuery);
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

  const onAliasBlur = () => {
    onRunQuery();
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
    
    if (!currentQuery?.metricName) {
      return 'SELECT * FROM <metric>';
    }
    
    let str = "SELECT ";
    
    const aggregators = currentQuery.aggregators || [];
    if (aggregators.length > 0) {
      aggregators.slice().reverse().forEach((agg) => {
        if (agg?.name) {
          // Build aggregator with parameters
          let aggStr = agg.name;
          
          // Add parameters if any
          const params = agg.parameters || [];
          const paramStrings: string[] = [];
          
          params.forEach(param => {
            if (param?.name && param?.value !== undefined && param?.value !== null && param?.value !== '') {
              // Handle auto values
              if (agg.autoValueSwitch?.enabled && agg.autoValueSwitch?.dependentParameters?.includes(param.type)) {
                paramStrings.push(`${param.name}=auto`);
              } else {
                paramStrings.push(`${param.name}=${param.value}`);
              }
            }
          });
          
          if (paramStrings.length > 0) {
            aggStr += `[${paramStrings.join(', ')}]`;
          }
          
          str += aggStr + "(";
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
            
            <InlineField label="Alias" labelWidth={20}>
              <Input
                id="query-editor-alias"
                onChange={onAliasChange}
                onBlur={onAliasBlur}
                value={currentQuery.alias || ''}
                placeholder="Optional alias for the series"
                width={50}
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
          availableTags={availableTags}
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
