System.register(["@grafana/data", "lodash"], function (exports_1, context_1) {
    "use strict";
    var data_1, lodash_1, KairosDBResponseHandler;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (data_1_1) {
                data_1 = data_1_1;
            },
            function (lodash_1_1) {
                lodash_1 = lodash_1_1;
            }
        ],
        execute: function () {
            KairosDBResponseHandler = (function () {
                function KairosDBResponseHandler(seriesNameBuilder) {
                    this.seriesNameBuilder = seriesNameBuilder;
                }
                KairosDBResponseHandler.prototype.convertToDatapoints = function (data, aliases) {
                    var queries = data.queries;
                    var dataFrames = [];
                    for (var _i = 0, queries_1 = queries; _i < queries_1.length; _i++) {
                        var query = queries_1[_i];
                        for (var _a = 0, _b = query.results; _a < _b.length; _a++) {
                            var result = _b[_a];
                            var times = new data_1.ArrayVector();
                            var values = new data_1.ArrayVector();
                            var tags = {};
                            for (var _c = 0, _d = result.values; _c < _d.length; _c++) {
                                var datapoint = _d[_c];
                                times.add(datapoint[0]);
                                values.add(datapoint[1]);
                            }
                            var group_by = result.group_by;
                            var tags_element = lodash_1.default.filter(group_by, function (g) { return g.name === "tag"; })[0];
                            if (tags_element) {
                                var tag_list = tags_element.tags;
                                var tag_value_map = tags_element.group;
                                for (var _e = 0, tag_list_1 = tag_list; _e < tag_list_1.length; _e++) {
                                    var tag_key = tag_list_1[_e];
                                    tags[tag_key] = tag_value_map[tag_key];
                                }
                            }
                            var fields = [
                                {
                                    name: data_1.TIME_SERIES_TIME_FIELD_NAME,
                                    type: data_1.FieldType.time,
                                    config: {},
                                    values: times,
                                },
                                {
                                    name: data_1.TIME_SERIES_VALUE_FIELD_NAME,
                                    type: data_1.FieldType.number,
                                    config: {},
                                    values: values,
                                    labels: tags,
                                },
                            ];
                            var df = {
                                name: result.name,
                                fields: fields,
                                length: values.length,
                            };
                            dataFrames.push(df);
                        }
                    }
                    console.log("DataFrames:", dataFrames);
                    return { data: dataFrames };
                };
                return KairosDBResponseHandler;
            }());
            exports_1("KairosDBResponseHandler", KairosDBResponseHandler);
        }
    };
});
//# sourceMappingURL=response_handler.js.map