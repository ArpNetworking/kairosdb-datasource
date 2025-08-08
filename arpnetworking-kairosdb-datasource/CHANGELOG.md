# KairosDB Datasource Angular to React Migration Plan

## Overview
This document outlines the comprehensive plan to migrate the KairosDB Grafana datasource plugin from Angular 1.x to React. The migration follows an incremental approach to minimize disruption and ensure backward compatibility.

## Current State Analysis

### Angular Components (To Migrate)
- **Controllers:** `KairosDBQueryCtrl`, `KairosDBConfigCtrl`
- **Directives:** 15+ UI components (aggregators, tags, grouping, metric fields)
- **Templates:** 17 HTML partials with Angular syntax
- **Build System:** Grunt + SystemJS + Babel + TSLint

### Business Logic (Mostly Reusable)
- **Core Datasource:** `KairosDBDatasource` class
- **Data Models:** Aggregators, targets, queries, parameters
- **Utilities:** Validation, templating, time handling
- **Request/Response:** Query building, response handling

## Migration Strategy: Incremental Approach

---

## Phase 1: Modern Foundation Setup (Estimated: 1-2 weeks)

### 1.1 Project Structure & Build System
**Objective:** Establish modern development environment alongside existing system

#### 1.1.1 Create Modern Build System
- [ ] Create new branch: `migrate-to-react`
- [ ] Run `npx @grafana/create-plugin@latest` in temporary directory
- [ ] Copy modern configuration files to project:
  - [ ] `webpack.config.js`
  - [ ] `.eslintrc.json` (replace TSLint)
  - [ ] Modern `tsconfig.json`
  - [ ] `jest.config.js` (replace Karma)
- [ ] Update `.gitignore` for modern build artifacts

#### 1.1.2 Package.json Modernization
- [ ] Add modern dependencies:
  - [ ] `@grafana/ui`, `@grafana/data`, `@grafana/runtime` (latest)
  - [ ] `react`, `react-dom`, `@types/react`
  - [ ] `webpack`, `@grafana/toolkit`
  - [ ] `@testing-library/react`, `@testing-library/jest-dom`
- [ ] Update scripts section:
  - [ ] `"build": "grafana-toolkit plugin:build"`
  - [ ] `"dev": "grafana-toolkit plugin:dev"`
  - [ ] `"watch": "grafana-toolkit plugin:dev --watch"`
  - [ ] `"lint": "eslint --cache --ignore-path ./.gitignore --ext .js,.jsx,.ts,.tsx ./src"`
- [ ] Remove legacy dependencies (keep temporarily):
  - [ ] Mark Grunt, SystemJS, Babel as deprecated
  - [ ] Keep Angular dependencies for gradual migration

#### 1.1.3 TypeScript Configuration
- [ ] Update `tsconfig.json` for modern React/JSX support
- [ ] Add React types and modern ES modules
- [ ] Configure path mapping for clean imports
- [ ] Set up strict type checking

### 1.2 Core Datasource Migration
**Objective:** Migrate core datasource to modern Grafana plugin API

#### 1.2.1 Plugin Definition Update
- [ ] Create new `src/plugin.ts`:
  ```typescript
  import { DataSourcePlugin } from '@grafana/data';
  import { KairosDBDatasource } from './datasource';
  import { ConfigEditor } from './components/ConfigEditor';
  import { QueryEditor } from './components/QueryEditor';
  
  export const plugin = new DataSourcePlugin(KairosDBDatasource)
    .setConfigEditor(ConfigEditor)
    .setQueryEditor(QueryEditor);
  ```

#### 1.2.2 Datasource Class Modernization  
- [ ] Update `src/datasource.ts` imports:
  - [ ] Replace `@grafana/data` old imports with new ones
  - [ ] Remove Angular dependency injection
- [ ] Modernize constructor signature:
  - [ ] Replace Angular services with modern equivalents
  - [ ] Use `getBackendSrv()` instead of injected service
  - [ ] Use `getTemplateSrv()` for templating
- [ ] Update `query()` method:
  - [ ] Ensure proper DataFrame response format
  - [ ] Add modern error handling
- [ ] Update `testDatasource()` method:
  - [ ] Return proper `TestingStatus` format

