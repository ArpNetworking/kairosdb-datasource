import {expect} from "@jest/globals";
import {Aggregator} from "../../src/beans/aggregators/aggregator";
import {RangeAggregator} from "../../src/beans/aggregators/range_aggregator";
import {AggregatorsCtrl} from "../../src/directives/aggregators";

describe.skip("AggregatorsController", () => {
    const aggregatorCtrl: AggregatorsCtrl = new AggregatorsCtrl();
    aggregatorCtrl.entries = [];

    it("should add aggregator", () => {
        // given
        const aggregator: Aggregator = new Aggregator("aggregator name");
        // when
        aggregatorCtrl.add(aggregator);
        // then
        expect(aggregatorCtrl.entries).toEqual(expect.arrayContaining([aggregator]));
    });

    it("should remove aggregator", () => {
        // given
        const aggregator: Aggregator = new Aggregator("aggregator name");
        aggregatorCtrl.add(aggregator);
        // when
        aggregatorCtrl.remove(aggregator);
        // then
        expect(aggregatorCtrl.entries).toEqual(expect.not.arrayContaining([aggregator]));
    });

    it("should allow to add more aggregators of the same type", () => {
        // given
        const aggregator1: Aggregator = new RangeAggregator("agg1");
        const aggregator2: Aggregator = new RangeAggregator("agg2");
        // when
        aggregatorCtrl.add(aggregator1);
        aggregatorCtrl.add(aggregator2);
        // then
        expect(aggregatorCtrl.entries).toEqual(expect.arrayContaining([aggregator1]));
        expect(aggregatorCtrl.entries).toEqual(expect.arrayContaining([aggregator2]));
    });
});
