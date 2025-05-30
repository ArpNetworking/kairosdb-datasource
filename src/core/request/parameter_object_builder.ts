import _ from "lodash";

import {AggregatorParameter} from "../../beans/aggregators/parameters/aggregator_parameter";
import {TimeUnit, UnitValue} from "../../beans/aggregators/utils";
import {AutoValueSwitch} from "../../directives/auto_value_switch";
import {TemplatingUtils} from "../../utils/templating_utils";
import {TimeUnitUtils} from "../../utils/time_unit_utils";

export class ParameterObjectBuilder {
    private templatingUtils: TemplatingUtils;
    private autoValueEnabled: boolean;
    private autoValueDependentParameters: string[] = [];
    private autoIntervalValue: string;
    private autoIntervalUnit: string;

    constructor(templatingUtils: TemplatingUtils, interval: string, autoValueSwitch: AutoValueSwitch, snapToIntervals?: UnitValue[]) {
        this.templatingUtils = templatingUtils;
        this.autoValueEnabled = !_.isNil(autoValueSwitch) && autoValueSwitch.enabled;
        if (this.autoValueEnabled) {
            this.autoValueDependentParameters = autoValueSwitch.dependentParameters
                .map((parameter) => parameter.type);
        }
        if (snapToIntervals && snapToIntervals.length > 0) {
          [this.autoIntervalUnit, this.autoIntervalValue] = TimeUnitUtils.ceilingToAvailableUnit(interval, snapToIntervals);
        } else {
          const [unit, value] = TimeUnitUtils.intervalToUnitValue(interval);
          this.autoIntervalValue = value.toString();
          this.autoIntervalUnit = TimeUnit[unit];
        }
    }

    public build(parameter: AggregatorParameter): any {
        switch (parameter.type) {
            case "alignment":
                return this.buildAlignmentParameter(parameter);
            case "sampling":
                return this.buildSamplingParameter(parameter, this.autoIntervalValue);
            case "sampling_unit":
                return this.buildSamplingParameter(parameter, this.autoIntervalUnit);
            default:
                return this.buildDefault(parameter);
        }
    }

    private buildAlignmentParameter(parameter: AggregatorParameter): any {
        switch (parameter.value) {
            case "NONE":
                return {};
            case "START_TIME":
                return {
                    align_start_time: true
                };
            case "SAMPLING":
                return {
                    align_sampling: true
                };
            case "PERIOD":
                return {
                    align_sampling: true,
                    align_start_time: true
                };
            default:
                throw new Error("Unknown alignment type");
        }
    }

    private buildSamplingParameter(parameter: AggregatorParameter, autoValue: string) {
        const parameterObject = {sampling: {}};
        parameterObject.sampling[parameter.name] =
            this.isOverriddenByAutoValue(parameter) ? autoValue : parameter.value;
        return parameterObject;
    }

    private buildDefault(parameter: AggregatorParameter) {
        const parameterObject = {};
        const interpretedValues = this.templatingUtils.replace(parameter.value);
        if (interpretedValues.length === 1) {
            if (interpretedValues[0]) {
                parameterObject[parameter.name] = interpretedValues[0];
            }
        } else {
            throw new Error(
                "Multi-value variables not supported in aggregator parameters; name=" + parameter.name +
                ", value=" + parameter.value +
                ", interpretedValues=" + interpretedValues);
        }
        return parameterObject;
    }

    private isOverriddenByAutoValue(parameter: AggregatorParameter) {
        return _.includes(this.autoValueDependentParameters, parameter.type);
    }
}
