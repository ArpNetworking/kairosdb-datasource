import { TimeUnit } from '../utils';
import { AggregatorParameterType } from './aggregator_parameter';
import { EnumAggregatorParameter } from './enum_aggregator_parameter';

export class SamplingUnitAggregatorParameter extends EnumAggregatorParameter {
  static TYPE: AggregatorParameterType = 'sampling_unit';

  static fromObject(object: any): SamplingUnitAggregatorParameter {
    const rval = new SamplingUnitAggregatorParameter();
    rval.value = object.value;
    return rval;
  }

  constructor() {
    super('unit', TimeUnit, 'unit', 'HOURS');
    this.type = SamplingUnitAggregatorParameter.TYPE;
  }
}
