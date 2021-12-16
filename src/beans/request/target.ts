import { dateMath, TimeRange } from '@grafana/data';
import { Aggregator } from '../aggregators/aggregator';
import * as Aggregators from '../aggregators/aggregators';
import { AggregatorParameter } from '../aggregators/parameters/aggregator_parameter';
import { GroupBy } from './group_by';

export class KairosDBTarget {
  static fromObject(object: any): KairosDBTarget {
    if (object) {
      const rval = new KairosDBTarget(
        object.metricName,
        object.alias,
        object.tags || {},
        GroupBy.fromObject(object.groupBy),
        (object.aggregators || []).map(Aggregators.fromObject),
        object.timeRange,
        object.overrideScalar
      );
      return rval;
    }
    throw 'Object was not well formed';
  }

  metricName: string;
  alias?: string = undefined;
  tags: { [key: string]: string[] } = {};
  groupBy: GroupBy = new GroupBy();
  aggregators: Aggregator[] = [];
  timeRange?: TimeRange;
  overrideScalar?: boolean = undefined;

  constructor(
    metricName: string,
    alias?: string,
    tags?: { [key: string]: string[] },
    groupBy?: GroupBy,
    aggregators?: Aggregator[],
    timeRange?: TimeRange,
    overrideScalar?: boolean
  ) {
    this.metricName = metricName;
    this.alias = alias;
    this.tags = tags || {};
    this.groupBy = groupBy || new GroupBy();
    this.aggregators = aggregators || [];
    this.timeRange = timeRange;
    this.overrideScalar = overrideScalar;
  }

  startTime(): number | undefined {
    if (this.timeRange) {
      const startMoment = dateMath.parse(this.timeRange.from);
      if (startMoment) {
        return startMoment.unix() * 1000;
      }
    }
    return undefined;
  }

  endTime(): number | undefined {
    if (this.timeRange) {
      const endMoment = dateMath.parse(this.timeRange.to);
      if (endMoment) {
        return endMoment.unix() * 1000;
      }
    }
    return undefined;
  }

  asString(): string {
    let str = 'SELECT ';

    if (this.aggregators.length > 0) {
      this.aggregators
        .slice()
        .reverse()
        .forEach((agg: Aggregator) => {
          str += agg.name + '(';
        });

      this.aggregators.forEach((agg: Aggregator, aggIndex: number) => {
        if (aggIndex === 0) {
          str += '*';
        }

        agg.parameters
          .filter((param) => {
            return param.type === 'any' || param.type === 'enum';
          })
          .forEach((param: AggregatorParameter, index: number) => {
            if (aggIndex === 0 || index !== 0) {
              str += ', ';
            }
            str += param.value;
          });

        str += ')';
      });
    } else {
      str += '*';
    }

    if (this.alias) {
      str += ' as ' + this.alias;
    }

    str += ' FROM ' + this.metricName;

    if (Object.keys(this.tags).length > 0) {
      const filteredKeys = Object.keys(this.tags).filter((key) => {
        return !(this.tags[key] === undefined || this.tags[key].length === 0);
      });
      if (filteredKeys.length > 0) {
        str += ' WHERE ';
        filteredKeys.forEach((key: string, index: number) => {
          if (index !== 0) {
            str += ', ';
          }
          const value = this.tags[key];

          if (value.length > 1) {
            str += key + '=[' + value.join(',') + ']';
          } else {
            str += key + '=' + value[0];
          }
        });
      }
    }

    str += this.groupBy.asString();

    return str;
  }
}
