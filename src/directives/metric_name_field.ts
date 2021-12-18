import _ from 'lodash';
import { PromiseUtils } from '../utils/promise_utils';

const METRIC_NAMES_SUGGESTIONS_LIMIT = 20;

export class MetricNameFieldCtrl {
  // @ts-ignore
  value: string;
  // @ts-ignore
  metricNames: string[];
  // @ts-ignore
  alias: string;
  segment: any;
  aliasInputVisible = false;
  aliasAddedVisible = false;
  // @ts-ignore
  private $q: any;
  private $scope: any;
  private promiseUtils: PromiseUtils;

  /** @ngInject **/
  constructor($scope, $q, private uiSegmentSrv) {
    this.$scope = $scope;
    this.$q = $q;
    this.uiSegmentSrv = uiSegmentSrv;
    this.promiseUtils = new PromiseUtils($q);
    // @ts-ignore
    this.segment = this.value ? uiSegmentSrv.newSegment(this.value) : uiSegmentSrv.newSelectMetric();
    // @ts-ignore
    this.aliasAddedVisible = !_.isNil(this.alias);
  }

  onChange(segment): void {
    this.value = this.$scope.getMetricInputValue();
  }

  suggestMetrics(): string[] {
    const query = this.$scope.getMetricInputValue();
    return this.promiseUtils.resolvedPromise(
      this.metricNames
        .filter((metricName) => _.includes(metricName, query))
        .slice(0, METRIC_NAMES_SUGGESTIONS_LIMIT)
        .map((metricName) => {
          return this.uiSegmentSrv.newSegment(metricName);
        })
    );
  }

  setAlias(alias): void {
    if (!_.isEmpty(alias)) {
      this.alias = alias;
      this.aliasAddedVisible = true;
    }
    this.aliasInputVisible = false;
  }
}

export class MetricNameFieldLink {
  constructor(scope, element) {
    scope.getMetricInputValue = () => {
      return element[0].getElementsByTagName('input')[0].value;
    };
  }
}

export function MetricNameFieldDirective() {
  return {
    bindToController: true,
    controller: MetricNameFieldCtrl,
    controllerAs: 'ctrl',
    link: MetricNameFieldLink,
    restrict: 'E',
    scope: {
      alias: '=',
      metricNames: '=',
      value: '=',
    },
    templateUrl: 'public/plugins/grafana-kairosdb-datasource/partials/metric.name.field.html',
  };
}
