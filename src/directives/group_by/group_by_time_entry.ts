export class GroupByTimeEntry {
  // @ts-ignore
  interval: string = undefined;
  // @ts-ignore
  unit: string = undefined;
  // @ts-ignore
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
