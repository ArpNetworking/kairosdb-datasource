import { Aggregator, AggregatorParameter, AutoValueSwitch } from '../types';

/**
 * Migration utilities for handling old dashboard formats
 */
export class MigrationUtils {
  
  /**
   * Migrates aggregators from old Angular plugin format to new React format
   */
  static migrateAggregators(aggregators: any[]): Aggregator[] {
    if (!Array.isArray(aggregators)) {
      return [];
    }

    return aggregators.map((aggregator) => {
      if (!aggregator || typeof aggregator !== 'object') {
        return null;
      }

      const migratedAggregator: Aggregator = {
        name: aggregator.name || '',
        parameters: MigrationUtils.migrateParameters(aggregator.parameters || []),
        autoValueSwitch: MigrationUtils.migrateAutoValueSwitch(aggregator.autoValueSwitch)
      };

      return migratedAggregator;
    }).filter((agg): agg is Aggregator => agg !== null);
  }

  /**
   * Migrates parameter array from old format
   */
  private static migrateParameters(parameters: any[]): AggregatorParameter[] {
    if (!Array.isArray(parameters)) {
      return [];
    }

    return parameters.map((param) => {
      if (!param || typeof param !== 'object' || !param.name) {
        return null;
      }

      const migratedParam: AggregatorParameter = {
        name: param.name,
        type: param.type || '',
        value: MigrationUtils.migrateParameterValue(param),
        text: param.text || param.name
      };

      return migratedParam;
    }).filter((param): param is AggregatorParameter => param !== null);
  }

  /**
   * Migrates parameter values from old allowedValues format to new format
   */
  private static migrateParameterValue(param: any): any {
    if (!param) {
      return '';
    }

    // If value exists and is not using old format, return as is
    if (param.value !== undefined && !param.allowedValues) {
      return param.value;
    }

    // Handle old format where value is a key into allowedValues
    if (param.allowedValues && param.value !== undefined) {
      const mappedValue = param.allowedValues[param.value];
      if (mappedValue !== undefined) {
        // Convert time units to lowercase for consistency
        if (param.type === 'sampling_unit' && typeof mappedValue === 'string') {
          return mappedValue.toLowerCase();
        }
        return mappedValue;
      }
    }

    return param.value || '';
  }

  /**
   * Migrates AutoValueSwitch from old format to new format
   */
  private static migrateAutoValueSwitch(autoValueSwitch: any): AutoValueSwitch | undefined {
    if (!autoValueSwitch || typeof autoValueSwitch !== 'object') {
      return undefined;
    }

    // New format: dependentParameters is array of strings (parameter types)
    let dependentParameters: string[] = [];

    if (Array.isArray(autoValueSwitch.dependentParameters)) {
      // Check if it's old format (array of objects) or new format (array of strings)
      if (autoValueSwitch.dependentParameters.length > 0) {
        const firstParam = autoValueSwitch.dependentParameters[0];
        
        if (typeof firstParam === 'string') {
          // Already in new format
          dependentParameters = autoValueSwitch.dependentParameters;
        } else if (firstParam && typeof firstParam === 'object' && firstParam.type) {
          // Old format - extract parameter types from parameter objects
          dependentParameters = autoValueSwitch.dependentParameters
            .filter((param: any) => param && param.type)
            .map((param: any) => param.type);
        }
      }
    }

    return {
      enabled: Boolean(autoValueSwitch.enabled),
      dependentParameters
    };
  }

  /**
   * Check if aggregators data needs migration (contains old format patterns)
   */
  static needsMigration(aggregators: any[]): boolean {
    if (!Array.isArray(aggregators) || aggregators.length === 0) {
      return false;
    }

    // Check for old format patterns
    for (const aggregator of aggregators) {
      if (!aggregator || typeof aggregator !== 'object') {
        continue;
      }

      // Check if autoValueSwitch has old format dependentParameters (array of objects)
      if (aggregator.autoValueSwitch?.dependentParameters) {
        const deps = aggregator.autoValueSwitch.dependentParameters;
        if (Array.isArray(deps) && deps.length > 0) {
          const firstDep = deps[0];
          if (typeof firstDep === 'object' && firstDep.type) {
            return true; // Found old format
          }
        }
      }

      // Check if parameters have old allowedValues format
      if (Array.isArray(aggregator.parameters)) {
        for (const param of aggregator.parameters) {
          if (param && param.allowedValues && typeof param.allowedValues === 'object') {
            return true; // Found old format
          }
        }
      }
    }

    return false;
  }
}
