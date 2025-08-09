// KairosDB Aggregator definitions
import { Aggregator, AggregatorParameter } from './types';

// Base aggregator class
export class BaseAggregator implements Aggregator {
  public name: string;
  public parameters: AggregatorParameter[] = [];

  constructor(name: string) {
    this.name = name;
  }

  public clone(): BaseAggregator {
    const cloned = new BaseAggregator(this.name);
    cloned.parameters = this.parameters.map(param => ({ ...param }));
    return cloned;
  }
}

// Range aggregator for time-based operations
export class RangeAggregator extends BaseAggregator {
  constructor(name: string) {
    super(name);
    this.parameters = [
      {
        name: 'value',
        type: 'sampling',
        value: 1,
        text: '1 minute',
        autoValue: true
      },
      {
        name: 'unit',
        type: 'sampling_unit',
        value: 'minutes',
        text: 'minutes'
      }
    ];
  }
}

// Percentile aggregator
export class PercentileAggregator extends BaseAggregator {
  static readonly NAME = 'percentile';
  
  constructor() {
    super(PercentileAggregator.NAME);
    this.parameters = [
      {
        name: 'percentile',
        type: 'any',
        value: 0.95,
        text: '0.95'
      },
      {
        name: 'value',
        type: 'sampling',
        value: 1,
        text: '1 minute',
        autoValue: true
      },
      {
        name: 'unit',
        type: 'sampling_unit',
        value: 'minutes',
        text: 'minutes'
      }
    ];
  }
}

// Rate aggregator
export class RateAggregator extends BaseAggregator {
  static readonly NAME = 'rate';
  
  constructor() {
    super(RateAggregator.NAME);
    this.parameters = [
      {
        name: 'unit',
        type: 'enum',
        value: 'SECONDS',
        text: 'SECONDS'
      }
    ];
  }
}

// Sampler aggregator
export class SamplerAggregator extends BaseAggregator {
  static readonly NAME = 'sampler';
  
  constructor() {
    super(SamplerAggregator.NAME);
    this.parameters = [
      {
        name: 'value',
        type: 'sampling',
        value: 1,
        text: '1 minute',
        autoValue: true
      },
      {
        name: 'unit',
        type: 'sampling_unit',
        value: 'minutes',
        text: 'minutes'
      }
    ];
  }
}

// Scale aggregator
export class ScaleAggregator extends BaseAggregator {
  static readonly NAME = 'scale';
  
  constructor() {
    super(ScaleAggregator.NAME);
    this.parameters = [
      {
        name: 'factor',
        type: 'any',
        value: 1,
        text: '1'
      }
    ];
  }
}

// Available aggregators list
export const AVAILABLE_AGGREGATORS: Aggregator[] = [
  new RangeAggregator('avg'),
  new RangeAggregator('count'),
  new RangeAggregator('dev'),
  new RangeAggregator('first'),
  new RangeAggregator('last'),
  new RangeAggregator('max'),
  new RangeAggregator('min'),
  new RangeAggregator('sum'),
  new BaseAggregator('diff'),
  new PercentileAggregator(),
  new RateAggregator(),
  new SamplerAggregator(),
  new ScaleAggregator(),
].sort((a, b) => a.name.localeCompare(b.name));

// Scalar aggregators (for enforcement)
export const SCALAR_AGGREGATOR_NAMES = [
  'avg', 'count', 'dev', 'diff', 'first', 'last', 'max', 'min', 
  'percentile', 'rate', 'sampler', 'scale', 'sum'
];

// Factory function to create aggregator from object
export function createAggregatorFromObject(obj: any): Aggregator {
  const aggregatorClass = AVAILABLE_AGGREGATORS.find(agg => agg.name === obj.name);
  if (aggregatorClass) {
    const newAgg = Object.create(Object.getPrototypeOf(aggregatorClass));
    newAgg.name = obj.name;
    newAgg.parameters = obj.parameters || [];
    return newAgg;
  }
  return new BaseAggregator(obj.name);
}