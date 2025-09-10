// KairosDB Aggregator definitions
import { Aggregator, AggregatorParameter, AutoValueSwitch } from './types';

// Base aggregator class
export class BaseAggregator implements Aggregator {
  public name: string;
  public parameters: AggregatorParameter[] = [];
  public autoValueSwitch?: AutoValueSwitch;
  public visible = true; // Default to visible

  constructor(name: string) {
    this.name = name;
  }

  public clone(): BaseAggregator {
    const cloned = new BaseAggregator(this.name);
    cloned.parameters = this.parameters.map((param) => ({ ...param }));
    cloned.autoValueSwitch = this.autoValueSwitch ? { ...this.autoValueSwitch } : undefined;
    cloned.visible = this.visible;
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
        text: '1',
      },
      {
        name: 'unit',
        type: 'sampling_unit',
        value: 'minutes',
        text: 'minutes',
      },
    ];

    // Auto value switch controls sampling parameters
    this.autoValueSwitch = {
      enabled: true, // Default to auto mode
      dependentParameters: ['sampling', 'sampling_unit'],
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
        text: '0.95',
      },
      {
        name: 'value',
        type: 'sampling',
        value: 1,
        text: '1',
      },
      {
        name: 'unit',
        type: 'sampling_unit',
        value: 'minutes',
        text: 'minutes',
      },
    ];

    // Auto value switch controls sampling parameters
    this.autoValueSwitch = {
      enabled: true, // Default to auto mode
      dependentParameters: ['sampling', 'sampling_unit'],
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
        text: 'SECONDS',
      },
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
        text: '1',
      },
      {
        name: 'unit',
        type: 'sampling_unit',
        value: 'minutes',
        text: 'minutes',
      },
    ];

    // Auto value switch controls sampling parameters
    this.autoValueSwitch = {
      enabled: true, // Default to auto mode
      dependentParameters: ['sampling', 'sampling_unit'],
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
        text: '1',
      },
    ];
  }
}

// Filter aggregator
export class FilterAggregator extends BaseAggregator {
  static readonly NAME = 'filter';

  constructor() {
    super(FilterAggregator.NAME);
    this.parameters = [
      {
        name: 'filter_op',
        type: 'enum',
        value: 'GT',
        text: 'GT',
      },
      {
        name: 'threshold',
        type: 'any',
        value: 0,
        text: '0',
      },
      {
        name: 'filter_indeterminate_inclusion',
        type: 'enum',
        value: 'keep',
        text: 'keep',
      },
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
        text: '1',
      },
      {
        name: 'unit',
        type: 'sampling_unit',
        value: 'minutes',
        text: 'minutes',
      },
      {
        name: 'precision',
        type: 'number',
        value: 12,
        text: '12',
      },
    ];

    // Auto value switch controls sampling parameters (not precision)
    this.autoValueSwitch = {
      enabled: true, // Default to auto mode
      dependentParameters: ['sampling', 'sampling_unit'],
    };
  }
}

// Apdex aggregator
export class ApdexAggregator extends RangeAggregator {
  static readonly NAME = 'apdex';

  constructor() {
    super(ApdexAggregator.NAME);
    this.parameters = [
      {
        name: 'value',
        type: 'sampling',
        value: 1,
        text: '1',
      },
      {
        name: 'unit',
        type: 'sampling_unit',
        value: 'minutes',
        text: 'minutes',
      },
      {
        name: 'target',
        type: 'any',
        value: 0.5,
        text: '0.5',
      },
    ];

    // Auto value switch controls sampling parameters (not target)
    this.autoValueSwitch = {
      enabled: true, // Default to auto mode
      dependentParameters: ['sampling', 'sampling_unit'],
    };
  }
}

// Simple Moving Average aggregator
export class SmaAggregator extends BaseAggregator {
  static readonly NAME = 'sma';

  constructor() {
    super(SmaAggregator.NAME);
    this.parameters = [
      {
        name: 'size',
        type: 'any',
        value: 10,
        text: '10',
      },
    ];
  }
}

// Divide aggregator
export class DivideAggregator extends BaseAggregator {
  static readonly NAME = 'div';

  constructor() {
    super(DivideAggregator.NAME);
    this.parameters = [
      {
        name: 'divisor',
        type: 'any',
        value: 1,
        text: '1',
      },
    ];
  }
}

// Trim aggregator
export class TrimAggregator extends BaseAggregator {
  static readonly NAME = 'trim';

  constructor() {
    super(TrimAggregator.NAME);
    this.parameters = [
      {
        name: 'trim',
        type: 'enum',
        value: 'first',
        text: 'first',
      },
    ];
  }
}

// Available aggregators list
export const AVAILABLE_AGGREGATORS: Aggregator[] = [
  new ApdexAggregator(),
  new RangeAggregator('avg'),
  new RangeAggregator('count'),
  new RangeAggregator('dev'),
  new BaseAggregator('diff'),
  new DivideAggregator(),
  new FilterAggregator(),
  new RangeAggregator('first'),
  new RangeAggregator('gaps'),
  new RangeAggregator('last'),
  new RangeAggregator('least_squares'),
  new RangeAggregator('max'),
  new MergeAggregator(),
  new RangeAggregator('min'),
  new RangeAggregator('movingWindow'),
  new BaseAggregator('percent_remaining'),
  new PercentileAggregator(),
  new RateAggregator(),
  new SamplerAggregator(),
  new ScaleAggregator(),
  new SmaAggregator(),
  new RangeAggregator('sum'),
  new TrimAggregator(),
].sort((a, b) => a.name.localeCompare(b.name));

// Scalar aggregators (for enforcement)
export const SCALAR_AGGREGATOR_NAMES = [
  'apdex',
  'avg',
  'count',
  'dev',
  'diff',
  'div',
  'filter',
  'first',
  'gaps',
  'last',
  'least_squares',
  'max',
  'merge',
  'min',
  'movingWindow',
  'percent_remaining',
  'percentile',
  'rate',
  'sampler',
  'scale',
  'sma',
  'sum',
  'trim',
];

// Factory function to create aggregator from object
export function createAggregatorFromObject(obj: any): Aggregator {
  const aggregatorClass = AVAILABLE_AGGREGATORS.find((agg) => agg.name === obj.name);
  if (aggregatorClass) {
    const newAgg = Object.create(Object.getPrototypeOf(aggregatorClass));
    newAgg.name = obj.name;
    newAgg.parameters = obj.parameters || [];
    newAgg.visible = obj.visible !== undefined ? obj.visible : true; // Default to visible
    return newAgg;
  }
  const baseAgg = new BaseAggregator(obj.name);
  baseAgg.visible = obj.visible !== undefined ? obj.visible : true; // Default to visible
  return baseAgg;
}
