import { SeriesNameBuilder } from "./series_name_builder";
export declare class KairosDBResponseHandler {
    private seriesNameBuilder;
    constructor(seriesNameBuilder: SeriesNameBuilder);
    convertToDatapoints(data: any, aliases: string[]): {
        data: {
            datapoints: any[];
            target: string;
        }[];
    };
}
