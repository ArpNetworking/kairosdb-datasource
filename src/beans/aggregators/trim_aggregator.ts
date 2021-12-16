import { Aggregator } from './aggregator';
import { EnumAggregatorParameter } from './parameters/enum_aggregator_parameter';
import { Trim } from './utils';

export class TrimAggregator extends Aggregator {
  static readonly NAME = 'trim';

  static fromObject(object: any): TrimAggregator {
    const rval = new TrimAggregator();
    rval.parameters = [EnumAggregatorParameter.fromObject(object.parameters[0])];
    return rval;
  }

  constructor() {
    super(TrimAggregator.NAME);
    this.parameters = this.parameters.concat([new EnumAggregatorParameter('trim', Trim, 'by')]);
  }
}
