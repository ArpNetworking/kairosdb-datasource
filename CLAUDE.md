# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `grunt` - Main build command that compiles TypeScript, runs linting, packages modules, and prepares distribution
- `npm test` - Run Jest tests
- `npm install` - Install dependencies
- `grunt watch` - Watch for file changes and rebuild automatically

### Code Quality
- `grunt tslint` - Run TSLint on source files
- TSLint configuration in `tslint.json` with max line length of 140 characters

### Development Environment
- `tilt up` - Start development environment with live reload using Tilt
- `docker-compose up` - Alternative using Docker Compose (legacy)
- Tilt provides automatic rebuilds on source changes and Kubernetes deployment
- Grafana runs on http://localhost:3000 with anonymous admin access enabled

### Build Process
The Grunt build process:
1. Cleans dist directory
2. Copies source files and static assets
3. Runs TSLint validation
4. Compiles TypeScript using SystemJS modules targeting ES5
5. Packages npm modules
6. Applies Babel transformations
7. Cleans up temporary files

## Architecture Overview

This is a Grafana datasource plugin for KairosDB, a time series database built on Cassandra.

### Core Components

**Main Entry Point**
- `src/module.ts` - Plugin module registration and Angular directive setup
- Exports main classes: `KairosDBDatasource`, `KairosDBQueryCtrl`, `KairosDBConfigCtrl`, `KairosDBQueryOptionsCtrl`

**Data Source Core**
- `src/core/datasource.ts` - Main datasource implementation extending Grafana's `DataSourceApi`
- `src/core/query_ctrl.ts` - Query editor controller for building KairosDB queries
- `src/core/config_ctrl.ts` - Configuration UI controller
- `src/core/metric_names_store.ts` - Handles metric name caching and retrieval

**Request/Response Handling**
- `src/core/request/` - Query building, validation, and parameter conversion
  - `query_builder.ts` - Builds KairosDB API queries
  - `target_validator.ts` - Validates query targets before execution
  - `parameter_object_builder.ts` - Constructs aggregator parameters
- `src/core/response/` - Response processing and series naming
  - `response_handler.ts` - Processes KairosDB API responses
  - `series_name_builder.ts` - Generates Grafana series names

**Data Models**
- `src/beans/request/` - Query target and metric tag models
  - `target.ts` - Main query target representation (`KairosDBTarget`)
  - `metric_tags.ts` - Tag filtering and grouping
- `src/beans/aggregators/` - KairosDB aggregator implementations
  - Over 15 different aggregator types (percentile, rate, scale, etc.)
  - Each with specific parameter validation and building

**UI Directives**
- `src/directives/` - Angular directives for query editor UI
  - `aggregators.ts` - Aggregator selection and configuration
  - `tags_select.ts` - Tag key/value selection
  - `group_by/` - Time, value, and tag grouping controls

### Key Features
- Legacy target conversion for backward compatibility
- Templating variable support with custom functions
- Metric name autocomplete with configurable limits
- Snap-to-interval functionality for time alignment
- Comprehensive aggregator support with parameter validation
- Tag-based filtering and grouping

### Testing
- Jest configuration with coverage reporting
- Test files in `specs/` directory mirror `src/` structure
- Uses `grafana-sdk-mocks` for Grafana API mocking
- Tests cover datasource functionality, query building, and response handling

### Build Output
- Compiled plugin goes to `dist/` directory
- Uses SystemJS module format for Grafana compatibility
- TypeScript compiled to ES5 target
- Includes source maps for debugging