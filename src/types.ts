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
  groupBy?: GroupBy;
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

export interface AutoValueSwitch {
  enabled: boolean;
  dependentParameters: string[]; // parameter types that are auto-controlled
}

export interface Aggregator {
  name: string;
  parameters: AggregatorParameter[];
  autoValueSwitch?: AutoValueSwitch;
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
      value: undefined,
    },
    aggregators: [],
    overrideScalar: false,
  },
};

/**
 * KairosDB DataSource configuration options
 */
export interface KairosDBDataSourceOptions extends DataSourceJsonData {
  snapToIntervals?: string;
  enforceScalarSetting?: boolean;
  autocompleteMaxMetrics?: string;
  timeout?: string;
  metricSuffixesToIgnore?: string; // Comma-separated list of suffixes to filter out from metrics
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface KairosDBSecureJsonData {
  apiKey?: string;
}

// KairosDB API Response Types

/**
 * Response from /api/v1/metricnames endpoint
 */
export interface KairosDBMetricNamesResponse {
  results: string[];
}

/**
 * Response from /api/v1/datapoints/query/tags endpoint
 */
export interface KairosDBMetricTagsResponse {
  queries: Array<{
    results: Array<{
      name: string;
      tags: { [key: string]: string[] };
    }>;
  }>;
}

/**
 * Response from /api/v1/datapoints/query endpoint
 */
export interface KairosDBDatapointsResponse {
  queries: Array<{
    sample_size: number;
    results: Array<{
      name: string;
      group_by?: Array<{
        name: string;
        type: string;
        tags?: string[];
        group?: { [key: string]: string };
      }>;
      tags: { [key: string]: string[] };
      values: Array<[number, number]>; // [timestamp, value]
    }>;
  }>;
}

/**
 * Request body for /api/v1/datapoints/query endpoint
 */
export interface KairosDBDatapointsRequest {
  start_absolute?: number;
  start_relative?: {
    value: number;
    unit: string;
  };
  end_absolute?: number;
  end_relative?: {
    value: number;
    unit: string;
  };
  metrics: Array<{
    name: string;
    tags?: { [key: string]: string[] };
    aggregators?: Array<{
      name: string;
      [key: string]: any; // aggregator-specific parameters
    }>;
    group_by?: Array<{
      name: string;
      tags?: string[];
      range_size?:
        | {
            value: number;
            unit: string;
          }
        | number; // For value group by, range_size is just a number
      group_count?: number;
    }>;
  }>;
}

/**
 * Request body for /api/v1/datapoints/query/tags endpoint
 */
export interface KairosDBMetricTagsRequest {
  start_absolute?: number;
  start_relative?: {
    value: number;
    unit: string;
  };
  end_absolute?: number;
  end_relative?: {
    value: number;
    unit: string;
  };
  metrics: Array<{
    name: string;
    tags?: { [key: string]: string[] };
  }>;
}

/**
 * Response from /api/v1/version endpoint
 */
export interface KairosDBVersionResponse {
  version: string;
}
