System.register(["lodash"], function (exports_1, context_1) {
    "use strict";
    var lodash_1, GroupByTagsCtrl;
    var __moduleName = context_1 && context_1.id;
    function GroupByTagsDirective() {
        return {
            bindToController: true,
            controller: GroupByTagsCtrl,
            controllerAs: "ctrl",
            restrict: "E",
            scope: {
                allowedValues: "=",
                tags: "="
            },
            templateUrl: "public/plugins/grafana-kairosdb-datasource/partials/group.by.tags.html"
        };
    }
    exports_1("GroupByTagsDirective", GroupByTagsDirective);
    return {
        setters: [
            function (lodash_1_1) {
                lodash_1 = lodash_1_1;
            }
        ],
        execute: function () {
            GroupByTagsCtrl = /** @class */ (function () {
                function GroupByTagsCtrl() {
                    var _this = this;
                    this.selectedTags = {};
                    this.tags.forEach(function (tag) { return _this.selectedTags[tag] = true; });
                }
                GroupByTagsCtrl.prototype.onChange = function () {
                    this.tags = lodash_1.default.keys(lodash_1.default.pickBy(this.selectedTags));
                };
                GroupByTagsCtrl.prototype.addCustom = function (tag) {
                    if (!lodash_1.default.isEmpty(tag)) {
                        this.selectedTags[tag] = true;
                    }
                    this.inputVisible = !this.inputVisible;
                };
                return GroupByTagsCtrl;
            }());
            exports_1("GroupByTagsCtrl", GroupByTagsCtrl);
        }
    };
});
//# sourceMappingURL=group_by_tags.js.map