import {expect} from "@jest/globals";
import {TimeUnit} from "../../../src/beans/aggregators/utils";
import {SamplingConverter} from "../../../src/core/request/sampling_converter";
import {TimeUnitUtils} from "../../../src/utils/time_unit_utils";

describe("SamplingParameterConverter", () => {
    const samplingConverter = new SamplingConverter();
    it("should recognize as applicable", () => {
        // given
        // when
        const isApplicable = samplingConverter.isApplicable(42.2);
        // then
        // tslint:disable-next-line
        expect(isApplicable).toBe(true);
    });

    it("should not recognize as applicable", () => {
        // given
        // when
        const isApplicable = samplingConverter.isApplicable(42.0);
        // then
        // tslint:disable-next-line
        expect(isApplicable).toBe(false);
    });

    it("should not recognize as applicable", () => {
        // given
        // when
        const isApplicable = samplingConverter.isApplicable(42);
        // then
        // tslint:disable-next-line
        expect(isApplicable).toBe(false);
    });

    it("should convert to milliseconds", () => {
        // given
        const unit = TimeUnitUtils.getString(TimeUnit.HOURS);
        const value = 1.5;
        // when
        const convertedSampling = samplingConverter.convert(value, unit);
        // then
        expect(convertedSampling.unit).toBe("MILLISECONDS");
        expect(convertedSampling.interval).toBe("5400000");
    });

    it("should throw when value is is float and time unit is milliseconds", () => {
        expect(() => {
            // given
            const unit = TimeUnitUtils.getString(TimeUnit.MILLISECONDS);
            const value = 1.5;
            // when
            samplingConverter.convert(value, unit);
        }).toThrow();
    });
});
