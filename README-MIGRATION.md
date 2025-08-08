# KairosDB Datasource Migration Setup

This repository now contains both the **old Angular-based plugin** and the **new React-based plugin** running side by side for comparison during migration.

## Directory Structure

```
├── kairosdb-datasource-old/          # Original Angular plugin
│   ├── src/                          # Angular components and directives
│   ├── Gruntfile.js                  # Legacy build system
│   └── package.json                  # Legacy dependencies
├── arpnetworking-kairosdb-datasource/ # New React plugin
│   ├── src/                          # Modern React components
│   ├── .config/                      # Webpack configuration
│   └── package.json                  # Modern dependencies
├── Tiltfile                          # Development environment (both plugins)
├── Dockerfile.old                    # Build for Angular plugin
├── Dockerfile.new                    # Build for React plugin
└── k8s/
    ├── deployment-old.yaml           # Kubernetes manifest for old plugin
    └── deployment-new.yaml           # Kubernetes manifest for new plugin
```

## Development Environment

Run both plugins simultaneously for comparison:

```bash
tilt up
```

This will deploy:
- **OLD Plugin (Angular)**: http://localhost:3000
- **NEW Plugin (React)**: http://localhost:3001

Both instances have anonymous admin access enabled for easy testing.

## Features

- ✅ Side-by-side comparison of old vs new plugin
- ✅ Live reload for both plugins during development
- ✅ Shared provisioning (same dashboards and datasources)
- ✅ Independent build systems (Grunt vs Webpack)
- ✅ Kubernetes deployment for both versions

## Migration Status

- [x] **Phase 1**: Modern foundation setup complete
- [ ] **Phase 2**: React UI components migration
- [ ] **Phase 3**: Testing and optimization
- [ ] **Phase 4**: Production deployment

See `MIGRATION_PLAN.md` for detailed migration roadmap.