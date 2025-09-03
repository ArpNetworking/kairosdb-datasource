import { generateSearchStrategies, resolveTemplateVariables, SearchStrategy } from '../src/utils/templateVariableResolver';
import { parseTemplateVariableInput } from '../src/utils/templateVariableParser';

// Mock templateSrv for testing
const mockTemplateSrv = {
  replace: jest.fn(),
  getVariables: jest.fn(),
};

// Mock Grafana's runtime module
jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => mockTemplateSrv,
}));

describe('templateVariableResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveTemplateVariables', () => {
    describe('inputs without variables', () => {
      it('should return original input when no variables present', () => {
        const result = resolveTemplateVariables('system.cpu.usage');
        
        expect(result).toBe('system.cpu.usage');
        expect(mockTemplateSrv.replace).not.toHaveBeenCalled();
      });

      it('should handle empty input', () => {
        const result = resolveTemplateVariables('');
        
        expect(result).toBe('');
        expect(mockTemplateSrv.replace).not.toHaveBeenCalled();
      });
    });

    describe('successful variable resolution', () => {
      it('should resolve single variable', () => {
        mockTemplateSrv.replace.mockReturnValue('system.prod.cpu');
        
        const result = resolveTemplateVariables('system.$env.cpu');
        
        expect(result).toBe('system.prod.cpu');
        expect(mockTemplateSrv.replace).toHaveBeenCalledWith('system.$env.cpu');
      });

      it('should resolve multiple variables', () => {
        mockTemplateSrv.replace.mockReturnValue('prod.system.west.cpu.usage');
        
        const result = resolveTemplateVariables('$env.system.$datacenter.cpu.usage');
        
        expect(result).toBe('prod.system.west.cpu.usage');
        expect(mockTemplateSrv.replace).toHaveBeenCalledWith('$env.system.$datacenter.cpu.usage');
      });

      it('should resolve braced variables', () => {
        mockTemplateSrv.replace.mockReturnValue('system.production.cpu');
        
        const result = resolveTemplateVariables('system.${environment}.cpu');
        
        expect(result).toBe('system.production.cpu');
        expect(mockTemplateSrv.replace).toHaveBeenCalledWith('system.${environment}.cpu');
      });
    });

    describe('failed variable resolution', () => {
      it('should return null when templateSrv.replace returns unchanged input', () => {
        mockTemplateSrv.replace.mockReturnValue('system.$unknown.cpu');
        
        const result = resolveTemplateVariables('system.$unknown.cpu');
        
        expect(result).toBeNull();
      });

      it('should return null when templateSrv.replace throws error', () => {
        mockTemplateSrv.replace.mockImplementation(() => {
          throw new Error('Variable not found');
        });
        
        const result = resolveTemplateVariables('system.$error.cpu');
        
        expect(result).toBeNull();
      });

      it('should return null when templateSrv is undefined', () => {
        jest.doMock('@grafana/runtime', () => ({
          getTemplateSrv: () => undefined,
        }));
        
        const result = resolveTemplateVariables('system.$env.cpu');
        
        expect(result).toBeNull();
      });
    });
  });

  describe('generateSearchStrategies', () => {
    describe('inputs without variables', () => {
      it('should return single strategy with original input', () => {
        const result = generateSearchStrategies('system.cpu.usage');
        
        expect(result).toEqual([
          {
            type: 'literal',
            searchTerm: 'system.cpu.usage',
            description: 'Exact match'
          }
        ]);
      });
    });

    describe('successful variable resolution', () => {
      it('should prioritize resolved variable strategy', () => {
        mockTemplateSrv.replace.mockReturnValue('system.prod.cpu');
        
        const result = generateSearchStrategies('system.$env.cpu');
        
        expect(result.length).toBe(3);
        expect(result[0]).toEqual({
          type: 'resolved',
          searchTerm: 'system.prod.cpu',
          description: 'Resolved variable'
        });
        expect(result[1]).toEqual({
          type: 'pattern',
          searchTerm: 'system.*.cpu',
          description: 'Pattern matching with wildcards'
        });
        expect(result[2]).toEqual({
          type: 'literal',
          searchTerm: 'system.$env.cpu',
          description: 'Template variable (use as-is)'
        });
      });

      it('should handle multiple variables in resolution description', () => {
        mockTemplateSrv.replace.mockReturnValue('prod.system.west.cpu');
        
        const result = generateSearchStrategies('$env.system.$datacenter.cpu');
        
        expect(result[0]).toEqual({
          type: 'resolved',
          searchTerm: 'prod.system.west.cpu',
          description: 'Resolved variable'
        });
        expect(result[1]).toEqual({
          type: 'pattern',
          searchTerm: '*.system.*.cpu',
          description: 'Pattern matching with wildcards'
        });
        expect(result[2]).toEqual({
          type: 'literal',
          searchTerm: '$env.system.$datacenter.cpu',
          description: 'Template variable (use as-is)'
        });
      });
    });

    describe('failed variable resolution', () => {
      beforeEach(() => {
        mockTemplateSrv.replace.mockReturnValue('system.$unknown.cpu'); // Unchanged = failed
      });

      it('should generate fallback strategies when resolution fails', () => {
        const result = generateSearchStrategies('system.$unknown.cpu');
        
        expect(result).toEqual([
          {
            type: 'pattern',
            searchTerm: 'system.*.cpu',
            description: 'Pattern matching with wildcards'
          },
          {
            type: 'literal',
            searchTerm: 'system.$unknown.cpu',
            description: 'Template variable (use as-is)'
          }
        ]);
      });

      it('should handle variable at start with fallback strategies', () => {
        mockTemplateSrv.replace.mockReturnValue('$prefix.system.cpu'); // Unchanged = failed
        
        const result = generateSearchStrategies('$prefix.system.cpu');
        
        expect(result).toEqual([
          {
            type: 'pattern',
            searchTerm: '*.system.cpu',
            description: 'Pattern matching with wildcards'
          },
          {
            type: 'literal',
            searchTerm: '$prefix.system.cpu',
            description: 'Template variable (use as-is)'
          }
        ]);
      });

      it('should handle variable at end with fallback strategies', () => {
        mockTemplateSrv.replace.mockReturnValue('system.cpu.$suffix'); // Unchanged = failed
        
        const result = generateSearchStrategies('system.cpu.$suffix');
        
        expect(result).toEqual([
          {
            type: 'pattern',
            searchTerm: 'system.cpu.*',
            description: 'Pattern matching with wildcards'
          },
          {
            type: 'literal',
            searchTerm: 'system.cpu.$suffix',
            description: 'Template variable (use as-is)'
          }
        ]);
      });

      it('should handle only variables with pattern strategy', () => {
        mockTemplateSrv.replace.mockReturnValue('$prefix.$suffix'); // Unchanged = failed
        
        const result = generateSearchStrategies('$prefix.$suffix');
        
        expect(result).toEqual([
          {
            type: 'pattern',
            searchTerm: '*.*',
            description: 'Pattern matching with wildcards'
          },
          {
            type: 'literal',
            searchTerm: '$prefix.$suffix',
            description: 'Template variable (use as-is)'
          }
        ]);
      });
    });

    describe('edge cases', () => {
      it('should handle prefix search with variables', () => {
        mockTemplateSrv.replace.mockReturnValue('^system.prod.cpu');
        
        const result = generateSearchStrategies('^system.$env.cpu');
        
        expect(result[0]).toEqual({
          type: 'resolved',
          searchTerm: '^system.prod.cpu',
          description: 'Resolved variable'
        });
        expect(result[1]).toEqual({
          type: 'pattern',
          searchTerm: '^system.*.cpu',
          description: 'Pattern matching with wildcards'
        });
        expect(result[2]).toEqual({
          type: 'literal',
          searchTerm: '^system.$env.cpu',
          description: 'Template variable (use as-is)'
        });
      });

      it('should preserve prefix in pattern strategy', () => {
        mockTemplateSrv.replace.mockReturnValue('^system.$unknown.cpu'); // Failed resolution
        
        const result = generateSearchStrategies('^system.$unknown.cpu');
        
        expect(result).toEqual([
          {
            type: 'pattern',
            searchTerm: '^system.*.cpu',
            description: 'Pattern matching with wildcards'
          },
          {
            type: 'literal',
            searchTerm: '^system.$unknown.cpu',
            description: 'Template variable (use as-is)'
          }
        ]);
      });

      it('should handle complex real-world example', () => {
        mockTemplateSrv.replace.mockReturnValue('kubernetes.us-west.pods.monitoring.cpu.usage_rate');
        
        const result = generateSearchStrategies('kubernetes.$cluster.pods.$namespace.cpu.usage_rate');
        
        expect(result[0]).toEqual({
          type: 'resolved',
          searchTerm: 'kubernetes.us-west.pods.monitoring.cpu.usage_rate',
          description: 'Resolved variable'
        });
        expect(result[1]).toEqual({
          type: 'pattern',
          searchTerm: 'kubernetes.*.pods.*.cpu.usage_rate',
          description: 'Pattern matching with wildcards'
        });
        expect(result[2]).toEqual({
          type: 'literal',
          searchTerm: 'kubernetes.$cluster.pods.$namespace.cpu.usage_rate',
          description: 'Template variable (use as-is)'
        });
      });

      it('should handle empty literal parts gracefully', () => {
        mockTemplateSrv.replace.mockReturnValue('$start.$end'); // Failed resolution
        
        const result = generateSearchStrategies('$start.$end');
        
        expect(result).toEqual([
          {
            type: 'pattern',
            searchTerm: '*.*',
            description: 'Pattern matching with wildcards'
          },
          {
            type: 'literal',
            searchTerm: '$start.$end',
            description: 'Template variable (use as-is)'
          }
        ]);
      });
    });

    describe('strategy optimization', () => {
      it('should not duplicate identical search terms', () => {
        mockTemplateSrv.replace.mockReturnValue('system.cpu'); // Resolved value
        
        const result = generateSearchStrategies('system.$suffix');
        
        // Should have resolved, pattern, and original template
        expect(result).toEqual([
          {
            type: 'resolved',
            searchTerm: 'system.cpu',
            description: 'Resolved variable'
          },
          {
            type: 'pattern',
            searchTerm: 'system.*',
            description: 'Pattern matching with wildcards'
          },
          {
            type: 'literal',
            searchTerm: 'system.$suffix',
            description: 'Template variable (use as-is)'
          }
        ]);
      });

      it('should limit strategy count to prevent overwhelming results', () => {
        mockTemplateSrv.replace.mockReturnValue('a.b.c.d.e.f'); // Many parts
        
        const result = generateSearchStrategies('$a.$b.$c.$d.$e.$f');
        
        // Should have exactly 3 strategies: resolved, pattern, and template
        expect(result.length).toBe(3);
        expect(result[0].type).toBe('resolved');
        expect(result[1].type).toBe('pattern');
        expect(result[2].type).toBe('literal');
      });

      it('should handle multi-value template variables', () => {
        // Mock multi-value variable resolution - templateSrv.replace with 'pipe' format should return pipe-separated values
        mockTemplateSrv.replace.mockImplementation((input, undefined, format) => {
          if (format === 'pipe') {
            return 'system.web01.cpu|system.web02.cpu|system.web03.cpu';
          }
          return 'system.web01.cpu'; // Default behavior
        });
        
        const result = generateSearchStrategies('system.$server.cpu');
        
        expect(result.length).toBe(5); // 3 resolved values + pattern + template
        expect(result[0]).toEqual({
          type: 'resolved',
          searchTerm: 'system.web01.cpu',
          description: 'Resolved variable'
        });
        expect(result[1]).toEqual({
          type: 'resolved',
          searchTerm: 'system.web02.cpu',
          description: 'Resolved variable (2)'
        });
        expect(result[2]).toEqual({
          type: 'resolved',
          searchTerm: 'system.web03.cpu',
          description: 'Resolved variable (3)'
        });
        expect(result[3]).toEqual({
          type: 'pattern',
          searchTerm: 'system.*.cpu',
          description: 'Pattern matching with wildcards'
        });
        expect(result[4]).toEqual({
          type: 'literal',
          searchTerm: 'system.$server.cpu',
          description: 'Template variable (use as-is)'
        });
      });
    });
  });
});