#### 1.2.3 Type Definitions
- [ ] Create `src/types.ts`:
  - [ ] Define `KairosDBQuery` interface
  - [ ] Define `KairosDBDataSourceOptions` interface  
  - [ ] Define `KairosDBSecureJsonData` interface
- [ ] Update existing interfaces to extend Grafana types
- [ ] Add proper generic type parameters

---

## Phase 2: React UI Components (Estimated: 2-3 weeks)

### 2.1 Configuration Editor
**Objective:** Replace Angular config controller with React component

#### 2.1.1 Create ConfigEditor Component
- [ ] Create `src/components/ConfigEditor.tsx`:
  - [ ] Use `DataSourcePluginOptionsEditorProps` type
  - [ ] Implement basic form fields (URL, auth, etc.)
  - [ ] Use `@grafana/ui` components (`Field`, `Input`, `Switch`)
- [ ] Add configuration validation
- [ ] Handle secure JSON data properly
- [ ] Test connection functionality

#### 2.1.2 Configuration Features
- [ ] Add KairosDB-specific options:
  - [ ] Snap-to intervals configuration
  - [ ] Max metrics for autocomplete
  - [ ] Timeout settings
  - [ ] Enforce scalar setting
- [ ] Form validation and error handling
- [ ] Help text and documentation links

### 2.2 Query Editor Foundation
**Objective:** Create main query editor structure

#### 2.2.1 Create QueryEditor Component
- [ ] Create `src/components/QueryEditor.tsx`:
  - [ ] Use `QueryEditorProps` type
  - [ ] Basic query structure layout
  - [ ] Metric name field component
- [ ] State management for query object
- [ ] onChange handlers for query updates
- [ ] Integration with datasource methods

#### 2.2.2 Query Editor Layout
- [ ] Create responsive layout structure
- [ ] Add collapsible sections
- [ ] Implement query alias field
- [ ] Add query validation feedback

### 2.3 Core UI Components Migration
**Objective:** Convert Angular directives to React components

#### 2.3.1 Metric Name Components
- [ ] Create `src/components/MetricNameField.tsx`:
  - [ ] Autocomplete functionality
  - [ ] Integration with metric names store
  - [ ] Loading states and error handling
- [ ] Create `src/components/MetricNameRow.tsx`
- [ ] Handle templating variables in metric names

#### 2.3.2 Aggregators Components
- [ ] Create `src/components/Aggregators.tsx`:
  - [ ] List of selected aggregators
  - [ ] Add/remove aggregator functionality
- [ ] Create `src/components/AggregatorEditor.tsx`:
  - [ ] Parameter configuration for each aggregator type
  - [ ] Dynamic form based on aggregator type
  - [ ] Auto-value switch functionality
- [ ] Create `src/components/Aggregator.tsx`:
  - [ ] Individual aggregator display/edit
  - [ ] Parameter validation

#### 2.3.3 Tags and Filtering Components
- [ ] Create `src/components/TagsSelect.tsx`:
  - [ ] Tag key/value selection
  - [ ] Multiple tag support
  - [ ] Tag validation
- [ ] Create `src/components/TagInput.tsx`:
  - [ ] Individual tag input field
  - [ ] Autocomplete for tag values
- [ ] Create `src/components/TagsEditor.tsx`:
  - [ ] Complete tags management interface

#### 2.3.4 Group By Components
- [ ] Create `src/components/GroupByTime.tsx`:
  - [ ] Time-based grouping configuration
  - [ ] Time unit selection
  - [ ] Range configuration
- [ ] Create `src/components/GroupByValue.tsx`:
  - [ ] Value-based grouping settings
  - [ ] Group count configuration
- [ ] Create `src/components/GroupByTags.tsx`:
  - [ ] Tag-based grouping
  - [ ] Tag selection for grouping

### 2.4 Advanced Components
**Objective:** Handle complex UI interactions

#### 2.4.1 Auto Value Switch Component
- [ ] Create `src/components/AutoValueSwitch.tsx`:
  - [ ] Toggle between auto and manual values
  - [ ] Dependent parameter management
  - [ ] Context-aware parameter switching

#### 2.4.2 Time Picker Integration
- [ ] Create `src/components/TimePicker.tsx` (if needed):
  - [ ] Custom time range selection
  - [ ] Integration with Grafana time picker
- [ ] Handle time override functionality

---

## Phase 3: Testing & Migration Completion (Estimated: 1 week)

