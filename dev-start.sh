#!/bin/bash

# Development startup script for KairosDB Grafana Plugin

echo "🚀 Starting KairosDB Grafana Plugin Development Environment"
echo ""
echo "This will:"
echo "  - Build the plugin using Docker"
echo "  - Deploy Grafana with the plugin to Kubernetes"
echo "  - Set up automatic rebuilds on code changes"
echo "  - Make Grafana available at http://localhost:3000"
echo ""

# Check if tilt is installed
if ! command -v tilt &> /dev/null; then
    echo "❌ Tilt is not installed. Please install Tilt first:"
    echo "   https://docs.tilt.dev/install.html"
    exit 1
fi

# Check if kubectl is configured
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ kubectl is not configured or Kubernetes cluster is not accessible"
    echo "   Please ensure you have a Kubernetes cluster running (Docker Desktop, minikube, etc.)"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""
echo "Starting Tilt..."
echo "Press Ctrl+C to stop the development environment"
echo ""

exec tilt up
