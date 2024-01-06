System.register(["lodash", "grafana-data"], function (exports_1, context_1) {
    "use strict";
    var lodash_1, grafana_data_1, KairosDBResponseHandler;
    var __moduleName = context_1 && context_1.id;
    return {
        setters: [
            function (lodash_1_1) {
                lodash_1 = lodash_1_1;
            },
            function (grafana_data_1_1) {
                grafana_data_1 = grafana_data_1_1;
            }
        ],
        execute: function () {
            KairosDBResponseHandler = (function () {
                function KairosDBResponseHandler(seriesNameBuilder) {
                    this.seriesNameBuilder = seriesNameBuilder;
                }
                KairosDBResponseHandler.prototype.convertToDatapoints = function (data, aliases) {
                    var _this = this;
                    console.log("Data:", data);
                    var datapoints = lodash_1.default.zip(aliases, data.queries)
                        .map(function (pair) {
                        return { alias: pair[0], results: pair[1].results };
                    })
                        .map(function (entry) { return lodash_1.default.map(entry.results, function (result) {
                        return {
                            datapoints: lodash_1.default.flatMap(result.values, function (value) {
                                var v = value[1];
                                if (v !== null && typeof (v) === "object" && v.bins) {
                                    var bins_1 = v.bins;
                                    return lodash_1.default.map(Object.keys(bins_1), function (k) { return [parseFloat(k), value[0], bins_1[k]]; });
                                }
                                else {
                                    return [value.reverse()];
                                }
                            }),
                            target: _this.seriesNameBuilder.build(result.name, entry.alias, result.group_by)
                        };
                    }); });
                    var flattened = lodash_1.default.flatten(datapoints);
                    var queries = data.queries;
                    var dataFrames = [];
                    for (var _i = 0, queries_1 = queries; _i < queries_1.length; _i++) {
                        var query = queries_1[_i];
                        for (var _a = 0, _b = query.results; _a < _b.length; _a++) {
                            var result = _b[_a];
                            var times = [];
                            var values = [];
                            var tags = {};
                            for (var _c = 0, _d = result.values; _c < _d.length; _c++) {
                                var datapoint = _d[_c];
                                times.push(datapoint[0]);
                                values.push(datapoint[1]);
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
                                    name: grafana_data_1.TIME_SERIES_TIME_FIELD_NAME,
                                    type: grafana_data_1.FieldType.time,
                                    config: {},
                                    values: times,
                                },
                                {
                                    name: grafana_data_1.TIME_SERIES_VALUE_FIELD_NAME,
                                    type: grafana_data_1.FieldType.number,
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
                    return { data: dataFrames };
                };
                return KairosDBResponseHandler;
            }());
            exports_1("KairosDBResponseHandler", KairosDBResponseHandler);
        }
    };
});
//# sourceMappingURL=response_handler.js.map