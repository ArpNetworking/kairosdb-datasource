"use strict";
module.exports = function(config) {
    config.set({
        frameworks: ["systemjs", "mocha", "chai", "sinon", "es6-shim", "karma-typescript"],
        files: [
            "specs/*.ts",
            "specs/**/*test.ts",
            { pattern: "src/**/*.ts", included: false },
            { pattern: "src/css/*.css", included: false },
            { pattern: "node_modules/grafana-sdk-mocks/**/*.ts", included: false },
            { pattern: "node_modules/grafana-sdk-mocks/**/*.js", included: false },
            { pattern: "node_modules/lodash/lodash.js", included: false },
            { pattern: "node_modules/mocha-each/build/index.js", included: false },
            { pattern: "node_modules/moment/moment.js", included: false },
            { pattern: "node_modules/q/q.js", included: false },
            { pattern: "node_modules/sprintf-js/dist/sprintf.min.js", included: false },
            { pattern: "node_modules/systemjs-plugin-css/css.js", included: false },
            { pattern: "node_modules/typescript/lib/typescript.js", included: false },
        ],
        karmaTypescriptConfig: {
            compilerOptions: {
                skipLibCheck: true,
                moduleResolution: "node",
                module: "system",
                target: "es2022",
                rootDir: "dist/",
                allowSyntheticDefaultImports: true,
                keepDirectoryHierarchy: false,
                declaration: true,
                emitDecoratorMetadata: true,
                esModuleInterop: true,
                experimentalDecorators: true,
                sourceMap: true,
                noImplicitAny: false
            }
        },
        preprocessors: {
            "**/*.ts": "karma-typescript"
        },
        singleRun: true,
        systemjs: {
            // SystemJS configuration specifically for tests, added after your config file.
            // Good for adding test libraries and mock modules
            config: {
                // Set path for third-party libraries as modules
                paths: {
                    "app/": "node_modules/grafana-sdk-mocks/app/",
                    "chai": "node_modules/chai/chai.js",
                    "css": "node_modules/systemjs-plugin-css/css.js",
                    "lodash": "node_modules/lodash/lodash.js",
                    "mocha-each": "node_modules/mocha-each/build/index.js",
                    "moment": "node_modules/moment/moment.js",
                    "q": "node_modules/q/q.js",
                    "sprintf-js": "node_modules/sprintf-js/dist/sprintf.min.js",
                    "system-polyfills": "node_modules/systemjs/dist/system-polyfills.js",
                    "systemjs": "node_modules/systemjs/dist/system.js",
                    "typescript": "node_modules/typescript/lib/typescript.js",
                },
                map: {
                    css: "node_modules/systemjs-plugin-css/css.js",
                    "typescript": "node_modules/typescript/",
                    "app/core/utils/kbn": "node_modules/grafana-sdk-mocks/app/core/utils/kbn.js"
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
                                "loader": "typescript"
                            }
                        }
                    },
                    "src": {
                        "defaultExtension": "ts",
                        meta: {
                            "*.css": { loader: "css" }
                        }
                    },
                    "specs": {
                        "defaultExtension": "ts",
                        "meta": {
                            "*.js": {
                                "loader": "typescript"
                            }
                        }
                    },
                },
            }
        },
        reporters: ["mocha", "junit", "karma-typescript"],
        logLevel: config.LOG_INFO,
        browsers: ["ChromeHeadless"],
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
