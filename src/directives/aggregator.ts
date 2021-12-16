import _ from 'lodash';
import { Aggregator } from '../beans/aggregators/aggregator';
import { AggregatorParameter } from '../beans/aggregators/parameters/aggregator_parameter';
import './aggregator_editor';
import { RangeAggregator } from '../beans/aggregators/range_aggregator';

export class AggregatorCtrl {
  // @ts-ignore
  value: Aggregator;
  // @ts-ignore
  isFirst: boolean;
  // @ts-ignore
  isLast: boolean;
  visibleParameters: AggregatorParameter[];
  isAutoValue = false;

  constructor() {
    // @ts-ignore
    if (this.value instanceof RangeAggregator) {
      this.isAutoValue = !_.isNil(this.value.autoValueSwitch) && this.value.autoValueSwitch.enabled;
    } else {
      this.isAutoValue = false;
    }
    // @ts-ignore
    this.visibleParameters = this.isAutoValue ? this.getVisibleParameters() : this.value.parameters;
  }

  private getVisibleParameters(): AggregatorParameter[] {
    if (this.value instanceof RangeAggregator) {
      const dependentParametersTypes = this.value.autoValueSwitch.dependentParameters.map(
        (parameter) => parameter.type
      );
      return this.value.parameters.filter((parameter) => !_.includes(dependentParametersTypes, parameter.type));
    }
    return [];
  }
}

export function AggregatorDirective() {
  return {
    bindToController: true,
    controller: AggregatorCtrl,
    controllerAs: 'ctrl',
    restrict: 'E',
    scope: {
      onRemove: '&',
      onUp: '&',
      onDown: '&',
      value: '=',
      isFirst: '=',
      isLast: '=',
    },
    templateUrl: 'public/plugins/grafana-kairosdb-datasource/partials/aggregator.html',
  };
}
