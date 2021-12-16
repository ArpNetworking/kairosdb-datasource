export class GroupByTimeEntry {
  interval: string = undefined;
  unit: string = undefined;
  count: number = undefined;

  constructor(interval: string, unit: string, count: number) {
    this.interval = interval;
    this.unit = unit;
    this.count = count;
  }

  asString(): string {
    return 'time(' + this.interval + ', ' + this.unit + ', ' + this.count + ')';
  }
}
