export class TemplatingFunction {
  name: string;
  body: any;
  regexp: string;

  constructor(name: string, body: any) {
    this.name = name;
    this.body = body;
    this.regexp = this.getRegexp();
  }

  run(args: string[]) {
    return this.body(...args);
  }

  private getRegexp(): string {
    return '^' + this.name + '\\(([\\S ]+)\\)' + '$';
  }
}
