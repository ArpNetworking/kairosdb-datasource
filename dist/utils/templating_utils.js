System.register(["lodash"], function (exports_1, context_1) {
    "use strict";
    var lodash_1, TemplatingUtils;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (lodash_1_1) {
                lodash_1 = lodash_1_1;
            }
        ],
        execute: function () {
            TemplatingUtils = (function () {
                function TemplatingUtils(templateSrv, scopedVars) {
                    this.templateSrv = templateSrv;
                    this.scopedVars = scopedVars;
                }
                TemplatingUtils.prototype.replace = function (expression) {
                    var scopedVars = this.scopedVars;
                    var replacedExpression = this.templateSrv.replace(expression, this.scopedVars, TemplatingUtils.customFormatterFn);
                    if (replacedExpression) {
                        var matchedMultiValues = replacedExpression.match(TemplatingUtils.MULTI_VALUE_REGEX);
                        if (!lodash_1.default.isNil(matchedMultiValues)) {
                            var replacedValues_1 = [replacedExpression];
                            matchedMultiValues.forEach(function (multiValue) {
                                var values = multiValue.replace(TemplatingUtils.MULTI_VALUE_BOUNDARIES, "")
                                    .split(TemplatingUtils.MULTI_VALUE_SEPARATOR);
                                replacedValues_1 = lodash_1.default.flatMap(values, function (value) {
                                    return replacedValues_1.map(function (replacedValue) {
                                        if (Object.hasOwn(scopedVars, value)) {
                                            return replacedValue.replace(multiValue, value);
                                        }
                                        else {
                                            return replacedValue;
                                        }
                                    });
                                });
                            });
                            return replacedValues_1;
                        }
                    }
                    return [replacedExpression];
                };
                TemplatingUtils.prototype.replaceAll = function (expressions) {
                    var _this = this;
                    return lodash_1.default.flatten(expressions.map(function (expression) { return _this.replace(expression); }));
                };
                TemplatingUtils.MULTI_VALUE_SEPARATOR = "_MAGIC_DELIM_";
                TemplatingUtils.customFormatterFn = function (value, _variable, _unused) {
                    if (Array.isArray(value)) {
                        if (value.length > 1) {
                            var inner = value.join(TemplatingUtils.MULTI_VALUE_SEPARATOR);
                            return "{" + inner + "}";
                        }
                        else if (value.length === 1) {
                            return value[0];
                        }
                        else {
                            throw Error("You can't format an empty array");
                        }
                    }
                    return value;
                };
                TemplatingUtils.MULTI_VALUE_REGEX = /{.*?}/g;
                TemplatingUtils.MULTI_VALUE_BOUNDARIES = /[{}]/g;
                return TemplatingUtils;
            }());
            exports_1("TemplatingUtils", TemplatingUtils);
        }
    };
});
//# sourceMappingURL=templating_utils.js.map