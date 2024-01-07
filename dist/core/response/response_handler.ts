import {ArrayVector, FieldType, TIME_SERIES_TIME_FIELD_NAME, TIME_SERIES_VALUE_FIELD_NAME} from "@grafana/data";
import _ from "lodash";
import {SeriesNameBuilder} from "./series_name_builder";

export class KairosDBResponseHandler {
    private seriesNameBuilder: SeriesNameBuilder;

    constructor(seriesNameBuilder: SeriesNameBuilder) {
        this.seriesNameBuilder = seriesNameBuilder;
    }

    public convertToDatapoints(data, aliases: string[]) {
        // console.log("Data:", data);
        // const datapoints = _.zip(aliases, data.queries)
        //     .map((pair) => {
        //         return {alias: pair[0], results: pair[1].results};
        //     })
        //     .map((entry) => _.map(entry.results, (result) => {
        //         return {
        //             datapoints: _.flatMap(result.values, (value) => {
        //               const v = value[1];
        //               if (v !== null && typeof(v) === "object" && v.bins) {
        //                 const bins = v.bins;
        //                 return _.map(Object.keys(bins), (k) => [parseFloat(k), value[0], bins[k]]);
        //               } else {
        //                 return [value.reverse()];
        //               }
        //             }),
        //             target: this.seriesNameBuilder.build(result.name, entry.alias, result.group_by)
        //         };
        //     }));
        // const flattened = _.flatten(datapoints);
        //
        //
        //
        //
        // if (timeSeries.title) {
        //     (fields[1].config as FieldConfig).displayNameFromDS = timeSeries.title;
        // }
        //
        //
        //
        //
        //
        // console.log("Flattened:", flattened);
        const queries = data.queries;
        const dataFrames = [];
        for (const query of queries) {
            for (const result of query.results) {
                const times = new ArrayVector();
                const values = new ArrayVector();
                const tags = {};
                for (const datapoint of result.values) {
                    times.add(datapoint[0] as number);
                    values.add(datapoint[1]);
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
                        name: TIME_SERIES_VALUE_FIELD_NAME,
                        type: FieldType.number,
                        config: {},
                        values: values,
                        labels: tags,
                    },
                ];
                const df = {
                    name: result.name,
                    // refId: timeSeries.refId,
                    // meta: timeSeries.meta,
                    fields,
                    length: values.length,
                };
                dataFrames.push(df);
            }
        }
        //
        console.log("DataFrames:", dataFrames);
        return {data: dataFrames};
        // return {data: flattened};
    }
}
