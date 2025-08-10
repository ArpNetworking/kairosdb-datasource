import { test, expect } from '@grafana/plugin-e2e';

test('smoke: should render config editor', async ({ createDataSourceConfigPage, readProvisionedDataSource, page }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  await createDataSourceConfigPage({ type: ds.type });
  // Check for our actual config fields
  await expect(page.getByText('Auto Value Intervals')).toBeVisible();
  await expect(page.getByText('Require Scalar Aggregators')).toBeVisible();
  await expect(page.getByText('Metrics Autocomplete Limit')).toBeVisible();
});

test('should have Save & test button', async ({ createDataSourceConfigPage, readProvisionedDataSource, page }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const configPage = await createDataSourceConfigPage({ type: ds.type });
  // Just check that the Save & Test button exists rather than trying to mock network calls
  await expect(page.getByTestId('data-testid Data source settings page Save and Test button')).toBeVisible();
});
