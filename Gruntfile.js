module.exports = function (grunt) {
    require("load-grunt-tasks")(grunt);
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("@string-bean/grunt-package-modules");
    grunt.loadNpmTasks("grunt-tslint");

    grunt.initConfig({
        clean: {
            dist: ["dist"],
            post: ["dist/node_modules"]
        },
        packageModules: {
            dist: {
                src: "package.json",
                dest: "dist"
            },
        },
        copy: {
            source: {
                expand: true,
                cwd: "src",
                src: ["**/*.ts"],
                dest: "dist/"
            },
            static: {
                expand: true,
                cwd: "src",
                src: ["css/*.css", "img/*"],
                dest: "dist/"
            },
            partials: {
                expand: true,
                cwd: "src/partials",
                src: ["*.html"],
                dest: "dist/partials"
            },
            metadata: {
                expand: true,
                src: ["plugin.json", "README.md"],
                dest: "dist"
            }
        },
        watch: {
            rebuild_all: {
                files: ["src/**/*"],
                tasks: ["watch-ts"],
                options: {spawn: false}
            }
        },
        tslint: {
            options: {
                configuration: "tslint.json"
            },
            files: {
                src: [
                    "src/**/*.ts"
                ]
            },
            test: {
                src: [
                    "specs/*.ts",
                    "specs/**/*.ts"
                ]
            }
        },
        ts: {
            build: {
                src: [
                    "dist/**/*.ts"
                ],
                dest: "dist/",
                options: {
                    skipLibCheck: true,
                    moduleResolution: "node",
                    module: "system",
                    target: "es2022",
                    rootDir: "./dist",
                    allowSyntheticDefaultImports: true,
                    keepDirectoryHierarchy: false,
                    declaration: true,
                    emitDecoratorMetadata: true,
                    esModuleInterop: true,
                    experimentalDecorators: true,
                    sourceMap: true,
                    noImplicitAny: false
                }
            }
        },
        babel: {
            options: {
                sourceMap: true,
                presets: ["es2015"]
            },
            distTestsSpecsNoSystemJs: {
                files: [{
                    expand: true,
                    cwd: "src/spec",
                    src: ["**/*.js"],
                    dest: "dist/test/spec",
                    ext: ".js"
                }]
            }
        },
    });

    grunt.registerTask("default", [
        "clean:dist",
        "copy",
        "tslint",
        "ts:build",
        "packageModules",
        "babel",
        "clean:post"
    ]);
};
