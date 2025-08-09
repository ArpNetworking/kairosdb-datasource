import { AggregatorParameter, Aggregator } from '../types';
import { TimeUnitUtils } from './timeUtils';

export class ParameterObjectBuilder {
  private autoIntervalValue: string;
  private autoIntervalUnit: string;
  private autoValueEnabled: boolean;
  private autoValueDependentParameters: string[] = [];

  constructor(defaultInterval: string, aggregator: Aggregator) {
    // Convert Grafana interval (e.g., "1m", "5s") to KairosDB format
    console.log('[ParameterObjectBuilder] Processing interval:', defaultInterval);
    const [unit, value] = TimeUnitUtils.intervalToUnitValue(defaultInterval);
    console.log('[ParameterObjectBuilder] Parsed interval - unit:', unit, 'value:', value);
    this.autoIntervalValue = value.toString();
    this.autoIntervalUnit = unit;
    
    // Set up auto value logic based on aggregator's autoValueSwitch
    this.autoValueEnabled = aggregator.autoValueSwitch?.enabled || false;
    this.autoValueDependentParameters = aggregator.autoValueSwitch?.dependentParameters || [];
    
    console.log('[ParameterObjectBuilder] Final values - autoIntervalValue:', this.autoIntervalValue, 'autoIntervalUnit:', this.autoIntervalUnit, 'autoValueEnabled:', this.autoValueEnabled, 'dependentParameters:', this.autoValueDependentParameters);
  }

  public build(parameter: AggregatorParameter): any {
    switch (parameter.type) {
      case 'sampling':
        return this.buildSamplingParameter(parameter, this.autoIntervalValue);
      case 'sampling_unit':
        return this.buildSamplingParameter(parameter, this.autoIntervalUnit);
      default:
        return this.buildDefault(parameter);
    }
  }

  private buildSamplingParameter(parameter: AggregatorParameter, autoValue: string): any {
    const parameterObject = { sampling: {} as any };
    
    // Use auto value if auto is enabled and this parameter type is dependent
    const finalValue = this.isOverriddenByAutoValue(parameter) ? autoValue : parameter.value;
      
    console.log('[ParameterObjectBuilder] buildSamplingParameter - param:', parameter.name, 'originalValue:', parameter.value, 'autoValue:', autoValue, 'finalValue:', finalValue);
    
    // For sampling values that should be numeric, ensure they are numbers
    let processedValue = finalValue;
    if (parameter.name === 'value') {
      processedValue = typeof finalValue === 'string' ? parseFloat(finalValue) : finalValue;
      console.log('[ParameterObjectBuilder] Converting value to number:', finalValue, '->', processedValue);
    }
    
    parameterObject.sampling[parameter.name] = processedValue;
    console.log('[ParameterObjectBuilder] Built sampling parameter object:', parameterObject);
    return parameterObject;
  }

  private buildDefault(parameter: AggregatorParameter): any {
    const parameterObject = {} as any;
    if (parameter.value !== undefined && parameter.value !== null && parameter.value !== '') {
      parameterObject[parameter.name] = parameter.value;
    }
    return parameterObject;
  }

  private isOverriddenByAutoValue(parameter: AggregatorParameter): boolean {
    const result = this.autoValueEnabled && this.autoValueDependentParameters.includes(parameter.type);
    console.log('[ParameterObjectBuilder] isOverriddenByAutoValue - param:', parameter.name, 'autoValueEnabled:', this.autoValueEnabled, 'type:', parameter.type, 'isDependentType:', this.autoValueDependentParameters.includes(parameter.type), 'result:', result);
    return result;
  }
}