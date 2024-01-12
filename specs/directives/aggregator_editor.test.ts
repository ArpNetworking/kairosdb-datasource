import {Aggregator} from "../../src/beans/aggregators/aggregator";
import {AggregatorEditorDirective} from "../../src/directives/aggregator_editor";

describe("AggregatorEditorController", () => {
    it("should add picks (clones) aggregator correctly", () => {
        // given
        const aggregatorName: string = "diff";
        const aggregator: Aggregator = new Aggregator(aggregatorName);
        const scope: any = {
            ctrl: {
                availableAggregators: [aggregator]
            }
        };
        const link = AggregatorEditorDirective().link;
        link(scope);
        // when
        scope.pickAggregator(aggregatorName);
        // then
        expect(scope.newAggregator).not.toBe(aggregator);
        expect(scope.newAggregator).toEqual(aggregator);
    });
});
