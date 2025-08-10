import { test, expect } from '@grafana/plugin-e2e';

test('smoke: should render query editor', async ({ panelEditPage, readProvisionedDataSource }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await panelEditPage.datasource.set(ds.name);
  await expect(panelEditPage.getQueryEditorRow('A').getByText('Metric Name')).toBeVisible();
  await expect(panelEditPage.getQueryEditorRow('A').getByText('Alias')).toBeVisible();
});

test('should allow setting metric name and alias', async ({ panelEditPage, readProvisionedDataSource }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await panelEditPage.datasource.set(ds.name);
  
  // Find the metric name input field (AsyncSelect component) - use combobox role instead of placeholder
  const metricNameInput = panelEditPage.getQueryEditorRow('A').getByRole('combobox');
  await expect(metricNameInput).toBeVisible();
  
  // Find the alias input field
  const aliasInput = panelEditPage.getQueryEditorRow('A').locator('#query-editor-alias');
  await expect(aliasInput).toBeVisible();
  
  // Test filling the alias field
  await aliasInput.fill('test alias');
  await expect(aliasInput).toHaveValue('test alias');
});
