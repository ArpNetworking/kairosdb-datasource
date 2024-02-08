import {TimeUnit} from "../aggregators/utils";

export class MetricQuery {
    public name: string;
    public tags: any;
    public limit: number = 0;
    public aggregators: AggregatorPart[];
    public group_by: any[];
    public start_absolute?: number;
    public end_absolute?: number;
    public exclude_tags: boolean = true;

    constructor(name: string, tags: any, aggregators: any[], group_by: any[], start_absolute?: number, end_absolute?: number) {
        this.name = name;
        this.tags = tags;
        this.aggregators = aggregators;
        this.group_by = group_by;
        this.start_absolute = start_absolute;
        this.end_absolute = end_absolute;
    }
}

export interface AggregatorPart {
    sampling: SamplingPart;
}

export interface SamplingPart {
    unit: string;
    value: number;
}
