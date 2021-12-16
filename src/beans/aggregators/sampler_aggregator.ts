import { Aggregator } from './aggregator';
import { EnumAggregatorParameter } from './parameters/enum_aggregator_parameter';
import { TimeUnit } from './utils';

export class SamplerAggregator extends Aggregator {
  static readonly NAME = 'sampler';

  static fromObject(object: any): SamplerAggregator {
    const rval = new SamplerAggregator();
    rval.parameters = [EnumAggregatorParameter.fromObject(object.parameters[0])];
    return rval;
  }

  constructor() {
    super(SamplerAggregator.NAME);
    this.parameters = this.parameters.concat([new EnumAggregatorParameter('unit', TimeUnit, 'every')]);
  }
}