### 3.1 Component Testing
**Objective:** Ensure all React components work correctly

#### 3.1.1 Unit Tests Migration
- [ ] Convert existing Jest tests to React Testing Library:
  - [ ] Datasource tests (mostly reusable)
  - [ ] Aggregator logic tests (reusable)
  - [ ] Utility function tests (reusable)
- [ ] Create new React component tests:
  - [ ] ConfigEditor interaction tests
  - [ ] QueryEditor functionality tests
  - [ ] Individual component tests

#### 3.1.2 Integration Tests
- [ ] Test datasource with React UI:
  - [ ] Query building and execution
  - [ ] Configuration changes
  - [ ] Error handling scenarios
- [ ] Test backward compatibility:
  - [ ] Existing dashboard loading
  - [ ] Query migration from old format

### 3.2 Performance & Polish
**Objective:** Optimize and finalize the migration

#### 3.2.1 Performance Optimization
- [ ] Bundle size analysis and optimization
- [ ] Lazy loading for heavy components
- [ ] Memoization for expensive operations
- [ ] Remove unused Angular code and dependencies

#### 3.2.2 Final Cleanup
- [ ] Remove legacy build system (Grunt configuration)
- [ ] Remove Angular dependencies and templates
- [ ] Update documentation and README
- [ ] Update plugin.json version and metadata

### 3.3 Migration Validation
**Objective:** Ensure successful migration

#### 3.3.1 Functionality Testing
- [ ] Test all aggregator types and parameters
- [ ] Test complex queries with grouping/tags
- [ ] Test templating variable integration
- [ ] Test error scenarios and edge cases

#### 3.3.2 User Experience Testing
- [ ] Compare UI/UX with original Angular version
- [ ] Test accessibility compliance
- [ ] Test responsive design
- [ ] Performance comparison testing

---

## Phase 4: Deployment & Rollout (Estimated: 1 week)

### 4.1 Release Preparation
**Objective:** Prepare for production deployment

#### 4.1.1 Version Management
- [ ] Update version to 4.0.0 (major version for breaking changes)
- [ ] Create migration notes for users
- [ ] Update plugin.json with new version info
- [ ] Prepare release notes

#### 4.1.2 Documentation Updates
- [ ] Update CLAUDE.md with new development commands
- [ ] Update README with migration information
- [ ] Document any breaking changes
- [ ] Update development setup instructions

### 4.2 Deployment Strategy
**Objective:** Safe rollout of new version

#### 4.2.1 Pre-release Testing
- [ ] Create pre-release version for testing
- [ ] Test with various Grafana versions
- [ ] Community beta testing program
- [ ] Performance benchmarking

#### 4.2.2 Release Rollout
- [ ] Create GitHub release with artifacts
- [ ] Update Grafana plugin repository
- [ ] Monitor for issues and feedback
- [ ] Prepare hotfix process if needed

---

## Risk Mitigation

### High Risk Areas
1. **Query Compatibility:** Ensure existing dashboards continue to work
2. **Performance:** React bundle size vs Angular
3. **Feature Parity:** All Angular features work in React
4. **User Adoption:** Smooth transition for existing users

### Mitigation Strategies
- Maintain feature flags for gradual rollout
- Comprehensive testing suite
- Beta testing with community
- Rollback plan to previous version
- Clear migration documentation

---

## Success Metrics

### Technical Metrics
- [ ] Bundle size reduction > 20%
- [ ] Build time improvement > 50%  
- [ ] Test coverage maintained > 80%
- [ ] Zero regressions in core functionality

### User Experience Metrics
- [ ] UI response time improvement
- [ ] Reduced bug reports
- [ ] Positive community feedback
- [ ] Adoption rate of new version

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | 1-2 weeks | Modern build system, core datasource migration |
| Phase 2 | 2-3 weeks | All React UI components, feature parity |
| Phase 3 | 1 week | Testing, performance optimization, cleanup |
| Phase 4 | 1 week | Release preparation and deployment |
| **Total** | **5-7 weeks** | Production-ready React-based plugin |

---

## Next Steps

1. Review and approve this migration plan
2. Create `migrate-to-react` branch
3. Begin Phase 1.1.1: Create modern build system
4. Set up development environment with both build systems
5. Start incremental migration while maintaining existing functionality