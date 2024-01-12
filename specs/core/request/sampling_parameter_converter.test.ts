import {expect} from "@jest/globals";
import {assert} from "chai";
import {Aggregator} from "../../../src/beans/aggregators/aggregator";
import {AnyAggregatorParameter} from "../../../src/beans/aggregators/parameters/any_aggregator_parameter";
import {SamplingAggregatorParameter} from "../../../src/beans/aggregators/parameters/sampling_aggregator_parameter";
import {SamplingUnitAggregatorParameter} from "../../../src/beans/aggregators/parameters/sampling_unit_aggregator_parameter";
import {TimeUnit} from "../../../src/beans/aggregators/utils";
import {SamplingParameterConverter} from "../../../src/core/request/sampling_parameter_converter";
import {TemplatingUtils} from "../../../src/utils/templating_utils";
import {TimeUnitUtils} from "../../../src/utils/time_unit_utils";
import {buildSamplingConverterMock, buildTemplatingSrvMock} from "../../mocks";

describe("SamplingParameterConverter", () => {
    const millisecondsString = TimeUnitUtils.getString(TimeUnit.MILLISECONDS);
    const convertedValue = "42000000";
    const variables = {
        tagname1: ["v1"],
        tagname2: ["v2", "v3"]
    };
    const templatingSrvMock = buildTemplatingSrvMock(variables);
    const templatingUtils: TemplatingUtils =
        new TemplatingUtils(templatingSrvMock, {});

    it("should update both sampling parameters", () => {
        // given
        const samplingConverterMock = buildSamplingConverterMock(convertedValue, millisecondsString, true);
        const samplingParameterConverter = new SamplingParameterConverter(templatingUtils, samplingConverterMock);
        const aggregator = new Aggregator("foo");
        const samplingUnitAggregatorParameter = new SamplingUnitAggregatorParameter();
        samplingUnitAggregatorParameter.value = TimeUnitUtils.getString(TimeUnit.HOURS);
        aggregator.parameters = [
            new SamplingAggregatorParameter("text", "1.2"),
            samplingUnitAggregatorParameter
        ];
        // when
        const convertedAggregator = samplingParameterConverter.convertSamplingParameters(aggregator);
        // then
        assert(samplingConverterMock.toHaveBeenCalledTimes(1));
        assert(samplingConverterMock.toHaveBeenCalledTimes(1));
        expect(convertedAggregator.parameters).toHaveLength(2);
        expect(convertedAggregator.parameters[0].value).toBe(convertedValue);
        expect(convertedAggregator.parameters[1].value).toBe(millisecondsString);
    });

    it("should not convert parameter-less aggregator", () => {
        // given
        const samplingConverterMock = buildSamplingConverterMock(convertedValue, millisecondsString, true);
        const samplingParameterConverter = new SamplingParameterConverter(templatingUtils, samplingConverterMock);
        const aggregator = new Aggregator("foo");
        // when
        const convertedAggregator = samplingParameterConverter.convertSamplingParameters(aggregator);
        // then
        expect(convertedAggregator.parameters).toHaveLength(0);
        assert(samplingConverterMock.isApplicable.notCalled);
        assert(samplingConverterMock.convert.notCalled);
    });

    it("should pass not applicable parameters", () => {
        // given
        const samplingConverterMock = buildSamplingConverterMock(convertedValue, millisecondsString, true);
        const samplingParameterConverter = new SamplingParameterConverter(templatingUtils, samplingConverterMock);
        const aggregator = new Aggregator("foo");
        const parameter = new AnyAggregatorParameter("bar", "bar", "1");
        aggregator.parameters = [parameter];
        // when
        const convertedAggregator = samplingParameterConverter.convertSamplingParameters(aggregator);
        // then
        expect(convertedAggregator.parameters).toHaveLength(1);
        assert(samplingConverterMock.isApplicable.notCalled);
        assert(samplingConverterMock.convert.notCalled);
    });

    it("should pass when only unit parameter is present", () => {
        // given
        const samplingConverterMock = buildSamplingConverterMock(convertedValue, millisecondsString, true);
        const samplingParameterConverter = new SamplingParameterConverter(templatingUtils, samplingConverterMock);
        const aggregator = new Aggregator("foo");
        const parameter = new SamplingUnitAggregatorParameter();
        aggregator.parameters = [parameter];
        // when
        const convertedAggregator = samplingParameterConverter.convertSamplingParameters(aggregator);
        // then
        expect(convertedAggregator.parameters).toHaveLength(1);
        assert(samplingConverterMock.isApplicable.notCalled);
        assert(samplingConverterMock.convert.notCalled);
    });
});
