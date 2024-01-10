import {
    ArrayVector,
    DataFrameType,
    FieldType,
    TIME_SERIES_TIME_FIELD_NAME,
    TIME_SERIES_VALUE_FIELD_NAME
} from "@grafana/data";
import _, {sortBy} from "lodash";
import {SeriesNameBuilder} from "./series_name_builder";

export class KairosDBResponseHandler {
    private seriesNameBuilder: SeriesNameBuilder;

    constructor(seriesNameBuilder: SeriesNameBuilder) {
        this.seriesNameBuilder = seriesNameBuilder;
    }

    public convertToDatapoints(data, aliases: string[]) {
        const MANTISSA_BITS = 52;

        const buffer = new ArrayBuffer(8);
        const dataview = new DataView(buffer);
        const queries = data.queries;
        const dataFrames = [];
        queries.forEach((query, index) => {
            const alias = aliases[index];
            for (const result of query.results) {
                const times = new ArrayVector();
                const values = new ArrayVector();
                const counts = new ArrayVector();
                const yMax = new ArrayVector();
                const tags = {};
                let histogram = false;
                if (result.values
                        && result.values[0]
                        && result.values[0][1]
                        && typeof(result.values[0][1]) === "object"
                        && result.values[0][1].bins) {
                    histogram = true;
                }
                if (!histogram) {
                    for (const datapoint of result.values) {
                        times.add(datapoint[0] as number);
                        values.add(datapoint[1]);
                    }
                } else {

                    for (const datapoint of result.values) {
                        const v = datapoint[1];
                        const bins = v.bins;
                        const precision = v.precision;
                        const shift = BigInt(MANTISSA_BITS - precision);

                        const keys = Object.keys(bins);

                        keys.sort((a, b) => parseFloat(a) - parseFloat(b));
                        keys.forEach((k) => {
                            const value = parseFloat(k);
                            times.add(datapoint[0] as number);
                            values.add(value);
                            counts.add(bins[k]);

                            dataview.setFloat64(0, value);
                            let upperBound = dataview.getBigInt64(0);
                            // tslint:disable-next-line:no-bitwise
                            upperBound >>= shift;
                            upperBound++;
                            // tslint:disable-next-line:no-bitwise
                            upperBound <<= shift;
                            upperBound--;
                            dataview.setBigInt64(0, upperBound);
                            upperBound = dataview.getFloat64(0);

                            yMax.add(upperBound);
                        });
                    }
                }
                const group_by = result.group_by;
                const tags_element: any = _.filter(group_by, (g) => g.name === "tag")[0];
                if (tags_element) {
                    const tag_list = tags_element.tags;
                    const tag_value_map = tags_element.group;
                    for (const tag_key of tag_list) {
                        tags[tag_key] = tag_value_map[tag_key];
                    }
                }
                const fields = [
                    {
                        name: TIME_SERIES_TIME_FIELD_NAME,
                        type: FieldType.time,
                        config: {},
                        values: times,
                    },
                    {
                        name: histogram ? "yMin" : TIME_SERIES_VALUE_FIELD_NAME,
                        type: FieldType.number,
                        config: {},
                        values,
                        labels: tags,
                    },
                ];
                if (histogram) {
                    fields.push(
                        {
                            name: "yMax",
                            type: FieldType.number,
                            config: {},
                            values: yMax,
                            labels: tags,
                        });
                    fields.push(
                        {
                            name: "Count",
                            type: FieldType.number,
                            config: {},
                            values: counts,
                            labels: tags,
                        });
                }
                const target = this.seriesNameBuilder.build(result.name, alias, result.group_by);
                const df = {
                    name: target,
                    fields,
                    length: values.length,
                    meta: { type: histogram ? DataFrameType.HeatmapCells : DataFrameType.TimeSeriesMulti}
                };
                dataFrames.push(df);
            }
        });
        //
        return {data: dataFrames};
        // return {data: flattened};
    }
}
