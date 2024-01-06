export declare class MetricQuery {
    name: string;
    tags: any;
    limit: number;
    aggregators: any[];
    group_by: any[];
    start_absolute?: number;
    end_absolute?: number;
    exclude_tags: boolean;
    constructor(name: string, tags: any, aggregators: any[], group_by: any[], start_absolute?: number, end_absolute?: number);
}
