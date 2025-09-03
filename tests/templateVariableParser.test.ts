import { parseTemplateVariableInput, ParsedInput } from '../src/utils/templateVariableParser';

describe('templateVariableParser', () => {
  describe('parseTemplateVariableInput', () => {
    describe('inputs without variables', () => {
      it('should parse simple metric name', () => {
        const result = parseTemplateVariableInput('system.cpu.usage');
        
        expect(result).toEqual({
          hasVariables: false,
          literalParts: ['system.cpu.usage'],
          variables: [],
          pattern: 'system.cpu.usage'
        });
      });

      it('should handle empty input', () => {
        const result = parseTemplateVariableInput('');
        
        expect(result).toEqual({
          hasVariables: false,
          literalParts: [],
          variables: [],
          pattern: ''
        });
      });

      it('should handle single character input', () => {
        const result = parseTemplateVariableInput('s');
        
        expect(result).toEqual({
          hasVariables: false,
          literalParts: ['s'],
          variables: [],
          pattern: 's'
        });
      });
    });

    describe('inputs with $variable syntax', () => {
      it('should parse variable at start', () => {
        const result = parseTemplateVariableInput('$env.system.cpu');
        
        expect(result).toEqual({
          hasVariables: true,
          literalParts: ['system.cpu'],
          variables: ['$env'],
          pattern: '*.system.cpu'
        });
      });

      it('should parse variable in middle', () => {
        const result = parseTemplateVariableInput('system.$datacenter.cpu');
        
        expect(result).toEqual({
          hasVariables: true,
          literalParts: ['system', 'cpu'],
          variables: ['$datacenter'],
          pattern: 'system.*.cpu'
        });
      });

      it('should parse variable at end', () => {
        const result = parseTemplateVariableInput('system.cpu.$metric');
        
        expect(result).toEqual({
          hasVariables: true,
          literalParts: ['system.cpu'],
          variables: ['$metric'],
          pattern: 'system.cpu.*'
        });
      });

      it('should parse multiple variables', () => {
        const result = parseTemplateVariableInput('$env.system.$datacenter.cpu.$type');
        
        expect(result).toEqual({
          hasVariables: true,
          literalParts: ['system', 'cpu'],
          variables: ['$env', '$datacenter', '$type'],
          pattern: '*.system.*.cpu.*'
        });
      });

      it('should parse only variables', () => {
        const result = parseTemplateVariableInput('$prefix.$suffix');
        
        expect(result).toEqual({
          hasVariables: true,
          literalParts: [],
          variables: ['$prefix', '$suffix'],
          pattern: '*.*'
        });
      });

      it('should parse single variable only', () => {
        const result = parseTemplateVariableInput('$metric_name');
        
        expect(result).toEqual({
          hasVariables: true,
          literalParts: [],
          variables: ['$metric_name'],
          pattern: '*'
        });
      });
    });

    describe('inputs with ${variable} syntax', () => {
      it('should parse braced variable at start', () => {
        const result = parseTemplateVariableInput('${env}.system.cpu');
        
        expect(result).toEqual({
          hasVariables: true,
          literalParts: ['system.cpu'],
          variables: ['${env}'],
          pattern: '*.system.cpu'
        });
      });

      it('should parse braced variable in middle', () => {
        const result = parseTemplateVariableInput('system.${datacenter}.cpu');
        
        expect(result).toEqual({
          hasVariables: true,
          literalParts: ['system', 'cpu'],
          variables: ['${datacenter}'],
          pattern: 'system.*.cpu'
        });
      });

      it('should parse mixed variable syntaxes', () => {
        const result = parseTemplateVariableInput('$env.system.${datacenter}.cpu');
        
        expect(result).toEqual({
          hasVariables: true,
          literalParts: ['system', 'cpu'],
          variables: ['$env', '${datacenter}'],
          pattern: '*.system.*.cpu'
        });
      });
    });

    describe('edge cases', () => {
      it('should handle variable with underscores', () => {
        const result = parseTemplateVariableInput('system.$my_env.cpu');
        
        expect(result).toEqual({
          hasVariables: true,
          literalParts: ['system', 'cpu'],
          variables: ['$my_env'],
          pattern: 'system.*.cpu'
        });
      });

      it('should handle variable with numbers', () => {
        const result = parseTemplateVariableInput('system.$env2.cpu');
        
        expect(result).toEqual({
          hasVariables: true,
          literalParts: ['system', 'cpu'],
          variables: ['$env2'],
          pattern: 'system.*.cpu'
        });
      });

      it('should handle consecutive dots', () => {
        const result = parseTemplateVariableInput('system..cpu');
        
        expect(result).toEqual({
          hasVariables: false,
          literalParts: ['system..cpu'],
          variables: [],
          pattern: 'system..cpu'
        });
      });

      it('should handle dots at start/end', () => {
        const result = parseTemplateVariableInput('.system.cpu.');
        
        expect(result).toEqual({
          hasVariables: false,
          literalParts: ['.system.cpu.'],
          variables: [],
          pattern: '.system.cpu.'
        });
      });

      it('should handle malformed braced variables (missing closing brace)', () => {
        const result = parseTemplateVariableInput('system.${env.cpu');
        
        expect(result).toEqual({
          hasVariables: false,
          literalParts: ['system.${env.cpu'],
          variables: [],
          pattern: 'system.${env.cpu'
        });
      });

      it('should handle $ without variable name', () => {
        const result = parseTemplateVariableInput('system.$.cpu');
        
        expect(result).toEqual({
          hasVariables: false,
          literalParts: ['system.$.cpu'],
          variables: [],
          pattern: 'system.$.cpu'
        });
      });

      it('should handle complex real-world example', () => {
        const result = parseTemplateVariableInput('kubernetes.$cluster_name.pods.${namespace}.cpu.usage_rate');
        
        expect(result).toEqual({
          hasVariables: true,
          literalParts: ['kubernetes', 'pods', 'cpu.usage_rate'],
          variables: ['$cluster_name', '${namespace}'],
          pattern: 'kubernetes.*.pods.*.cpu.usage_rate'
        });
      });
    });

    describe('prefix search handling', () => {
      it('should preserve ^ prefix in literal parts', () => {
        const result = parseTemplateVariableInput('^system.cpu');
        
        expect(result).toEqual({
          hasVariables: false,
          literalParts: ['^system.cpu'],
          variables: [],
          pattern: '^system.cpu'
        });
      });

      it('should handle ^ prefix with variables', () => {
        const result = parseTemplateVariableInput('^$env.system.cpu');
        
        expect(result).toEqual({
          hasVariables: true,
          literalParts: ['^', 'system.cpu'],
          variables: ['$env'],
          pattern: '^*.system.cpu'
        });
      });
    });
  });
});