import {dateMath} from "@grafana/data";
import _ from "lodash";
import {Moment} from "moment";
import {Aggregator} from "../../beans/aggregators/aggregator";
import {UnitValue} from "../../beans/aggregators/utils";
import {DatapointsQuery} from "../../beans/request/datapoints_query";
import {MetricQuery} from "../../beans/request/metric_query";
import {KairosDBTarget, TimeRange} from "../../beans/request/target";
import {TemplatingUtils} from "../../utils/templating_utils";
import {GroupBysBuilder} from "./group_bys_builder";
import {ParameterObjectBuilder} from "./parameter_object_builder";
import {SamplingConverter} from "./sampling_converter";
import {SamplingParameterConverter} from "./sampling_parameter_converter";

export class KairosDBQueryBuilder {
    private withCredentials: boolean;
    private url: string;
    private apiPath: string;
    private scopedVars: any;
    private groupBysBuilder: GroupBysBuilder;
    private templatingUtils: TemplatingUtils;
    private samplingParameterConverter: SamplingParameterConverter;
    private snapToIntervals: UnitValue[];

    constructor(withCredentials: boolean, url: string, apiPath: string, templateSrv: any, scopedVars: any, snapToIntervals?: UnitValue[]) {
        this.withCredentials = withCredentials;
        this.url = url;
        this.apiPath = apiPath;
        this.scopedVars = scopedVars;
        this.templatingUtils = new TemplatingUtils(templateSrv, this.scopedVars);
        const samplingConverter = new SamplingConverter();
        this.groupBysBuilder = new GroupBysBuilder(this.templatingUtils, samplingConverter);
        this.samplingParameterConverter = new SamplingParameterConverter(this.templatingUtils, samplingConverter);
        this.snapToIntervals = snapToIntervals;
    }

    public buildHealthStatusQuery() {
        return this.buildRequest({
            method: "GET",
            url: "/health/status"
        });
    }

    public buildMetricNameQuery() {
        return this.buildRequest({
            method: "GET",
            url: "/metricnames"
        });
    }

    public buildMetricTagsQuery(metricName: string, filters = {}, timeRange?: TimeRange) {
        return this.buildRequest({
            data: this.buildTagsRequestBody(metricName, filters, timeRange),
            method: "POST",
            url: "/datapoints/query/tags"
        });
    }

    public buildDatapointsQuery(targets, options) {
        const range = options.range;
        const panelId: string = options.panelId;
        const defaultInterval: string = options.interval;
        const requests = targets.map((target) =>
            this.buildMetricQuery(
              target.query instanceof KairosDBTarget ? target.query : KairosDBTarget.fromObject(target.query),
              defaultInterval)
            ),
        data = new DatapointsQuery(range.from, range.to, requests);
        return this.buildRequest({
            data,
            method: "POST",
            url: "/datapoints/query"
        });
    }

    private buildMetricQuery(target: KairosDBTarget, defaultInterval: string) {
        return new MetricQuery(
            target.metricName,
            this.unpackTags(_.pickBy(target.tags, (tagValues) => tagValues.length)),
            target.aggregators.map((aggregator) => this.convertAggregatorToQueryObject(aggregator, defaultInterval)),
            this.groupBysBuilder.build(target.groupBy),
            target.startTime(),
            target.endTime()
        );
    }

    private unpackTags(tags) {
        return _.mapValues.bind(this)(tags, (values) => _.flatten(this.templatingUtils.replaceAll(values)));
    }

    private convertAggregatorToQueryObject(aggregatorDefinition: Aggregator, defaultInterval: string) {
        const convertedAggregator =
            this.samplingParameterConverter.convertSamplingParameters(_.cloneDeep(aggregatorDefinition));
        return _.extend({name: convertedAggregator.name},
            this.convertParameters(convertedAggregator, defaultInterval));
    }

    private convertParameters(aggregatorDefinition: Aggregator, defaultInterval: string) {
        const parameterObjectBuilder =
            new ParameterObjectBuilder(this.templatingUtils, defaultInterval, aggregatorDefinition.autoValueSwitch, this.snapToIntervals);
        return aggregatorDefinition.parameters.map((parameter) => parameterObjectBuilder.build(parameter))
            .reduce((param1, param2) => _.merge(param1, param2), {});
    }

    private buildRequest(requestStub) {
        requestStub.url = this.buildUrl(requestStub.url);
        return _.extend(requestStub, {
            withCredentials: this.withCredentials,
        });
    }

    private buildRequestId(actionName, panelId): string {
        return actionName + "_" + panelId;
    }

    private buildUrl(urlStub) {
        return this.url + this.apiPath + urlStub;
    }

    private buildTagsRequestBody(metricName, filters = {}, timeRange?: TimeRange) {
        const body: any = {
            cache_time: 0,
            metrics: [{name: metricName, tags: filters}],
        };
        if (timeRange) {
            if (timeRange.from) {
                const startMoment: Moment = dateMath.parse(timeRange.from);
                if (startMoment) {
                    body.start_absolute = startMoment.unix() * 1000;
                }
            }
            if (timeRange.to) {
                const endMoment: Moment = dateMath.parse(timeRange.to);
                if (endMoment) {
                    body.end_absolute = endMoment.unix() * 1000;
                }
            }
        }
        if (!(body.start_absolute || body.start_relative)) {
            body.start_relative = { value: "1", unit: "minutes" };
        }
        return body;
    }
}
