/**
 * Test to demonstrate the literal string alias issue discovered in debug logs
 */

import { DataSource } from '../src/datasource';
import { ScopedVars } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

// Mock template service that behaves like real Grafana
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: jest.fn(() => ({
    replace: jest.fn((text: string, scopedVars?: ScopedVars) => {
      if (!scopedVars || !text) return text;
      
      // Real Grafana template service behavior
      return text.replace(/\$(\w+)/g, (match, varName) => {
        const variable = scopedVars[varName];
        if (variable) {
          if (Array.isArray(variable.value)) {
            return variable.value.join(',');
          }
          return String(variable.value);
        }
        return match; // No replacement if variable not found
      });
    })
  }))
}));

describe('Literal String Alias Issue', () => {
  test('should demonstrate the problem with literal string aliases', () => {
    const templateSrv = getTemplateSrv();
    
    // This is what the user has (the problem)
    const literalAlias = '{Attic,Bedroom,Garage,Living Room,Office}';
    
    // This is what the user should have (the solution)
    const variableAlias = '$location';
    const curlyVariableAlias = '{$location}';
    
    // Individual variable values (what our expansion creates correctly)
    const individualScopedVars = [
      { location: { text: 'Attic', value: 'Attic' } },
      { location: { text: 'Bedroom', value: 'Bedroom' } },
      { location: { text: 'Garage', value: 'Garage' } },
      { location: { text: 'Living Room', value: 'Living Room' } },
      { location: { text: 'Office', value: 'Office' } }
    ];
    
    console.log('=== PROBLEM: Literal String Alias ===');
    individualScopedVars.forEach((vars, index) => {
      const result = templateSrv.replace(literalAlias, vars);
      console.log(`Metric ${index} (${vars.location.value}): "${result}"`);
    });
    
    console.log('\n=== SOLUTION: Variable Alias ===');
    individualScopedVars.forEach((vars, index) => {
      const result = templateSrv.replace(variableAlias, vars);
      console.log(`Metric ${index} (${vars.location.value}): "${result}"`);
    });
    
    console.log('\n=== SOLUTION: Curly Variable Alias ===');
    individualScopedVars.forEach((vars, index) => {
      const result = templateSrv.replace(curlyVariableAlias, vars);
      console.log(`Metric ${index} (${vars.location.value}): "${result}"`);
    });
    
    // Test the actual results
    const literalResults = individualScopedVars.map(vars => 
      templateSrv.replace(literalAlias, vars)
    );
    
    const variableResults = individualScopedVars.map(vars => 
      templateSrv.replace(variableAlias, vars)
    );
    
    const curlyResults = individualScopedVars.map(vars => 
      templateSrv.replace(curlyVariableAlias, vars)
    );
    
    // Problem: All series get the same literal name
    expect(literalResults).toEqual([
      '{Attic,Bedroom,Garage,Living Room,Office}',
      '{Attic,Bedroom,Garage,Living Room,Office}',
      '{Attic,Bedroom,Garage,Living Room,Office}',
      '{Attic,Bedroom,Garage,Living Room,Office}',
      '{Attic,Bedroom,Garage,Living Room,Office}'
    ]);
    
    // Solution: Each series gets its individual name
    expect(variableResults).toEqual([
      'Attic',
      'Bedroom', 
      'Garage',
      'Living Room',
      'Office'
    ]);
    
    // Alternative solution: With curly braces
    expect(curlyResults).toEqual([
      '{Attic}',
      '{Bedroom}',
      '{Garage}', 
      '{Living Room}',
      '{Office}'
    ]);
  });
  
  test('should show what the debug logs revealed', () => {
    // This recreates exactly what we saw in the debug logs
    const templateSrv = getTemplateSrv();
    
    // From the logs: alias is literal string
    const alias = '{Attic,Bedroom,Garage,Living Room,Office}';
    
    // From the logs: individual scoped vars are correct
    const scopedVarsAttic = {
      "__sceneObject": { text: "__sceneObject" },
      "__interval": { text: "2m", value: "2m" },
      "__interval_ms": { text: "120000", value: 120000 },
      "location": { text: "Attic", value: "Attic" }
    };
    
    const scopedVarsBedroom = {
      "__sceneObject": { text: "__sceneObject" },
      "__interval": { text: "2m", value: "2m" },
      "__interval_ms": { text: "120000", value: 120000 },
      "location": { text: "Bedroom", value: "Bedroom" }
    };
    
    // This is what we saw in the logs
    const result1 = templateSrv.replace(alias, scopedVarsAttic);
    const result2 = templateSrv.replace(alias, scopedVarsBedroom);
    
    console.log('Debug log recreation:');
    console.log('  Attic result:', result1);
    console.log('  Bedroom result:', result2);
    
    // Both return the same literal string because there are no variables to replace
    expect(result1).toBe('{Attic,Bedroom,Garage,Living Room,Office}');
    expect(result2).toBe('{Attic,Bedroom,Garage,Living Room,Office}');
    
    // The fix: use $location instead
    const fixedAlias = '$location';
    const fixedResult1 = templateSrv.replace(fixedAlias, scopedVarsAttic);
    const fixedResult2 = templateSrv.replace(fixedAlias, scopedVarsBedroom);
    
    console.log('Fixed results:');
    console.log('  Attic result:', fixedResult1);
    console.log('  Bedroom result:', fixedResult2);
    
    expect(fixedResult1).toBe('Attic');
    expect(fixedResult2).toBe('Bedroom');
  });
});