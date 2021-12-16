import { AggregatorParameter } from '../beans/aggregators/parameters/aggregator_parameter';

export class AutoValueSwitch {
  static fromObject(object: any, dependentParameters: AggregatorParameter[]): AutoValueSwitch {
    const rval = new AutoValueSwitch(dependentParameters);
    rval.enabled = object.enabled;
    return rval;
  }

  dependentParameters: AggregatorParameter[];
  enabled = false;

  constructor(dependentParameters: AggregatorParameter[]) {
    this.dependentParameters = dependentParameters;
    this.enabled = true;
  }
}
