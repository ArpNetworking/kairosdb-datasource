# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development

- `npm run build` - Build plugin for development
- `npm run build:prod` - Build plugin for production
- `npm run dev` - Watch mode development build with live reload
- `npm test` - Run Jest unit tests
- `npm run test:ci` - Run tests in CI mode (no watch)
- `npm install` - Install dependencies

### Code Quality

- `npm run lint` - Run ESLint on source files
- `npm run lint:fix` - Run ESLint and automatically fix issues
- `npm run typecheck` - Run TypeScript type checking without emitting files

### Development Environment

- `npm run server` - Start Grafana development server with Docker Compose
- `GRAFANA_VERSION=11.3.0 npm run server` - Start specific Grafana version
- Grafana runs on http://localhost:3000 with anonymous admin access enabled
- Plugin automatically loads from dist/ directory during development

### Testing

- `npm test` - Unit tests with Jest (watch mode)
- `npm run e2e` - End-to-end tests with Playwright (requires server running first)

## Architecture Overview

This is a Grafana datasource plugin for KairosDB, a time series database built on Cassandra. The plugin has been migrated from Angular to React components using modern Grafana plugin architecture.

### Core Components

**Main Entry Point**

- `src/module.ts` - Plugin registration using `DataSourcePlugin` class
- Sets up React components: `ConfigEditor`, `QueryEditor`, `VariableQueryEditor`

**Data Source Core**

- `src/datasource.ts` - Main datasource implementation extending Grafana's `DataSourceApi`
- Handles query execution, metric name fetching, and variable interpolation
- Critical alias processing logic for multi-value template variables

**React UI Components**

- `src/components/` - Modern React components replacing Angular directives
  - `QueryEditor.tsx` - Main query editor with collapsible sections
  - `ConfigEditor.tsx` - Datasource configuration form
  - `VariableQueryEditor.tsx` - Template variable query interface
  - `MetricNameField.tsx` - AsyncSelect for metric name autocomplete
  - `Aggregators.tsx` - Aggregator configuration with parameter validation
  - `TagsEditor.tsx` - Tag filtering interface
  - `GroupByEditor.tsx` - Time, value, and tag grouping controls

**Utility Functions**

- `src/utils/` - Shared utility functions
  - `variableUtils.ts` - Template variable interpolation helpers
  - `timeUtils.ts` - Time-related utilities
  - `cacheUtils.ts` - Caching logic
  - `parameterUtils.ts` - Aggregator parameter handling

### Key Features

- **Multi-value Template Variables**: Advanced alias processing handles arrays and comma-separated values
- **Metric Autocomplete**: AsyncSelect with prefix search (^) and configurable limits
- **Comprehensive Aggregators**: 15+ KairosDB aggregator types with parameter validation
- **Flexible Grouping**: Time, value, and tag-based grouping with preview functionality
- **Tag Filtering**: Dynamic tag key/value selection based on metric selection
- **Variable Interpolation**: Custom template variable functions and scoped variable support

### Critical Implementation Details

**Alias Processing Pipeline**

- Grafana pre-processes alias strings before datasource receives them
- Solution: Intercept original alias values from `options.targets` before transformation
- Uses composite keys (`metricName|refId`) to handle multiple queries for same metric
- Tracks refId order to properly distribute results between multiple targets

**Query Response Mapping**

- Maps KairosDB response results back to original targets using composite keys
- Handles multiple time series per query (common with groupBy operations)
- Preserves variable expansion context for proper alias interpolation

**Template Variable Edge Cases**

- Defensive handling when `templateSrv` is undefined in test environments
- Custom fallback implementation for variable interpolation
- Proper scoped variable context preservation during query execution

### Testing Architecture

**Unit Tests**

- Jest configuration with jsdom environment
- Tests located in `tests/` directory
- Separate test files for different functionality areas
- Mock Grafana APIs using custom mocks and defensive coding

**E2E Tests**

- Playwright configuration for browser testing
- Tests actual plugin loading and UI interaction
- Configured for headless execution (non-interactive mode)
- Separate Jest and Playwright test configurations to avoid conflicts

### Build Architecture

- Webpack-based build system replacing legacy Grunt
- TypeScript compilation targeting modern ES versions
- React/JSX support with SWC transformer
- Development server with live reload via Docker Compose
- Plugin distributed via `dist/` directory with proper Grafana plugin structure
- Tilt is used to run builds and the development server. It should always be up and running while we're developing
