# Changelog

All notable changes to the KairosDB Grafana datasource plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] - 2024-08-10

### Major Changes - Angular to React Migration
- **BREAKING:** Migrated from Angular 1.x to React
- **BREAKING:** Updated to Grafana plugin framework v12.1.0
- **BREAKING:** Modernized build system from Grunt to Webpack

### Added
- ✨ **Histogram Support**: Full support for KairosDB histogram data visualization
  - Merge aggregator with precision parameter for exponential binning
  - Automatic histogram detection and heatmap rendering  
  - Sparse heatmap format compatibility with Grafana tooltips
  - Auto-sampling interval logic with snap-to-intervals
- 🎯 **Enhanced Multi-value Variables**: Improved template variable handling
  - Fixed alias processing for arrays and comma-separated values
  - Composite key mapping for multiple queries with same metric
  - Preserved variable expansion context in query responses
- 🚀 **Modern React Components**: Complete UI rebuilt with modern components
  - Collapsible query editor sections
  - AsyncSelect for metric name autocomplete  
  - Comprehensive aggregator parameter validation
  - Dynamic tag filtering interface
  - Time, value, and tag-based grouping controls
- 🛠️ **Developer Experience**: Modern development workflow
  - Webpack-based build system with live reload
  - TypeScript strict mode with modern ES modules
  - Jest unit testing with React Testing Library
  - Playwright E2E testing framework
  - ESLint + Prettier code formatting

### Enhanced
- ⚡ **Performance**: Optimized bundle size and loading performance
- 🎨 **User Interface**: Modern Grafana UI components and consistent styling
- 🔧 **Configuration**: Simplified datasource setup with better validation
- 📊 **Aggregators**: Support for 15+ KairosDB aggregator types with parameter validation
- 🏷️ **Variable Support**: Enhanced template variable interpolation and scoped variables
- 🧪 **Testing**: Comprehensive test coverage for all major functionality

### Fixed
- 🐛 Fixed Y-axis timestamp display issues in heatmaps
- 🐛 Resolved tooltip JavaScript errors with proper field structure  
- 🐛 Corrected auto sampling interval display formatting
- 🐛 Fixed multi-query response mapping with proper target assignment
- 🐛 Resolved alias preprocessing for template variables
- 🐛 Fixed empty groupBy parameter handling

### Technical Details
- Updated dependencies to Grafana v12.1.0
- Migrated from Angular dependency injection to modern Grafana services
- Implemented proper DataFrame response format
- Added comprehensive error handling and fallback mechanisms
- Maintained backward compatibility for existing dashboards

### Migration Notes
- Existing dashboards will continue to work without modification
- Plugin configuration may need to be re-saved in Grafana admin
- Custom dashboard templates should be tested for variable compatibility

---

## [3.x.x] - Historical Versions

Previous versions were based on Angular 1.x architecture. See git history for detailed changelog of earlier releases.