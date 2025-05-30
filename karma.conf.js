"use strict";
module.exports = function(config) {
    config.set({
        frameworks: ["systemjs", "sinon", "mocha", "chai", "es6-shim", "karma-typescript"],
        files: [
            "specs/**/*.ts",
            "specs/**/*.js",
            "src/**/*.ts",
            { pattern: 'node_modules/@grafana/data/**/*.js', included: false },
            { pattern: 'node_modules/@grafana/schema/**/*.js', included: false },
            { pattern: 'node_modules/grafana-sdk-mocks/**/*.ts', included: false },
            // { pattern: 'node_modules/grafana-sdk-mocks/**/*.js', included: false },
            { pattern: 'node_modules/typescript/lib/typescript.js', included: false },
            { pattern: 'node_modules/mocha-each/build/index.js', included: false },
            { pattern: 'node_modules/lodash/lodash.js', included: false },
            { pattern: 'node_modules/moment/moment.js', included: false },
            { pattern: 'node_modules/sprintf-js/dist/sprintf.min.js', included: false },
            { pattern: 'node_modules/q/q.js', included: false }
        ],
        karmaTypescriptConfig: {
            tsconfig: "./tsconfig.json"
        },
        preprocessors: {
            "**/*.ts": "karma-typescript",
        },
        singleRun: true,
        systemjs: {
            // SystemJS configuration specifically for tests, added after your config file.
            // Good for adding test libraries and mock modules
            config: {
                // Set path for third-party libraries as modules
                paths: {
                    "@grafana/data": "node_modules/@grafana/data/dist/index.js",
                    "@grafana/schema": "node_modules/@grafana/schema/dist/index.js",
                    "app/": "node_modules/grafana-sdk-mocks/app/",
                    "chai": "node_modules/chai/chai.js",
                    "css": "node_modules/systemjs-plugin-css/css.js",
                    "lodash": "node_modules/lodash/lodash.js",
                    "mocha-each": "node_modules/mocha-each/build/index.js",
                    "moment": "node_modules/moment/moment.js",
                    "q": "node_modules/q/q.js",
                    "sinon": "node_modules/sinon/pkg/sinon.js",
                    "sprintf-js": "node_modules/sprintf-js/dist/sprintf.min.js",
                    "system-polyfills": "node_modules/systemjs/dist/system-polyfills.js",
                    "systemjs": "node_modules/systemjs/dist/system.js",
                    "typescript": "node_modules/typescript/lib/typescript.js",
                },
                map: {
                    css: "node_modules/systemjs-plugin-css/css.js",
                    "typescript": "node_modules/typescript/",
                },
                packages: {
                    "typescript": {
                        "main": "lib/typescript.js",
                        "meta": {
                            "lib/typescript.js": {
                                "exports": "ts"
                            }
                        }
                    },
                    "app": {
                        "defaultExtension": "ts",
                        "meta": {
                            "*.js": {
                                "loader": "typescript",
                                "format": "register"
                            }
                        }
                    },
                    "src": {
                        "defaultExtension": "js",
                        meta: {
                            "*.css": { loader: "css" },
                            "*.js": { "format": "register"}
                        }
                    },
                    "specs": {
                        "defaultExtension": "js",
                        "meta": {
                            "*.js": {
                                "loader": "typescript",
                                "format": "register"
                            }
                        }
                    },
                },
            }
        },
        reporters: ["mocha", "junit", "karma-typescript"],
        // logLevel: config.LOG_DEBUG,
        browsers: ['ChromeHeadlessNoSandbox'],
        browserConsoleLogOptions: {
            terminal: true,
            level: "debug"
        },
        customLaunchers: {
            ChromeHeadlessNoSandbox: {
                base: 'ChromeHeadless',
                flags: ['--no-sandbox']
            }
        },
        junitReporter: {
            outputFile: 'kairosdb-plugin-unit-tests-results.xml',
            outputDir: 'test-results',
            useBrowserName: false
        },
        mochaReporter: {
            showDiff: true
        }
    });
};
