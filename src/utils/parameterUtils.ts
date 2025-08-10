import { AggregatorParameter, Aggregator } from '../types';
import { TimeUnitUtils } from './timeUtils';

export class ParameterObjectBuilder {
  public autoIntervalValue: string;
  public autoIntervalUnit: string;
  public autoValueEnabled: boolean;
  private autoValueDependentParameters: string[] = [];

  constructor(defaultInterval: string, aggregator: Aggregator) {
    // Convert Grafana interval (e.g., "1m", "5s") to KairosDB format
    const [unit, value] = TimeUnitUtils.intervalToUnitValue(defaultInterval);
    this.autoIntervalValue = value.toString();
    this.autoIntervalUnit = unit;
    
    // Set up auto value logic based on aggregator's autoValueSwitch
    this.autoValueEnabled = aggregator.autoValueSwitch?.enabled || false;
    this.autoValueDependentParameters = aggregator.autoValueSwitch?.dependentParameters || [];
    
  }

  public build(parameter: AggregatorParameter): any {
    switch (parameter.type) {
      case 'sampling':
        return this.buildSamplingParameter(parameter, this.autoIntervalValue);
      case 'sampling_unit':
        return this.buildSamplingParameter(parameter, this.autoIntervalUnit);
      case 'alignment':
        return this.buildAlignmentParameter(parameter);
      default:
        return this.buildDefault(parameter);
    }
  }

  private buildSamplingParameter(parameter: AggregatorParameter, autoValue: string): any {
    const parameterObject = { sampling: {} as any };
    
    // Use auto value if auto is enabled and this parameter type is dependent
    const finalValue = this.isOverriddenByAutoValue(parameter) ? autoValue : parameter.value;
      
    
    // For sampling values that should be numeric, ensure they are numbers
    let processedValue = finalValue;
    if (parameter.name === 'value') {
      processedValue = typeof finalValue === 'string' ? parseFloat(finalValue) : finalValue;
    }
    
    parameterObject.sampling[parameter.name] = processedValue;
    return parameterObject;
  }

  private buildAlignmentParameter(parameter: AggregatorParameter): any {
    const parameterObject = {} as any;
    if (parameter.value !== undefined && parameter.value !== null && parameter.value !== '') {
      // Handle alignment parameters differently based on their value
      if (parameter.name === 'sampling' && parameter.value === 'SAMPLING') {
        // When sampling alignment is "SAMPLING", create a sampling object for value/unit parameters
        parameterObject.sampling = {};
      } else {
        // For other alignment values (PERIOD, START_TIME, NONE), set directly
        parameterObject[parameter.name] = parameter.value;
      }
    }
    return parameterObject;
  }

  private buildDefault(parameter: AggregatorParameter): any {
    const parameterObject = {} as any;
    if (parameter.value !== undefined && parameter.value !== null && parameter.value !== '') {
      parameterObject[parameter.name] = parameter.value;
    }
    return parameterObject;
  }

  public isOverriddenByAutoValue(parameter: AggregatorParameter): boolean {
    const result = this.autoValueEnabled && this.autoValueDependentParameters.includes(parameter.type);
    return result;
  }
}
