import _ from "lodash";
import {Aggregator} from "../beans/aggregators/aggregator";
import {AggregatorParameter} from "../beans/aggregators/parameters/aggregator_parameter";
import "./aggregator_editor";

export class AggregatorCtrl {
    public value: Aggregator;
    public isFirst: boolean;
    public isLast: boolean;
    public visibleParameters: AggregatorParameter[];
    public isAutoValue: boolean = false;
    private $onInit: () => void;

    constructor() {
        this.$onInit = function() {
            this.isAutoValue = !_.isNil(this.value.autoValueSwitch) && this.value.autoValueSwitch.enabled;
            this.visibleParameters = this.isAutoValue ? this.getVisibleParameters() : this.value.parameters;
        };
    }

    private getVisibleParameters(): AggregatorParameter[] {
        const dependentParametersTypes =
            this.value.autoValueSwitch.dependentParameters.map((parameter) => parameter.type);
        return this.value.parameters.filter((parameter) => !_.includes(dependentParametersTypes, parameter.type));
    }
}

export function AggregatorDirective() {
    return {
        bindToController: true,
        controller: AggregatorCtrl,
        controllerAs: "ctrl",
        restrict: "E",
        scope: {
            onRemove: "&",
            onUp: "&",
            onDown: "&",
            value: "=",
            isFirst: "=",
            isLast: "="
        },
        templateUrl: "public/plugins/grafana-kairosdb-datasource/partials/aggregator.html"
    };
}
