import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { VariableQueryEditor } from './components/VariableQueryEditor';
import { KairosDBQuery, KairosDBDataSourceOptions } from './types';

console.log('[Module] KairosDB plugin module loading...');
console.log('[Module] DataSource class:', DataSource);
console.log('[Module] ConfigEditor component:', ConfigEditor);
console.log('[Module] QueryEditor component:', QueryEditor);

export const plugin = new DataSourcePlugin<DataSource, KairosDBQuery, KairosDBDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setVariableQueryEditor(VariableQueryEditor);

console.log('[Module] Plugin created successfully:', plugin);
