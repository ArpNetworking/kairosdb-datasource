import _ from "lodash";
import {Aggregator} from "../../beans/aggregators/aggregator";
import {AggregatorParameter} from "../../beans/aggregators/parameters/aggregator_parameter";
import {SamplingAggregatorParameter} from "../../beans/aggregators/parameters/sampling_aggregator_parameter";
import {SamplingUnitAggregatorParameter} from "../../beans/aggregators/parameters/sampling_unit_aggregator_parameter";
import {TemplatingUtils} from "../../utils/templating_utils";
import {SamplingConverter} from "./sampling_converter";

export class SamplingParameterConverter {
    private samplingConverter: SamplingConverter;
    private templatingUtils: TemplatingUtils;

    constructor(templatingUtils: TemplatingUtils, samplingConverter: SamplingConverter) {
        this.templatingUtils = templatingUtils;
        this.samplingConverter = samplingConverter;
    }

    public convertSamplingParameters(aggregator: Aggregator) {
        const parameters = aggregator.parameters;
        const samplingParameterIndex = this.findParameterIndex(parameters, SamplingAggregatorParameter.TYPE);
        const samplingUnitParameterIndex = this.findParameterIndex(parameters, SamplingUnitAggregatorParameter.TYPE);

        if (samplingParameterIndex > -1 && samplingUnitParameterIndex > -1) {
            const samplingParameter = parameters[samplingParameterIndex];
            const samplingUnitParameter = parameters[samplingUnitParameterIndex];

            const interpretedSamplingParameter = this.templatingUtils.replace(samplingParameter.value);
            if (interpretedSamplingParameter.length === 1) {
                samplingParameter.value = interpretedSamplingParameter[0];
            } else {
                throw new Error(
                    "Multi-value variables not supported in aggregator parameters; name=" + samplingParameter.name +
                    ", value=" + samplingParameter.value +
                    ", interpretedValues=" + interpretedSamplingParameter);
            }

            if (this.samplingConverter.isApplicable(samplingParameter.value)) {
                const convertedSampling =
                    this.samplingConverter.convert(samplingParameter.value, samplingUnitParameter.value);
                samplingParameter.value = convertedSampling.interval;
                samplingUnitParameter.value = convertedSampling.unit;
            }
        }
        return aggregator;
    }

    private findParameterIndex(parameters: AggregatorParameter[], type: string): number {
        return _.findIndex(parameters, (parameter) => parameter.type === type);
    }
}
