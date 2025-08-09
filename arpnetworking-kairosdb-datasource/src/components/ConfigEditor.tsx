import React, { ChangeEvent } from 'react';
import { InlineField, Input, Switch, FieldSet } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { KairosDBDataSourceOptions, KairosDBSecureJsonData } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<KairosDBDataSourceOptions, KairosDBSecureJsonData> {}

export function ConfigEditor(props: Props) {
  console.log('[ConfigEditor] Render called with props:', {
    options: props.options,
    hasOnOptionsChange: typeof props.onOptionsChange === 'function'
  });
  
  const { onOptionsChange, options } = props;
  const { jsonData } = options;

  const onSnapToIntervalsChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        snapToIntervals: event.target.value,
      },
    });
  };

  const onEnforceScalarSettingChange = (value: boolean) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        enforceScalarSetting: value,
      },
    });
  };

  const onAutocompleteMaxMetricsChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        autocompleteMaxMetrics: event.target.value,
      },
    });
  };

  const onTimeoutChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        timeout: event.target.value,
      },
    });
  };

  return (
    <FieldSet label="KairosDB Details">
      <InlineField 
        label="Auto Value Intervals" 
        labelWidth={20}
        tooltip="A comma delimited list of intervals used for auto value sampling in grafana time notation (e.g. 1m,1h). This will cause 'Auto' sampled aggregators to select the closest interval bigger than grafana's provided interval for the time range selected."
      >
        <Input
          id="config-editor-snap-to-intervals"
          onChange={onSnapToIntervalsChange}
          value={jsonData.snapToIntervals || '1m,5m,10m,15m,30m,1h,2h,3h,4h,6h,12h,1d,2d,3d,7d'}
          placeholder="1m,5m,10m,15m,30m,1h,2h,3h,4h,6h,12h,1d,2d,3d,7d"
          width={50}
        />
      </InlineField>
      
      <InlineField 
        label="Require Scalar Aggregators" 
        labelWidth={20}
        tooltip="This setting allows for enforcement that queries include at least one scalar aggregator per query. This option should be enabled when most data is histograms that need to be converted into scalars in order to be graphed in common visualizers, e.g. timeseries line graphs"
      >
        <Switch
          id="config-editor-enforce-scalar"
          value={jsonData.enforceScalarSetting || false}
          onChange={onEnforceScalarSettingChange}
        />
      </InlineField>
      
      <InlineField 
        label="Metrics Autocomplete Limit" 
        labelWidth={20}
        tooltip="This setting modifies the limit of metrics returned in an autocomplete list."
      >
        <Input
          id="config-editor-autocomplete-max-metrics"
          onChange={onAutocompleteMaxMetricsChange}
          value={jsonData.autocompleteMaxMetrics || '1000'}
          placeholder="1000"
          width={20}
        />
      </InlineField>

      <InlineField 
        label="Timeout (seconds)" 
        labelWidth={20}
        tooltip="Request timeout in seconds"
      >
        <Input
          id="config-editor-timeout"
          onChange={onTimeoutChange}
          value={jsonData.timeout || '115'}
          placeholder="115"
          width={20}
        />
      </InlineField>
    </FieldSet>
  );
}
