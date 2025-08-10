// KairosDB Aggregator definitions
import { Aggregator, AggregatorParameter, AutoValueSwitch } from './types';

// Base aggregator class
export class BaseAggregator implements Aggregator {
  public name: string;
  public parameters: AggregatorParameter[] = [];
  public autoValueSwitch?: AutoValueSwitch;

  constructor(name: string) {
    this.name = name;
  }

  public clone(): BaseAggregator {
    const cloned = new BaseAggregator(this.name);
    cloned.parameters = this.parameters.map(param => ({ ...param }));
    cloned.autoValueSwitch = this.autoValueSwitch ? { ...this.autoValueSwitch } : undefined;
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
        text: '1'
      },
      {
        name: 'unit',
        type: 'sampling_unit',
        value: 'minutes',
        text: 'minutes'
      }
    ];
    
    // Auto value switch controls sampling parameters
    this.autoValueSwitch = {
      enabled: true, // Default to auto mode
      dependentParameters: ['sampling', 'sampling_unit']
    };
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
        text: '1'
      },
      {
        name: 'unit',
        type: 'sampling_unit',
        value: 'minutes',
        text: 'minutes'
      }
    ];
    
    // Auto value switch controls sampling parameters
    this.autoValueSwitch = {
      enabled: true, // Default to auto mode
      dependentParameters: ['sampling', 'sampling_unit']
    };
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
        text: '1'
      },
      {
        name: 'unit',
        type: 'sampling_unit',
        value: 'minutes',
        text: 'minutes'
      }
    ];
    
    // Auto value switch controls sampling parameters
    this.autoValueSwitch = {
      enabled: true, // Default to auto mode
      dependentParameters: ['sampling', 'sampling_unit']
    };
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

// Merge aggregator for histograms
export class MergeAggregator extends RangeAggregator {
  static readonly NAME = 'merge';
  
  constructor() {
    super(MergeAggregator.NAME);
    this.parameters = [
      {
        name: 'value',
        type: 'sampling',
        value: 1,
        text: '1'
      },
      {
        name: 'unit',
        type: 'sampling_unit',
        value: 'minutes',
        text: 'minutes'
      },
      {
        name: 'precision',
        type: 'number',
        value: 12,
        text: '12'
      }
    ];
    
    // Auto value switch controls sampling parameters (not precision)
    this.autoValueSwitch = {
      enabled: true, // Default to auto mode
      dependentParameters: ['sampling', 'sampling_unit']
    };
  }
}

// Available aggregators list
export const AVAILABLE_AGGREGATORS: Aggregator[] = [
  new RangeAggregator('avg'),
  new RangeAggregator('count'),
  new RangeAggregator('dev'),
  new RangeAggregator('first'),
  new RangeAggregator('gaps'),
  new RangeAggregator('last'),
  new RangeAggregator('max'),
  new MergeAggregator(),
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
  'avg', 'count', 'dev', 'diff', 'first', 'gaps', 'last', 'max', 'merge', 'min', 
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
