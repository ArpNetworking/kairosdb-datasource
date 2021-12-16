import { AggregatorParameter } from './parameters/aggregator_parameter';

export class Aggregator {
  name: string;
  parameters: AggregatorParameter[] = [];

  constructor(name: string) {
    this.name = name;
  }
}
