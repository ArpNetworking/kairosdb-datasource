System.register(["lodash", "../utils/promise_utils"], function (exports_1, context_1) {
    "use strict";
    var lodash_1, promise_utils_1, METRIC_NAMES_SUGGESTIONS_LIMIT, MetricNameFieldCtrl, MetricNameFieldLink;
    var __moduleName = context_1 && context_1.id;
    function MetricNameFieldDirective() {
        return {
            bindToController: true,
            controller: MetricNameFieldCtrl,
            controllerAs: "ctrl",
            link: MetricNameFieldLink,
            restrict: "E",
            scope: {
                alias: "=",
                autocompleteMaxMetrics: "=",
                metricNames: "=",
                value: "="
            },
            templateUrl: "public/plugins/grafana-kairosdb-datasource/partials/metric.name.field.html"
        };
    }
    exports_1("MetricNameFieldDirective", MetricNameFieldDirective);
    return {
        setters: [
            function (lodash_1_1) {
                lodash_1 = lodash_1_1;
            },
            function (promise_utils_1_1) {
                promise_utils_1 = promise_utils_1_1;
            }
        ],
        execute: function () {
            METRIC_NAMES_SUGGESTIONS_LIMIT = 20;
            MetricNameFieldCtrl = (function () {
                function MetricNameFieldCtrl($scope, $q, uiSegmentSrv) {
                    this.uiSegmentSrv = uiSegmentSrv;
                    this.aliasInputVisible = false;
                    this.aliasAddedVisible = false;
                    this.$scope = $scope;
                    this.$q = $q;
                    this.uiSegmentSrv = uiSegmentSrv;
                    this.promiseUtils = new promise_utils_1.PromiseUtils($q);
                    this.segment = this.value ? uiSegmentSrv.newSegment(this.value) : uiSegmentSrv.newSelectMetric();
                    this.aliasAddedVisible = !lodash_1.default.isNil(this.alias);
                }
                MetricNameFieldCtrl.prototype.onChange = function (segment) {
                    this.value = this.$scope.getMetricInputValue();
                };
                MetricNameFieldCtrl.prototype.suggestMetrics = function () {
                    var _this = this;
                    var query = this.$scope.getMetricInputValue();
                    return this.promiseUtils.resolvedPromise(this.metricNames
                        .filter(function (metricName) { return lodash_1.default.includes(metricName, query); })
                        .slice(0, this.autocompleteMaxMetrics)
                        .map(function (metricName) {
                        return _this.uiSegmentSrv.newSegment(metricName);
                    }));
                };
                MetricNameFieldCtrl.prototype.setAlias = function (alias) {
                    if (!lodash_1.default.isEmpty(alias)) {
                        this.alias = alias;
                        this.aliasAddedVisible = true;
                    }
                    this.aliasInputVisible = false;
                };
                return MetricNameFieldCtrl;
            }());
            exports_1("MetricNameFieldCtrl", MetricNameFieldCtrl);
            MetricNameFieldLink = (function () {
                function MetricNameFieldLink(scope, element) {
                    scope.getMetricInputValue = function () {
                        return element[0].getElementsByTagName("input")[0].value;
                    };
                }
                return MetricNameFieldLink;
            }());
            exports_1("MetricNameFieldLink", MetricNameFieldLink);
        }
    };
});
//# sourceMappingURL=metric_name_field.js.map