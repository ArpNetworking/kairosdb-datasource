# KairosDB Datasource Plugin for Grafana

A modern React-based Grafana datasource plugin for [KairosDB](https://kairosdb.github.io/), a time series database built on Cassandra.

## Features

- 📊 **Complete KairosDB Integration**: Query metrics with full aggregator support
- 📈 **Histogram Visualization**: Native support for KairosDB histogram data as heatmaps
- 🎯 **Advanced Template Variables**: Multi-value variables with proper alias handling
- 🏷️ **Tag-based Filtering**: Dynamic tag key/value selection and filtering
- ⏱️ **Flexible Grouping**: Time, value, and tag-based data grouping
- 🚀 **Modern UI**: Built with React and Grafana's latest UI components

## Installation

### From Grafana Plugin Repository

1. Open Grafana and navigate to **Administration** → **Plugins**
2. Search for "KairosDB"
3. Click **Install** and restart Grafana

### Manual Installation

```bash
# Clone into Grafana plugins directory
cd /var/lib/grafana/plugins
git clone https://github.com/grafana/kairosdb-datasource
cd kairosdb-datasource

# Install dependencies and build
npm install
npm run build:prod

# Restart Grafana
sudo systemctl restart grafana-server
```

### Docker Installation

```bash
# Using Grafana's plugin installation
docker run -d \
  -p 3000:3000 \
  --name=grafana \
  -e "GF_INSTALL_PLUGINS=grafana-kairosdb-datasource" \
  grafana/grafana
```

## Configuration

1. Navigate to **Administration** → **Data Sources**
2. Click **Add data source**
3. Select **KairosDB**
4. Configure connection settings:
   - **URL**: Your KairosDB server URL (e.g., `http://localhost:8080`)
   - **Access**: Server (default) or Browser
   - **Auth**: Configure if using authentication

### Advanced Settings

- **Snap to Intervals**: Configure automatic time interval snapping
- **Max Metrics**: Limit metric name autocomplete results
- **Request Timeout**: Set query timeout duration

## Usage

### Basic Query

1. Select a **Metric Name** (autocomplete available)
2. Add **Aggregators** for data processing
3. Configure **Group By** options for data grouping
4. Set **Tags** for filtering specific time series

### Template Variables

- **Metrics**: `metrics()` - List all available metrics
- **Tag Names**: `tag_names(metric_name)` - Get tag keys for a metric
- **Tag Values**: `tag_values(metric_name, tag_key)` - Get values for a tag

### Histogram Support

KairosDB histogram data is automatically detected and rendered as heatmaps:

- Use the **merge** aggregator with precision parameter
- Histograms appear as Grafana heatmap panels
- Automatic bin calculation and tooltip support

## Development

### Prerequisites

- Node.js 18+ and npm
- Docker (for development server)

### Development Setup

```bash
# Clone and install dependencies
git clone https://github.com/grafana/kairosdb-datasource
cd kairosdb-datasource
npm install

# Start development server with live reload
npm run dev

# Start Grafana development environment
npm run server
# Access at http://localhost:3000 (admin/admin)
```

### Available Scripts

- `npm run build` - Development build
- `npm run build:prod` - Production build
- `npm run dev` - Watch mode with live reload
- `npm run test` - Run unit tests
- `npm run test:ci` - Run tests in CI mode
- `npm run e2e` - End-to-end tests with Playwright
- `npm run lint` - Code linting
- `npm run typecheck` - TypeScript type checking

### Testing

```bash
# Unit tests
npm test

# E2E tests (requires server running)
npm run server  # In one terminal
npm run e2e     # In another terminal
```

## Architecture

This plugin uses modern Grafana plugin architecture:

- **React Components**: Modern UI built with React and TypeScript
- **Webpack Build**: Optimized bundling and development experience
- **Jest Testing**: Comprehensive unit test coverage
- **Playwright E2E**: End-to-end testing for UI interactions

### Key Components

- `src/datasource.ts` - Core datasource implementation
- `src/components/` - React UI components
- `src/aggregators.ts` - KairosDB aggregator definitions
- `src/utils/` - Utility functions and helpers

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes and add tests
4. Run linting and tests (`npm run lint && npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Compatibility

- **Grafana**: 9.0+ (tested with 11.3.0)
- **KairosDB**: 1.2+ (supports all modern features)
- **Browsers**: Modern browsers supporting ES2018+

## Support

- 📚 [KairosDB Documentation](https://kairosdb.github.io/docs/build/html/)
- 🐛 [Issues](https://github.com/grafana/kairosdb-datasource/issues)
- 💬 [Grafana Community](https://community.grafana.com/)

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Originally created for Angular, migrated to React in v4.0.0
- Built with Grafana's modern plugin development framework
- Special thanks to the KairosDB and Grafana communities
