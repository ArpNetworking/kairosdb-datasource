import {expect} from "@jest/globals";
import _ from "lodash";
import {Aggregator} from "../../src/beans/aggregators/aggregator";
import {AGGREGATORS, SCALAR_AGGREGATOR_NAMES} from "../../src/beans/aggregators/aggregators";
import {AlignmentAggregatorParameter} from "../../src/beans/aggregators/parameters/alignment_aggregator_parameter";
import {RangeAggregator} from "../../src/beans/aggregators/range_aggregator";

describe("AGGREGATORS", () => {
    describe("should only have a AlignmentAggregatorParameter if they are a RangeAggregator:", () => {
        AGGREGATORS.forEach((agg: Aggregator) => {
            const isRangeAgg = agg instanceof RangeAggregator;
            it(`${agg.name} should ${!isRangeAgg ? "not" : ""} have an alignment param:`, () => {
                expect(hasAlignmentParam(agg)).toBe(isRangeAgg);
            });
        });
    });
});

function hasAlignmentParam(agg: Aggregator): boolean {
    const param = agg.parameters.find((p) => {
        return p instanceof AlignmentAggregatorParameter;
    });
    return !_.isNil(param);
}

describe("SCALAR_AGGREGATOR_NAMES", () => {
    it("should be sorted alphabetically", () => {
        expect(_.sortBy(SCALAR_AGGREGATOR_NAMES)).toEqual(SCALAR_AGGREGATOR_NAMES);
    });
    it("should not include duplicates", () => {
        expect(_.uniq(SCALAR_AGGREGATOR_NAMES).length).toBe(SCALAR_AGGREGATOR_NAMES.length);
    });
    it("should only include members of AGGREGATORS", () => {
        const aggregatorNames = AGGREGATORS.map((a) => a.name);
        const missing = _.difference(SCALAR_AGGREGATOR_NAMES, aggregatorNames);
        expect(missing).toEqual([]);
    });
});
