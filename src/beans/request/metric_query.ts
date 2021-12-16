export class MetricQuery {
  name: string;
  tags: any;
  limit = 0;
  aggregators: any[];
  group_by: any[];
  start_absolute?: number;
  end_absolute?: number;

  constructor(
    name: string,
    tags: any,
    aggregators: any[],
    group_by: any[],
    start_absolute?: number,
    end_absolute?: number
  ) {
    this.name = name;
    this.tags = tags;
    this.aggregators = aggregators;
    this.group_by = group_by;
    this.start_absolute = start_absolute;
    this.end_absolute = end_absolute;
  }
}
