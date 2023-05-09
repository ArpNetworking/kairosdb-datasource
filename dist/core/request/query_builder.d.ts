import { UnitValue } from "../../beans/aggregators/utils";
import { TimeRange } from "../../beans/request/target";
export declare class KairosDBQueryBuilder {
    private withCredentials;
    private url;
    private apiPath;
    private scopedVars;
    private groupBysBuilder;
    private templatingUtils;
    private samplingParameterConverter;
    private snapToIntervals;
    constructor(withCredentials: boolean, url: string, apiPath: string, templateSrv: any, scopedVars: any, snapToIntervals?: UnitValue[]);
    buildHealthStatusQuery(): any;
    buildMetricNameQuery(): any;
    buildMetricTagsQuery(metricName: string, filters?: {}, timeRange?: TimeRange): any;
    buildDatapointsQuery(targets: any, options: any): any;
    private buildMetricQuery;
    private unpackTags;
    private convertAggregatorToQueryObject;
    private convertParameters;
    private buildRequest;
    private buildRequestId;
    private buildUrl;
    private buildTagsRequestBody;
}
