import {AnyAggregatorParameter} from "./parameters/any_aggregator_parameter";
import {RangeAggregator} from "./range_aggregator";

export class MergeAggregator extends RangeAggregator {
    public static NAME = "merge";

    public static fromObject(object: any) {
        const rval = new MergeAggregator();
        const rangeObj = RangeAggregator.fromObject(object);
        rval.autoValueSwitch = rangeObj.autoValueSwitch;
        let precision = {
            name: "precision",
            text: "precision [1, 52]",
            value: 52
        };
        if (object.parameters.len === 4) {
            precision = object.parameters[3];
        }
        rval.parameters = rangeObj.parameters.concat([AnyAggregatorParameter.fromObject(precision)]);
        return rval;
    }

    constructor() {
        super(MergeAggregator.NAME);
        this.parameters = this.parameters.concat([new AnyAggregatorParameter("precision", "precision [1, 52]")]);
    }
}
