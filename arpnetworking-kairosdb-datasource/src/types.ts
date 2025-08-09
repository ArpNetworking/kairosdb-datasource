import { DataSourceJsonData } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

// KairosDB Query interfaces
export interface KairosDBQuery extends DataQuery {
  query?: KairosDBTarget;
}

export interface KairosDBTarget {
  metricName?: string;
  alias?: string;
  tags: { [key: string]: string[] };
  groupBy: GroupBy;
  aggregators: Aggregator[];
  timeRange?: TimeRange;
  overrideScalar?: boolean;
}

export interface GroupBy {
  time?: GroupByTime;
  tags?: string[];
  value?: GroupByValue;
}

export interface GroupByTime {
  value: number;
  unit: string;
  range_size?: number;
}

export interface GroupByValue {
  range_size: number;
}

export interface Aggregator {
  name: string;
  parameters: AggregatorParameter[];
}

export interface AggregatorParameter {
  name: string;
  type: string;
  value: any;
  text?: string;
  autoValue?: boolean;
}

export interface TimeRange {
  from: string;
  to: string;
}

export const DEFAULT_QUERY: Partial<KairosDBQuery> = {
  query: {
    metricName: '',
    alias: '',
    tags: {},
    groupBy: {
      time: undefined,
      tags: [],
      value: undefined
    },
    aggregators: [],
    overrideScalar: false
  }
};

/**
 * KairosDB DataSource configuration options
 */
export interface KairosDBDataSourceOptions extends DataSourceJsonData {
  snapToIntervals?: string;
  enforceScalarSetting?: boolean;
  autocompleteMaxMetrics?: string;
  timeout?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface KairosDBSecureJsonData {
  apiKey?: string;
}
