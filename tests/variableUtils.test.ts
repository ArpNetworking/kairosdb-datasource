import { VariableQueryParser } from '../src/utils/variableUtils';

describe('VariableQueryParser', () => {
  describe('parse', () => {
    // Test standard formats
    it('should parse metrics query', () => {
      const result = VariableQueryParser.parse('metrics(cpu)');
      expect(result).toEqual({
        type: 'metrics',
        pattern: 'cpu',
      });
    });

    it('should parse tag_names query', () => {
      const result = VariableQueryParser.parse('tag_names(system.cpu.usage)');
      expect(result).toEqual({
        type: 'tag_names',
        metric: 'system.cpu.usage',
      });
    });

    it('should parse tag_values query with filters (new format)', () => {
      const result = VariableQueryParser.parse('tag_values(system.cpu.usage, host, datacenter=us-east-1, env=prod)');
      expect(result).toEqual({
        type: 'tag_values',
        metric: 'system.cpu.usage',
        tagName: 'host',
        filters: {
          datacenter: 'us-east-1',
          env: 'prod',
        },
      });
    });

    it('should parse tag_values query with filters (legacy format - tag name last)', () => {
      const result = VariableQueryParser.parse('tag_values(system.cpu.usage, datacenter=us-east-1, env=prod, host)');
      expect(result).toEqual({
        type: 'tag_values',
        metric: 'system.cpu.usage',
        tagName: 'host',
        filters: {
          datacenter: 'us-east-1',
          env: 'prod',
        },
      });
    });

    // Test backwards compatibility with legacy formats
    describe('legacy format support', () => {
      it('should handle extra spaces in function calls', () => {
        const result = VariableQueryParser.parse('metrics( cpu )');
        expect(result).toEqual({
          type: 'metrics',
          pattern: 'cpu',
        });
      });

      it('should handle spaces before parentheses', () => {
        const result = VariableQueryParser.parse('tag_names (system.cpu.usage)');
        expect(result).toEqual({
          type: 'tag_names',
          metric: 'system.cpu.usage',
        });
      });

      it('should handle quoted parameters', () => {
        const result = VariableQueryParser.parse('metrics("cpu.usage")');
        expect(result).toEqual({
          type: 'metrics',
          pattern: 'cpu.usage',
        });
      });

      it('should handle single quoted parameters', () => {
        const result = VariableQueryParser.parse("metrics('cpu.usage')");
        expect(result).toEqual({
          type: 'metrics',
          pattern: 'cpu.usage',
        });
      });

      it('should handle mixed spacing in tag_values (new format)', () => {
        const result = VariableQueryParser.parse('tag_values( system.cpu , host , region = us-east-1 )');
        expect(result).toEqual({
          type: 'tag_values',
          metric: 'system.cpu',
          tagName: 'host',
          filters: {
            region: 'us-east-1',
          },
        });
      });

      it('should handle mixed spacing in tag_values (legacy format)', () => {
        const result = VariableQueryParser.parse('tag_values( system.cpu , region = us-east-1 , host )');
        expect(result).toEqual({
          type: 'tag_values',
          metric: 'system.cpu',
          tagName: 'host',
          filters: {
            region: 'us-east-1',
          },
        });
      });

      it('should handle parameters with variable syntax (new format)', () => {
        const result = VariableQueryParser.parse('tag_values($metric, host, region=$region)');
        expect(result).toEqual({
          type: 'tag_values',
          metric: '$metric',
          tagName: 'host',
          filters: {
            region: '$region',
          },
        });
      });

      it('should handle parameters with variable syntax (legacy format)', () => {
        const result = VariableQueryParser.parse('tag_values($metric, region=$region, host)');
        expect(result).toEqual({
          type: 'tag_values',
          metric: '$metric',
          tagName: 'host',
          filters: {
            region: '$region',
          },
        });
      });

      it('should handle complex metric patterns', () => {
        const result = VariableQueryParser.parse('metrics(system.*.cpu)');
        expect(result).toEqual({
          type: 'metrics',
          pattern: 'system.*.cpu',
        });
      });
    });

    // Test edge cases
    describe('edge cases', () => {
      it('should return null for invalid syntax', () => {
        expect(VariableQueryParser.parse('invalid query')).toBeNull();
      });

      it('should return null for empty string', () => {
        expect(VariableQueryParser.parse('')).toBeNull();
      });

      it('should return null for incomplete function', () => {
        expect(VariableQueryParser.parse('metrics(')).toBeNull();
      });

      it('should handle tag_values with no filters', () => {
        const result = VariableQueryParser.parse('tag_values(system.cpu, host)');
        expect(result).toEqual({
          type: 'tag_values',
          metric: 'system.cpu',
          tagName: 'host',
          filters: {},
        });
      });

      it('should handle metrics with empty pattern', () => {
        const result = VariableQueryParser.parse('metrics()');
        expect(result).toEqual({
          type: 'metrics',
          pattern: '',
        });
      });
    });

    // Test parameter parsing
    describe('parameter parsing', () => {
      it('should handle parameters with commas in values', () => {
        const result = VariableQueryParser.parse('tag_values(metric, tag, filter="value1,value2")');
        expect(result).toEqual({
          type: 'tag_values',
          metric: 'metric',
          tagName: 'tag',
          filters: {
            filter: 'value1,value2',
          },
        });
      });

      it('should handle parameters with equals in values', () => {
        const result = VariableQueryParser.parse('tag_values(metric, tag, filter="key=value")');
        expect(result).toEqual({
          type: 'tag_values',
          metric: 'metric',
          tagName: 'tag',
          filters: {
            filter: 'key=value',
          },
        });
      });
    });

    // Test round-trip compatibility
    describe('round-trip parsing', () => {
      it('should handle legacy -> new format round trip', () => {
        // This simulates what happens when:
        // 1. User has legacy format: tag_values(metric, filter=value, tag_name)
        // 2. Editor parses it and generates new format: tag_values(metric, tag_name, filter=value) 
        // 3. Editor needs to parse the new format again
        
        const legacyQuery = 'tag_values(system.cpu, datacenter=us-east-1, host)';
        const result1 = VariableQueryParser.parse(legacyQuery);
        
        expect(result1).toEqual({
          type: 'tag_values',
          metric: 'system.cpu',
          tagName: 'host',
          filters: {
            datacenter: 'us-east-1',
          },
        });

        // Now simulate what the editor generates (new format)
        const newQuery = 'tag_values(system.cpu, host, datacenter=us-east-1)';
        const result2 = VariableQueryParser.parse(newQuery);
        
        expect(result2).toEqual({
          type: 'tag_values',
          metric: 'system.cpu',
          tagName: 'host',
          filters: {
            datacenter: 'us-east-1',
          },
        });

        // Both should produce the same result
        expect(result1).toEqual(result2);
      });

      it('should handle new format with multiple filters', () => {
        const newQuery = 'tag_values(system.cpu, host, datacenter=us-east-1, env=prod, region=west)';
        const result = VariableQueryParser.parse(newQuery);
        
        expect(result).toEqual({
          type: 'tag_values',
          metric: 'system.cpu',
          tagName: 'host',
          filters: {
            datacenter: 'us-east-1',
            env: 'prod',
            region: 'west',
          },
        });
      });
    });
  });
});
