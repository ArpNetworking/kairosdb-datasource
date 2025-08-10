export enum TimeUnit {
  MILLISECONDS = 'MILLISECONDS',
  SECONDS = 'SECONDS', 
  MINUTES = 'MINUTES',
  HOURS = 'HOURS',
  DAYS = 'DAYS',
  WEEKS = 'WEEKS',
  MONTHS = 'MONTHS',
  YEARS = 'YEARS'
}

export class TimeUnitUtils {
  private static SHORT_UNITS: { [key: string]: string } = {
    'ms': 'MILLISECONDS',
    's': 'SECONDS',
    'm': 'MINUTES', 
    'h': 'HOURS',
    'd': 'DAYS',
    'w': 'WEEKS',
    'M': 'MONTHS',
    'y': 'YEARS'
  };

  private static LONG_UNITS: { [key: string]: string } = {
    'millisecond': 'MILLISECONDS',
    'second': 'SECONDS',
    'minute': 'MINUTES',
    'hour': 'HOURS', 
    'day': 'DAYS',
    'week': 'WEEKS',
    'month': 'MONTHS',
    'year': 'YEARS'
  };

  static extractValue(interval: string): string {
    return parseFloat(interval).toString();
  }

  static extractFloatValue(interval: string): number {
    return parseFloat(interval);
  }

  static extractUnit(interval: string): string {
    const timeValue: string = this.extractValue(interval);
    return interval.replace(timeValue, '').trim();
  }

  static convertTimeUnit(unit: string): string {
    return this.SHORT_UNITS[unit] || this.LONG_UNITS[unit] || unit;
  }

  static intervalToUnitValue(interval: string): [TimeUnit, number] {
    const unitStr = this.extractUnit(interval);
    const value = this.extractFloatValue(interval);
    const unit = this.getTimeUnit(unitStr);
    
    
    return [unit, value];
  }

  static getTimeUnit(unit: string): TimeUnit {
    const converted = this.convertTimeUnit(unit);
    return TimeUnit[converted as keyof typeof TimeUnit] || TimeUnit.SECONDS;
  }
}
