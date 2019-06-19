System.register(["lodash"], function (exports_1, context_1) {
    "use strict";
    var lodash_1, GroupByValueCtrl;
    var __moduleName = context_1 && context_1.id;
    function GroupByValueDirective() {
        return {
            bindToController: true,
            controller: GroupByValueCtrl,
            controllerAs: "ctrl",
            restrict: "E",
            scope: {
                entries: "="
            },
            templateUrl: "public/plugins/grafana-kairosdb-datasource/partials/group.by.value.html"
        };
    }
    exports_1("GroupByValueDirective", GroupByValueDirective);
    return {
        setters: [
            function (lodash_1_1) {
                lodash_1 = lodash_1_1;
            }
        ],
        execute: function () {
            GroupByValueCtrl = /** @class */ (function () {
                function GroupByValueCtrl() {
                }
                GroupByValueCtrl.prototype.add = function (value) {
                    if (value && lodash_1.default.isNumber(parseInt(value, 10))) {
                        this.entries.push(value);
                    }
                    this.inputVisible = !this.inputVisible;
                };
                GroupByValueCtrl.prototype.remove = function (entry) {
                    this.entries = lodash_1.default.without(this.entries, entry);
                };
                return GroupByValueCtrl;
            }());
            exports_1("GroupByValueCtrl", GroupByValueCtrl);
        }
    };
});
//# sourceMappingURL=group_by_value.js.map