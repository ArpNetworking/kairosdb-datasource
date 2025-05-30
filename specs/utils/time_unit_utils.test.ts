import forEach from "mocha-each";
import {TimeUnit, UnitValue} from "../../src/beans/aggregators/utils";
import {TimeUnitUtils} from "../../src/utils/time_unit_utils";

describe("TimeUnitUtils", () => {
    describe("extractUnit", () => {
        it("should extract 's' from '1s'", () => {
            // given
            const interval = "1s";
            // when
            const extractedTimeUnit = TimeUnitUtils.extractUnit(interval);
            // then
            // tslint:disable-next-line
            expect(extractedTimeUnit).toBe("s");
        });
        it("should extract 'm' from '1.5m'", () => {
            // given
            const interval = "1.5m";
            // when
            const extractedTimeUnit = TimeUnitUtils.extractUnit(interval);
            // then
            // tslint:disable-next-line
            expect(extractedTimeUnit).toBe("m");
        });
    });
    describe("extractValue", () => {
        it("should extract '2' from '2h'", () => {
            const interval = "2h";
            // when
            const extractedTimeValue = TimeUnitUtils.extractValue(interval);
            // then
            // tslint:disable-next-line
            expect(extractedTimeValue).toBe("2");
        });
        it("should extract '3.5' from '3.5d'", () => {
            const interval = "3.5d";
            // when
            const extractedTimeValue = TimeUnitUtils.extractValue(interval);
            // then
            // tslint:disable-next-line
            expect(extractedTimeValue).toBe("3.5");
        });
    });
    describe("convertTimeUnit", () => {
        forEach([
            ["ms", "MILLISECONDS"],
            ["s", "SECONDS"],
            ["m", "MINUTES"],
            ["h", "HOURS"],
            ["d", "DAYS"],
            ["w", "WEEKS"],
            ["M", "MONTHS"],
            ["y", "YEARS"]
        ]).it("should convert short format time unit: %s into %s", (timeUnit, expected) => {
            expect(TimeUnitUtils.convertTimeUnit(timeUnit)).toBe(expected);
        });
        forEach([
            ["millisecond", "MILLISECONDS"],
            ["second", "SECONDS"],
            ["minute", "MINUTES"],
            ["hour", "HOURS"],
            ["day", "DAYS"],
            ["week", "WEEKS"],
            ["month", "MONTHS"],
            ["year", "YEARS"]
        ]).it("should convert long format time unit: %s into %s", (timeUnit, expected) => {
            expect(TimeUnitUtils.convertTimeUnit(timeUnit)).toBe(expected);
        });
    });
    describe("getString", () => {
        forEach([
            [TimeUnit.MILLISECONDS, "MILLISECONDS"],
            [TimeUnit.SECONDS, "SECONDS"],
            [TimeUnit.MINUTES, "MINUTES"],
            [TimeUnit.HOURS, "HOURS"],
            [TimeUnit.DAYS, "DAYS"],
            [TimeUnit.WEEKS, "WEEKS"],
            [TimeUnit.MONTHS, "MONTHS"],
            [TimeUnit.YEARS, "YEARS"]
        ]).it("should use TimeUnit.%s and get %s", (timeUnit, expected) => {
            expect(TimeUnitUtils.getString(timeUnit)).toBe(expected);
        });
    });
    describe("getShortUnit", () => {
        forEach([
            ["MILLISECONDS", "ms"],
            ["SECONDS", "s"],
            ["MINUTES", "m"],
            ["HOURS", "h"],
            ["DAYS", "d"],
            ["WEEKS", "w"],
            ["MONTHS", "M"],
            ["YEARS", "y"]
        ]).it("should use %s and get %s", (timeUnit, expected) => {
            expect(TimeUnitUtils.getShortUnit(timeUnit)).toBe(expected);
        });
    });
    describe("intervalToUnitValue", () => {
        forEach([
            ["1ms", [TimeUnit.MILLISECONDS, 1]],
            ["2.5s", [TimeUnit.SECONDS, 2.5]],
            ["3m", [TimeUnit.MINUTES, 3]],
            ["4h", [TimeUnit.HOURS, 4]],
            ["1d", [TimeUnit.DAYS, 1]],
            ["1w", [TimeUnit.WEEKS, 1]],
            ["1M", [TimeUnit.MONTHS, 1]],
            ["1y", [TimeUnit.YEARS, 1]],
            ["3b", [undefined, 3]],
            ["h", [TimeUnit.HOURS, NaN]]
        ]).it("should use %s and get %s", (interval, expected) => {
            expect(TimeUnitUtils.intervalToUnitValue(interval)).toEqual(expected);
        });
    });

    describe("intervalsToUnitValues", () => {
        forEach([
            ["1ms,2.5s,3m", [[TimeUnit.MILLISECONDS, 1], [TimeUnit.SECONDS, 2.5], [TimeUnit.MINUTES, 3]]],
            ["4h,1d, 1w", [[TimeUnit.HOURS, 4], [TimeUnit.DAYS, 1], [TimeUnit.WEEKS, 1]]],
            ["1w,1d, 4h,3b,h", [[TimeUnit.HOURS, 4], [TimeUnit.DAYS, 1], [TimeUnit.WEEKS, 1]]]
        ]).it("should use %s and get %s", (interval, expected) => {
            expect(TimeUnitUtils.intervalsToUnitValues(interval)).toEqual(expected);
        });
    });

    describe("unitValueToMillis", () => {
        forEach([
            [[TimeUnit.MILLISECONDS, 10], 10],
            [[TimeUnit.SECONDS, 10], 10000],
            [[TimeUnit.MINUTES, 1], 60000],
            [[TimeUnit.HOURS, 1], 60 * 60 * 1000],
            [[TimeUnit.DAYS, 1], 24 * 60 * 60 * 1000],
            [[TimeUnit.WEEKS, 1], 7 * 24 * 60 * 60 * 1000]
        ]).it("should use %s and get %s", (unitValue, expected) => {
            expect(TimeUnitUtils.unitValueToMillis(unitValue)).toBe(expected);
        });
    });

    describe("intervalToMillis", () => {
        forEach([
            ["10ms", 10],
            ["10s", 10000],
            ["1m", 60000],
            ["1h", 60 * 60 * 1000],
            ["1d", 24 * 60 * 60 * 1000],
            ["1w", 7 * 24 * 60 * 60 * 1000]
        ]).it("should use %s and get %s", (interval, expected) => {
            expect(TimeUnitUtils.intervalToMillis(interval)).toBe(expected);
        });
    });

    describe("timeUnitToMillis", () => {
        forEach([
            [TimeUnit.MILLISECONDS, 1],
            [TimeUnit.SECONDS, 1000],
            [TimeUnit.MINUTES, 60 * 1000],
            [TimeUnit.HOURS, 60 * 60 * 1000],
            [TimeUnit.DAYS, 24 * 60 * 60 * 1000],
            [TimeUnit.WEEKS, 7 * 24 * 60 * 60 * 1000]
        ]).it("should use %s and get %s", (unit, expected) => {
            expect(TimeUnitUtils.timeUnitToMillis(unit)).toBe(expected);
        });
    });

    describe("ceilingToAvailableUnit", () => {
        const availableUnits: UnitValue[] = [
            [TimeUnit.MINUTES, 1],
            [TimeUnit.MINUTES, 5],
            [TimeUnit.HOURS, 1],
            [TimeUnit.DAYS, 1]
        ];

        forEach([
            ["1ms", [TimeUnitUtils.getString(TimeUnit.MINUTES), "1"]],
            ["1s", [TimeUnitUtils.getString(TimeUnit.MINUTES), "1"]],
            ["1m", [TimeUnitUtils.getString(TimeUnit.MINUTES), "1"]],
            ["2m", [TimeUnitUtils.getString(TimeUnit.MINUTES), "5"]],
            ["5m", [TimeUnitUtils.getString(TimeUnit.MINUTES), "5"]],
            ["10m", [TimeUnitUtils.getString(TimeUnit.HOURS), "1"]],
            ["10h", [TimeUnitUtils.getString(TimeUnit.DAYS), "1"]],
            ["10d", [TimeUnitUtils.getString(TimeUnit.DAYS), "1"]],
        ]).it("should use %s and get %s", (interval, expected) => {
           expect(TimeUnitUtils.ceilingToAvailableUnit(interval, availableUnits)).toEqual(expected);
        });
    });
});
