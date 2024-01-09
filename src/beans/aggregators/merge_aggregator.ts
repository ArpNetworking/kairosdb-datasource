import {AnyAggregatorParameter} from "./parameters/any_aggregator_parameter";
import {RangeAggregator} from "./range_aggregator";

export class MergeAggregator extends RangeAggregator {
    public static NAME = "merge";

    public static fromObject(object: any) {
        const rval = new MergeAggregator();
        const rangeObj = RangeAggregator.fromObject(object);
        rval.autoValueSwitch = rangeObj.autoValueSwitch;
        if (object.parameters.length === 4) {
            const precision = object.parameters[3];
            rval.parameters = rangeObj.parameters.concat([AnyAggregatorParameter.fromObject(precision)]);
        } else {
            rval.parameters = rangeObj.parameters;
        }
        return rval;
    }

    constructor() {
        super(MergeAggregator.NAME);
        this.parameters = this.parameters.concat([new AnyAggregatorParameter("precision", "precision [1, 52]", null)]);
    }
}
