import { DataSource } from '../src/datasource';
import { KairosDBDataSourceOptions } from '../src/types';
import { DataSourceInstanceSettings, DataFrameType } from '@grafana/data';

// Mock the Grafana runtime
jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    fetch: jest.fn()
  }),
  getTemplateSrv: () => ({
    replace: (str: string) => str
  })
}));

describe('DataSource Histogram Parsing', () => {
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

  it('should detect histogram data correctly', () => {
    const isHistogramData = (datasource as any).isHistogramData.bind(datasource);

    // Test histogram datapoint
    const histogramPoint = [
      1640995200000, // timestamp
      {
        bins: { "0.1": 5, "0.5": 12, "1.0": 8 },
        precision: 12,
        min: 0.05,
        max: 1.2,
        sum: 15.7,
        count: 25
      }
    ];

    expect(isHistogramData(histogramPoint)).toBe(true);

    // Test regular numeric datapoint
    const numericPoint = [1640995200000, 42.5];
    expect(isHistogramData(numericPoint)).toBe(false);

    // Test malformed data
    const result1 = isHistogramData(null);
    const result2 = isHistogramData([1640995200000, null]);
    const result3 = isHistogramData([1640995200000, { bins: null }]);
    
    expect(result1).toBe(false);
    expect(result2).toBe(false);  
    expect(result3).toBe(false);
  });

  it('should compute bin max values correctly', () => {
    const computeBinMax = (datasource as any).computeBinMax.bind(datasource);

    // Test zero bin
    expect(computeBinMax(0, 12)).toBe(0.00000001);

    // Test non-zero bins
    const result1 = computeBinMax(0.1, 12);
    expect(result1).toBeGreaterThan(0.1);
    
    const result2 = computeBinMax(1.0, 12);
    expect(result2).toBeGreaterThan(1.0);

    // Higher precision should give smaller bin ranges
    const highPrecResult = computeBinMax(1.0, 52);
    const lowPrecResult = computeBinMax(1.0, 8);
    expect(highPrecResult).toBeLessThan(lowPrecResult);
  });

  it('should calculate sampling intervals correctly', () => {
    const calculateSamplingInterval = (datasource as any).calculateSamplingInterval.bind(datasource);

    // Test with aggregator sampling
    const aggregators = [{
      sampling: { value: 5, unit: 'minutes' }
    }];
    expect(calculateSamplingInterval(aggregators, [])).toBe(5 * 60 * 1000);

    // Test with time series fallback
    const timeValues = [1000, 2000, 3000];
    expect(calculateSamplingInterval([], timeValues)).toBe(1000);

    // Test default fallback
    expect(calculateSamplingInterval([], [])).toBe(60000);
  });

  it('should parse histogram data into heatmap format', () => {
    const parseHistogramData = (datasource as any).parseHistogramData.bind(datasource);

    const histogramResult = {
      name: 'test.metric',
      values: [
        [1640995200000, {
          bins: { "0.1": 5, "0.5": 12, "1.0": 8 },
          precision: 12
        }],
        [1640995260000, {
          bins: { "0.2": 3, "0.8": 15, "2.0": 6 },
          precision: 12
        }]
      ]
    };

    const frames = parseHistogramData(histogramResult, 'test-series', 'A', 60000);
    
    expect(frames).toHaveLength(1);
    
    const frame = frames[0];
    expect(frame.refId).toBe('A');
    expect(frame.name).toBe('test-series');
    expect(frame.meta?.type).toBe(DataFrameType.HeatmapCells);
    
    // Should have 5 fields: xMin, xMax, yMin, yMax, count
    expect(frame.fields).toHaveLength(5);
    expect(frame.fields.map(f => f.name)).toEqual(['xMin', 'xMax', 'yMin', 'yMax', 'count']);
    
    // Should have 6 data points (3 bins per timestamp)
    expect(frame.fields[0].values).toHaveLength(6);
    
    // Check some values
    expect(frame.fields[0].values[0]).toBe(1640995200000); // xMin
    expect(frame.fields[1].values[0]).toBe(1640995260000); // xMax  
    expect(frame.fields[2].values[0]).toBe(0.1); // yMin
    expect(frame.fields[4].values[0]).toBe(5); // count
  });
});
