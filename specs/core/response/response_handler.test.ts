import {expect, jest} from "@jest/globals";
import {KairosDBResponseHandler} from "../../../src/core/response/response_handler";
import {SeriesNameBuilder} from "../../../src/core/response/series_name_builder";

describe("KairosDBResponseHandler", () => {
    const seriesNameBuilder = new SeriesNameBuilder();
    const responseHandler: KairosDBResponseHandler = new KairosDBResponseHandler(seriesNameBuilder);

    it("should convert datapoints correctly with single result", () => {
        // given
        const data = {
            queries: [{
                results: [
                    {
                        group_by: [
                            {
                                group: {
                                    key: "GROUPby1",
                                    key2: "GROUPby2"
                                },
                                tags: [
                                    "GROUPby1",
                                    "GROUPby2"
                                ],
                                name: "tag"
                            },
                            {
                                group: {
                                    group_number: 123
                                },
                                name: "value"
                            },
                            {
                                group: {
                                    group_number: 456
                                },
                                group_count: 3,
                                name: "time"
                            }
                        ],
                        name: "name",
                        values: [[1, 1512405294], [234, 1512405294], [500, null]]
                    }
                ]
            }
            ]
        };
        const aliases = ["result1"];
        const expectedTimeValues = [1, 234, 500];
        const expectedDataValues = [1512405294, 1512405294, null];
        // when
        const datapoints = responseHandler.convertToDatapoints(data, aliases);
        // then
        expect(datapoints.data.length).toEqual(1);
        expect(datapoints.data[0].name).toEqual("result1");
        expect(datapoints.data[0].fields.length).toEqual(2);
        const timeField = datapoints.data[0].fields[0];
        expect(timeField.values).toEqual(expectedTimeValues);
        const valuesField = datapoints.data[0].fields[1];
        expect(valuesField.values).toEqual(expectedDataValues);

    });

    it("should convert datapoints correctly with multiple results", () => {
        // given
        const data = {
            queries: [{
                results: [
                    {
                        group_by: [
                            {
                                group: {
                                    key: "GROUPby1",
                                    key2: "GROUPby2"
                                },
                                tags: [
                                    "GROUPby1",
                                    "GROUPby2"
                                ],
                                name: "tag"
                            },
                            {
                                group: {
                                    group_number: 123
                                },
                                name: "value"
                            },
                            {
                                group: {
                                    group_number: 456
                                },
                                group_count: 3,
                                name: "time"
                            }
                        ],
                        name: "name",
                        values: [[1, 1512405294], [234, 1512405294]]
                    },
                    {
                        group_by: [
                            {
                                group: {
                                    key: "key",
                                    someOtherKey: "other_key"
                                },
                                tags: [
                                    "key",
                                    "someOtherKey"
                                ],
                                name: "tag"
                            },
                            {
                                group: {
                                    group_number: 77
                                },
                                group_count: 31,
                                name: "time"
                            }
                        ],
                        name: "name",
                        values: [[14, 1512413381], [2343, 1512427385]]
                    }
                ]
            }
            ]
        };
        const aliases = ["result1"];
        const expectedDatapoints1 = [[1512405294, 1], [1512405294, 234]];
        const expectedDatapoints2 = [[1512413381, 14], [1512427385, 2343]];
        const expectedTimeValues1 = [1, 234];
        const expectedDataValues1 = [1512405294, 1512405294];
        const expectedTimeValues2 = [14, 2343];
        const expectedDataValues2 = [1512413381, 1512427385];
        // when
        const datapoints = responseHandler.convertToDatapoints(data, aliases);
        // then

        expect(datapoints.data.length).toEqual(2);
        let frame = datapoints.data[0];
        expect(frame.name).toEqual("result1");
        expect(frame.fields.length).toEqual(2);
        let timeField = frame.fields[0];
        expect(timeField.values).toEqual(expectedTimeValues1);
        let valuesField = frame.fields[1];
        expect(valuesField.values).toEqual(expectedDataValues1);
        frame = datapoints.data[1];
        expect(frame.name).toEqual("result1");
        expect(frame.fields.length).toEqual(2);
        timeField = frame.fields[0];
        expect(timeField.values).toEqual(expectedTimeValues2);
        valuesField = frame.fields[1];
        expect(valuesField.values).toEqual(expectedDataValues2);
    });

    it("computes bin sizes properly", () => {
        const buffer = new ArrayBuffer(8);
        const dataview = new DataView(buffer);
        let result = responseHandler.computeBinMax(10, 7, dataview);
        expect(result).toBeCloseTo(10.0625, 7);
        result = responseHandler.computeBinMax(0, 4, dataview);
        expect(result).toBeCloseTo(0.0, );
    });
});
