import {
    AggregatorParameter,
    AggregatorParameterType
} from "../../../src/beans/aggregators/parameters/aggregator_parameter";
import {AlignmentAggregatorParameter} from "../../../src/beans/aggregators/parameters/alignment_aggregator_parameter";
import {AnyAggregatorParameter} from "../../../src/beans/aggregators/parameters/any_aggregator_parameter";
import {SamplingAggregatorParameter} from "../../../src/beans/aggregators/parameters/sampling_aggregator_parameter";
import {SamplingUnitAggregatorParameter} from "../../../src/beans/aggregators/parameters/sampling_unit_aggregator_parameter";
import {TimeUnit, UnitValue} from "../../../src/beans/aggregators/utils";
import {ParameterObjectBuilder} from "../../../src/core/request/parameter_object_builder";
import {AutoValueSwitch} from "../../../src/directives/auto_value_switch";
import {TemplatingUtils} from "../../../src/utils/templating_utils";
import {buildTemplatingSrvMock} from "../../mocks";

describe("ParameterObjectBuilder", () => {
    const INTERVAL_VALUE = "42";
    const INTERVAL_UNIT = "s";
    const INTERVAL = INTERVAL_VALUE + INTERVAL_UNIT;
    const snapToIntervals: UnitValue[] = [
        [TimeUnit.MINUTES, 1],
        [TimeUnit.MINUTES, 5],
        [TimeUnit.HOURS, 1],
        [TimeUnit.DAYS, 1]
    ];
    const variables = {
        tagname1: ["v1"],
        tagname2: ["v2", "v3"]
    };
    const templatingSrvMock = buildTemplatingSrvMock(variables);
    const templatingUtils: TemplatingUtils =
        new TemplatingUtils(templatingSrvMock, {});

    it("should throw on unknown alignment type", () => {
        expect(() => {
            // given
            const parameterObjectBuilder: ParameterObjectBuilder = new ParameterObjectBuilder(templatingUtils, INTERVAL, null);
            const alignmentType = "UnKnOwN";
            const alignmentParameter: AggregatorParameter = new AlignmentAggregatorParameter();
            alignmentParameter.value = alignmentType;
            // when
            parameterObjectBuilder.build(alignmentParameter);
        }).toThrow("Unknown alignment type");
    });

    it("should build default parameter given unknown parameter type", () => {
        // given
        const parameterObjectBuilder: ParameterObjectBuilder = new ParameterObjectBuilder(templatingUtils, INTERVAL, null);
        const parameter = new AnyAggregatorParameter("parameterOfUnknownType");
        parameter.type = ("UnKnOwN" as AggregatorParameterType);
        parameter.name = "unknownParameterName";
        parameter.value = "unknownParameterValue";
        // when
        const parameterObject = parameterObjectBuilder.build(parameter);
        // then
        expect(parameterObject).toHaveProperty(parameter.name);
        expect(parameterObject[parameter.name]).toBe(parameter.value);
    });

    it("should use interval values for sampling parameter when auto value is enabled", () => {
        // given
        const parameter = new SamplingAggregatorParameter("every", "1");
        const autoValueSwitch = new AutoValueSwitch([parameter]);
        autoValueSwitch.enabled = true;
        const parameterObjectBuilder: ParameterObjectBuilder =
            new ParameterObjectBuilder(templatingUtils, INTERVAL, autoValueSwitch);
        // when
        const parameterObject = parameterObjectBuilder.build(parameter);
        // then
        expect(parameterObject.sampling.value).toBe(INTERVAL_VALUE);
    });

    it("should use interval values snapped to the closest value when auto value is enabled", () => {
        const samplingParameter = new SamplingAggregatorParameter("every", "1");
        const samplingUnitParameter = new SamplingUnitAggregatorParameter();
        const autoValueSwitch = new AutoValueSwitch([samplingParameter, samplingUnitParameter]);
        autoValueSwitch.enabled = true;
        const parameterObjectBuilder = new ParameterObjectBuilder(templatingUtils, "120s", autoValueSwitch, snapToIntervals);
        const samplingParameterObject = parameterObjectBuilder.build(samplingParameter);
        const samplingUnitParameterObject = parameterObjectBuilder.build(samplingUnitParameter);

        expect(samplingParameterObject.sampling.value).toBe("5");
        expect(samplingUnitParameterObject.sampling.unit).toBe("MINUTES");
    });
});
