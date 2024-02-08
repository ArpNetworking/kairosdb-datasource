import {
    DataFrameDTO,
    DataFrameType,
    FieldDTO,
    FieldType,
    TIME_SERIES_TIME_FIELD_NAME
} from "@grafana/data";
import { config } from "@grafana/runtime";
import _ from "lodash";
import {DatapointsQuery} from "../../beans/request/datapoints_query";
import {TimeUnitUtils} from "../../utils/time_unit_utils";
import {SeriesNameBuilder} from "./series_name_builder";

export class KairosDBResponseHandler {
    private seriesNameBuilder: SeriesNameBuilder;

    constructor(seriesNameBuilder: SeriesNameBuilder) {
        this.seriesNameBuilder = seriesNameBuilder;
    }

    public convertToDatapoints(data, aliases: string[], originalQuery: DatapointsQuery) {

        const buffer = new ArrayBuffer(8);
        const dataview = new DataView(buffer);
        const queries = data.queries;
        const dataFrames: DataFrameDTO[] = [];
        queries.forEach((query, index) => {
            const alias = aliases[index];
            const origQuery = originalQuery.metrics[index];
            for (const result of query.results) {
                const target = this.seriesNameBuilder.build(result.name, alias, result.group_by);
                const times = [];
                const values = [];
                const counts = [];
                const yMax = [];
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
                        times.push(datapoint[0] as number);
                        values.push(datapoint[1]);
                    }
                } else {

                    for (const datapoint of result.values) {
                        const v = datapoint[1];
                        const bins = v.bins;
                        const keys = Object.keys(bins);

                        keys.sort((a, b) => parseFloat(a) - parseFloat(b));
                        keys.forEach((k) => {
                            const value = parseFloat(k);
                            times.push(datapoint[0] as number);

                            counts.push(bins[k]);

                            yMax.push(this.computeBinMax(value, v.precision, dataview));
                            // if (value === 0) {
                            //     value = 0.1;
                            // }
                            values.push(value);
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
                const fields: FieldDTO[] = [];
                if (config.featureToggles.newVizTooltips && histogram) {
                        const xMax = [];
                        let diff = 0;
                        for (const agg of origQuery.aggregators) {
                            if (agg?.sampling?.value) {
                                const unit = TimeUnitUtils.getTimeUnit(agg?.sampling?.unit);
                                const value = agg?.sampling?.value;
                                const samplingMs = TimeUnitUtils.timeUnitToMillis(unit) * value;
                                diff = Math.max(diff, samplingMs);
                            }
                        }
                        if (diff === 0 && result.values.length > 1) {
                            diff = result.values[1][0] - result.values[0][0];
                        }

                        if (diff === 0) {
                            // final default is 1 minute
                            diff = 60000;
                        }
                        for (const t of times) {
                            xMax.push(t + diff);
                        }

                        fields.push(
                            {
                                name: "xMax",
                                type: FieldType.time,
                                config: {
                                    interval: diff,
                                },
                                values: xMax,

                            }
                        );
                } else {
                    fields.push(
                        {
                            name: histogram ? "x" : TIME_SERIES_TIME_FIELD_NAME,
                            type: FieldType.time,
                            config: {},
                            values: times,
                        }
                    );
                }
                fields.push(
                    {
                        name: histogram ? "yMin" : target,
                        type: FieldType.number,
                        config: {},
                        values,
                        labels: tags,
                    }
                );
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
                            name: "count",
                            type: FieldType.number,
                            config: {},
                            values: counts,
                            labels: tags,
                        });
                }
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

    public computeBinMax(binMin: number, precision: number, dataView: DataView): number {
        if (binMin === 0) {
             return 0.00000001;
        }
        const MANTISSA_BITS = 52;
        const shift = BigInt(MANTISSA_BITS - precision);
        dataView.setFloat64(0, binMin);
        let upperBoundBig = dataView.getBigInt64(0);
        // tslint:disable-next-line:no-bitwise
        upperBoundBig >>= shift;
        upperBoundBig++;
        // tslint:disable-next-line:no-bitwise
        upperBoundBig <<= shift;
        upperBoundBig--;
        dataView.setBigInt64(0, upperBoundBig);
        return dataView.getFloat64(0);
    }
}
