import { DataSource } from '../src/datasource';
import { KairosDBDataSourceOptions } from '../src/types';
import { DataSourceInstanceSettings } from '@grafana/data';

// Mock the Grafana runtime
jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    fetch: jest.fn()
  }),
  getTemplateSrv: () => ({
    replace: (str: string) => str
  })
}));

describe('DataSource Aggregator Building', () => {
  let datasource: DataSource;

  beforeEach(() => {
    const mockSettings: DataSourceInstanceSettings<KairosDBDataSourceOptions> = {
      id: 1,
      uid: 'test-uid',
      type: 'kairosdb',
      name: 'Test KairosDB',
      url: 'http://localhost:8080',
      access: 'proxy',
      readOnly: false,
      isDefault: false,
      jsonData: {},
      meta: {
        id: 'kairosdb',
        name: 'KairosDB',
        type: 'datasource',
        info: {
          description: 'Test datasource',
          screenshots: [],
          updated: '2023-01-01',
          version: '1.0.0',
          logos: { small: '', large: '' }
        },
        includes: [],
        categoryId: 'tsdb',
        module: 'test'
      }
    };

    datasource = new DataSource(mockSettings);
  });

  it('should identify aggregators that require sampling parameters', () => {
    // Use reflection to access the private method for testing
    const requiresSamplingParameters = (datasource as any).requiresSamplingParameters.bind(datasource);

    // Range aggregators should require sampling parameters
    expect(requiresSamplingParameters('count')).toBe(true);
    expect(requiresSamplingParameters('gaps')).toBe(true);
    expect(requiresSamplingParameters('avg')).toBe(true);
    expect(requiresSamplingParameters('sum')).toBe(true);
    expect(requiresSamplingParameters('percentile')).toBe(true);

    // Non-range aggregators should not require sampling parameters
    expect(requiresSamplingParameters('diff')).toBe(false);
    expect(requiresSamplingParameters('rate')).toBe(false);
    expect(requiresSamplingParameters('scale')).toBe(false);

    // Unknown aggregators should not require sampling parameters
    expect(requiresSamplingParameters('unknown')).toBe(false);
  });
});
