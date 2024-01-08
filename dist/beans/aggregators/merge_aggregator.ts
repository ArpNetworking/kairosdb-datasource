import {AnyAggregatorParameter} from "./parameters/any_aggregator_parameter";
import {RangeAggregator} from "./range_aggregator";

export class MergeAggregator extends RangeAggregator {
    public static NAME = "merge";

    public static fromObject(object: any) {
        const rval = new MergeAggregator();
        const rangeObj = RangeAggregator.fromObject(object);
        rval.autoValueSwitch = rangeObj.autoValueSwitch;
        rval.parameters = rangeObj.parameters.concat([AnyAggregatorParameter.fromObject(object.parameters[3])]);
        return rval;
    }

    constructor() {
        super(MergeAggregator.NAME);
        this.parameters = this.parameters.concat([new AnyAggregatorParameter("precision", "precision [1, 52]")]);
    }
}
