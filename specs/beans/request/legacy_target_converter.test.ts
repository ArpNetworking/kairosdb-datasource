/**
 * @jest-environment jsdom
 */
import {expect} from "@jest/globals";
import {LegacyTargetConverter} from "../../../src/beans/request/legacy_target_converter";
import {GroupByTimeEntry} from "../../../src/directives/group_by/group_by_time_entry";

function sortNestedJSON(object) {
    return JSON.parse(JSON.stringify(object));
}

describe("LegacyTargetConverter", () => {
    const legacyTargetConverter = new LegacyTargetConverter();
    const legacy_simple = {
        alias: "cnm_cnm_health.mapping_prod.net",
        aliasMode: "default",
        downsampling: "avg",
        errors: {},
        groupBy: {
            timeInterval: "1s"
        },
        horAggregator: {
            factor: "1",
            percentile: "0.75",
            samplingRate: "1s",
            trim: "both",
            unit: "millisecond"
        },
        metric: "cnm_cnm_health.mapping_prod.net",
        refId: "A"
    };
    const modern_simple = {
        hide: false,
        query: {
            aggregators: [],
            groupBy: {
                tags: [],
                time: [],
                value: []
            },
            metricName: "cnm_cnm_health.mapping_prod.net",
            tags: []
        },
        refId: "A"
    };
    const legacy_complex = {
        addFilterTagMode: false,
        addGroupByMode: false,
        addHorizontalAggregatorMode: false,
        alias: "query_12345_abcd ( rowname=$_tag_group_rowname, value_group_1=$_value_group_1, time_group_1=$_time_group_1 )",
        aliasMode: "custom",
        currentGroupByType: "time",
        currentHorizontalAggregatorName: "avg",
        currentTagKey: "",
        currentTagValue: "",
        downsampling: "avg",
        errors: {},
        groupBy: {
            groupCount: "100",
            tagKey: "",
            timeInterval: "1s",
            valueRange: "20"
        },
        groupByTags: [
            "rowname"
        ],
        hasFactor: false,
        hasNothing: false,
        hasPercentile: false,
        hasSamplingRate: false,
        hasTrim: false,
        hasUnit: false,
        hide: false,
        horAggregator: {
            factor: "1",
            percentile: "0.75",
            samplingRate: "1s",
            trim: "both",
            unit: "millisecond"
        },
        horizontalAggregators: [
            {
                name: "avg",
                sampling_rate: "1h"
            }
        ],
        isAggregatorValid: true,
        isGroupByValid: true,
        isTagGroupBy: false,
        isTimeGroupBy: false,
        isValueGroupBy: false,
        metric: "query_12346_child_count.github.net",
        nonTagGroupBys: [
            {
                name: "value",
                range_size: "20"
            },
            {
                group_count: "100",
                name: "time",
                range_size: "10m"
            }
        ],
        refId: "A",
        tags: {
            rowname: [
                "72.246.50.13"
            ]
        }
    };
    const modern_complex = {
        query: {
            aggregators: [
                {
                    autoValueSwitch: {
                        dependentParameters: [
                            {
                                name: "value",
                                text: "every",
                                type: "sampling",
                                value: "1"
                            },
                            {
                                allowedValues: {
                                    0: "MILLISECONDS",
                                    1: "SECONDS",
                                    2: "MINUTES",
                                    3: "HOURS",
                                    4: "DAYS",
                                    5: "WEEKS",
                                    6: "MONTHS",
                                    7: "YEARS"
                                },
                                name: "unit",
                                text: "unit",
                                type: "sampling_unit",
                                value: "HOURS"
                            }
                        ],
                        enabled: false
                    },
                    name: "avg",
                    parameters: [
                        {
                            allowedValues: {
                                0: "NONE",
                                1: "START_TIME",
                                2: "SAMPLING",
                                3: "PERIOD"
                            },
                            name: "sampling",
                            text: "align by",
                            type: "alignment",
                            value: "PERIOD"
                        },
                        {
                            name: "value",
                            text: "every",
                            type: "sampling",
                            value: "1"
                        },
                        {
                            allowedValues: {
                                0: "MILLISECONDS",
                                1: "SECONDS",
                                2: "MINUTES",
                                3: "HOURS",
                                4: "DAYS",
                                5: "WEEKS",
                                6: "MONTHS",
                                7: "YEARS"
                            },
                            name: "unit",
                            text: "unit",
                            type: "sampling_unit",
                            value: "HOURS"
                        }
                    ]
                }
            ],
            alias: "query_12345_abcd ( rowname=$_tag_group_rowname, value_group_1=$_value_group_1, time_group_1=$_time_group_1 )",
            groupBy: {
                tags: [
                    "rowname"
                ],
                value: [
                    "20"
                ],
                time: [
                    new GroupByTimeEntry( "10", "MINUTES", 100)
                ]
            },
            metricName: "query_12346_child_count.github.net",
            tags: {
                rowname: [
                    "72.246.50.13"
                ],
            }
        },
        refId: "A"
    };
    describe("isApplicable", () => {
        it("should return true for legacy structure", () => {
            // tslint:disable-next-line
            expect(legacyTargetConverter.isApplicable(legacy_simple)).toBe(true);
        });
        it("should return false for new structure", () => {
            // tslint:disable-next-line
            expect(legacyTargetConverter.isApplicable(modern_simple)).toBe(false);
        });
    });
    describe("convert base case", () => {
        it("should", () => {
            // tslint:disable-next-line
            expect(legacyTargetConverter.convert(legacy_simple).metricName).toBe(modern_simple.query.metricName);
        });
    });
    describe("convert metric name in complex case", () => {
        it("should", () => {
            // tslint:disable-next-line
            expect(legacyTargetConverter.convert(legacy_complex).metricName).toBe(modern_complex.query.metricName);
        });
    });
    describe("alias", () => {
        it("convert alias properly", () => {
            // tslint:disable-next-line
            expect(legacyTargetConverter.convert(legacy_complex).alias).toBe(modern_complex.query.alias);
        });
    });
    describe("alias", () => {
        it("convert tags properly", () => {
            // tslint:disable-next-line
            expect(legacyTargetConverter.convert(legacy_complex).tags).toEqual(modern_complex.query.tags);
        });
    });
    describe("alias", () => {
        it("convert groupBy properly", () => {
            const legacyGroupBy = legacyTargetConverter.convert(legacy_complex).groupBy;
            // For some reason deep.equals returns a false negative even though the contents match
            // tslint:disable-next-line
            expect(legacyGroupBy.time).toEqual(modern_complex.query.groupBy.time);
            // tslint:disable-next-line
            expect(legacyGroupBy.tags).toEqual(modern_complex.query.groupBy.tags);
            // tslint:disable-next-line
            expect(legacyGroupBy.value).toEqual(modern_complex.query.groupBy.value);
        });
    });
    describe("alias", () => {
        it("convert aggregators properly", () => {
            const converted = legacyTargetConverter.convert(legacy_complex).aggregators;
            const modern = modern_complex.query.aggregators;
            expect(sortNestedJSON(converted)).toEqual(sortNestedJSON(modern));
        });
    });
});
