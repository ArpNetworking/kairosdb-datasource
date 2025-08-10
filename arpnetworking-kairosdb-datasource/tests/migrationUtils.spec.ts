import { MigrationUtils } from '../src/utils/migrationUtils';

describe('MigrationUtils', () => {
  describe('migrateAggregators', () => {
    it('should migrate old format aggregators to new format', () => {
      const oldFormatAggregators = [
        {
          "autoValueSwitch": {
            "dependentParameters": [
              {
                "name": "value",
                "text": "every",
                "type": "sampling",
                "value": "1"
              },
              {
                "allowedValues": {
                  "0": "MILLISECONDS",
                  "1": "SECONDS",
                  "2": "MINUTES",
                  "3": "HOURS",
                  "4": "DAYS",
                  "5": "WEEKS",
                  "6": "MONTHS",
                  "7": "YEARS"
                },
                "name": "unit",
                "text": "unit",
                "type": "sampling_unit",
                "value": "3"
              }
            ],
            "enabled": true
          },
          "name": "count",
          "parameters": [
            {
              "allowedValues": {
                "0": "NONE",
                "1": "START_TIME",
                "2": "SAMPLING",
                "3": "PERIOD"
              },
              "name": "sampling",
              "text": "align by",
              "type": "alignment",
              "value": "3"
            },
            {
              "name": "value",
              "text": "every",
              "type": "sampling",
              "value": "1"
            },
            {
              "allowedValues": {
                "0": "MILLISECONDS",
                "1": "SECONDS",
                "2": "MINUTES",
                "3": "HOURS",
                "4": "DAYS",
                "5": "WEEKS",
                "6": "MONTHS",
                "7": "YEARS"
              },
              "name": "unit",
              "text": "unit",
              "type": "sampling_unit",
              "value": "3"
            }
          ]
        }
      ];

      const result = MigrationUtils.migrateAggregators(oldFormatAggregators);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('count');
      expect(result[0].autoValueSwitch?.enabled).toBe(true);
      expect(result[0].autoValueSwitch?.dependentParameters).toEqual(['sampling', 'sampling_unit']);
      
      const parameters = result[0].parameters;
      expect(parameters).toHaveLength(3);
      
      // Check that allowedValues were resolved
      expect(parameters.find(p => p.name === 'sampling')?.value).toBe('PERIOD');
      expect(parameters.find(p => p.name === 'unit')?.value).toBe('hours');
      expect(parameters.find(p => p.name === 'value')?.value).toBe('1');
    });

    it('should detect when migration is needed', () => {
      const oldFormat = [
        {
          autoValueSwitch: {
            dependentParameters: [
              { type: 'sampling', name: 'value' }
            ],
            enabled: true
          }
        }
      ];

      const newFormat = [
        {
          autoValueSwitch: {
            dependentParameters: ['sampling', 'sampling_unit'],
            enabled: true
          }
        }
      ];

      expect(MigrationUtils.needsMigration(oldFormat)).toBe(true);
      expect(MigrationUtils.needsMigration(newFormat)).toBe(false);
    });
  });
});
