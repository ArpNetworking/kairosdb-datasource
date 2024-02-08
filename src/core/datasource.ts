import {DataSourceApi} from "@grafana/data";
import _ from "lodash";
import {UnitValue} from "../beans/aggregators/utils";
import {TemplatingFunction} from "../beans/function";
import {LegacyTargetConverter} from "../beans/request/legacy_target_converter";
import {KairosDBTarget, TimeRange} from "../beans/request/target";
import {TemplatingFunctionsCtrl} from "../controllers/templating_functions_ctrl";
import {PromiseUtils} from "../utils/promise_utils";
import {TemplatingFunctionResolver} from "../utils/templating_function_resolver";
import {TemplatingUtils} from "../utils/templating_utils";
import {TimeUnitUtils} from "../utils/time_unit_utils";
import {MetricNamesStore} from "./metric_names_store";
import {KairosDBQueryBuilder} from "./request/query_builder";
import {TargetValidator, ValidatorFailureResponse} from "./request/target_validator";
import {KairosDBResponseHandler} from "./response/response_handler";
import {SeriesNameBuilder} from "./response/series_name_builder";

export class KairosDBDatasource extends DataSourceApi<any, any, any> {
    public initialized: boolean = false;
    public initializationError: boolean = false;
    public metricNamesStore: MetricNamesStore;
    public enforceScalarSetting: boolean;
    private url: string;
    private withCredentials: boolean;
    private basicAuth: string;
    private responseHandler: KairosDBResponseHandler;
    private templatingFunctionsCtrl: TemplatingFunctionsCtrl;
    private promiseUtils: PromiseUtils;
    private targetValidator: TargetValidator;
    private backendSrv: any;
    private templateSrv: any;
    private legacyTargetConverter: LegacyTargetConverter;
    private templatingUtils: TemplatingUtils;
    private snapToIntervals?: UnitValue[];
    private autocompleteMaxMetrics: number;

    constructor(instanceSettings, $q, backendSrv, templateSrv) {
        super(instanceSettings);
        this.url = instanceSettings.url;
        this.withCredentials = instanceSettings.withCredentials;
        this.enforceScalarSetting = instanceSettings?.jsonData?.enforceScalarSetting ?? false;
        this.basicAuth = instanceSettings.basicAuth;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.responseHandler = new KairosDBResponseHandler(new SeriesNameBuilder());
        this.promiseUtils = new PromiseUtils($q);
        this.metricNamesStore = new MetricNamesStore(this, this.promiseUtils, this.url);
        this.templatingUtils = new TemplatingUtils(templateSrv, {});
        this.templatingFunctionsCtrl = new TemplatingFunctionsCtrl(new TemplatingFunctionResolver(this.templatingUtils));
        this.targetValidator = new TargetValidator(this.enforceScalarSetting);
        this.legacyTargetConverter = new LegacyTargetConverter();
        this.snapToIntervals = TimeUnitUtils.intervalsToUnitValues(instanceSettings?.jsonData?.snapToIntervals ?? "1m, 5m, 1h, 1d");
        this.autocompleteMaxMetrics = instanceSettings?.jsonData?.autocompleteMaxMetrics ?? 100;
        this.registerTemplatingFunctions();
    }

    public initialize(): Promise<boolean> {
        return this.metricNamesStore.initialize().then(
            () => this.initialized = true,
            () => this.initializationError = true
        ).then(() => this.initialized);
    }

    public testDatasource() {
        return this.executeRequest(this.getRequestBuilder().buildHealthStatusQuery())
            .then((response) => response.status);
    }

    public query(options) {
        const enabledTargets = _.cloneDeep(options.targets.filter((target) => !target.hide));
        const convertedTargets = _.map(enabledTargets, (target) => {
            if (this.legacyTargetConverter.isApplicable(target)) {
              return {query: this.legacyTargetConverter.convert(target)};
            } else if (!(target.query instanceof KairosDBTarget)) {
              return {query: KairosDBTarget.fromObject(target.query)};
            } else {
              return target;
            }
        });
        const panelTargetsFullyConfigured = this.targetValidator.areValidTargets(convertedTargets);
        if (!panelTargetsFullyConfigured.valid) {
          // in order for valid to be false, this must be a ValidatorFailureResponse
          // but type interence doesn't catch this so we must cast
          return Promise.reject({
            message: (panelTargetsFullyConfigured as ValidatorFailureResponse).reason
          });
        }

        const templatingUtils = new TemplatingUtils(this.templateSrv, options.scopedVars);
        const aliases = templatingUtils.replaceAll(convertedTargets.map((target) => target.query.alias));
        const unpackedTargets = _.flatten(convertedTargets.map((target) => {
            return templatingUtils.replace(target.query.metricName)
                .map((metricName) => {
                    const clonedTarget = _.cloneDeep(target);
                    clonedTarget.query.metricName = metricName;
                    return clonedTarget;
                });
        }));
        const requestBuilder = this.getRequestBuilder(options.scopedVars);
        let datapointsQuery = null;
        try {
            datapointsQuery = requestBuilder.buildDatapointsQuery(unpackedTargets, options);
        } catch (e) {
            return Promise.reject({message: e.message});
        }
        return this.executeRequest(datapointsQuery)
            .then((response) => this.responseHandler.convertToDatapoints(response.data, aliases, datapointsQuery.data));
    }

    public getMetricTags(metricNameTemplate, filters: any = {}, timeRange?: TimeRange) {
        const metricName = this.templatingUtils.replace(metricNameTemplate)[0];
        return this.executeRequest(this.getRequestBuilder().buildMetricTagsQuery(metricName, filters, timeRange))
            .then(this.handleMetricTagsResponse);
    }

    public metricFindQuery(query: string, options?: any) {
        const func = this.templatingFunctionsCtrl.resolve(query, options);
        return func().then((values) => values.map((value) => this.mapToTemplatingValue(value)));
    }

    public getMetricNames() {
        return this.executeRequest(this.getRequestBuilder().buildMetricNameQuery());
    }

    private getRequestBuilder(scopedVars: any = {}): KairosDBQueryBuilder {
        return new KairosDBQueryBuilder(this.withCredentials, this.url, "/api/v1", this.templateSrv, scopedVars, this.snapToIntervals);
    }

    private executeRequest(request) {
        return this.backendSrv.datasourceRequest(request);
    }

    private handleMetricTagsResponse(response): Map<string, Set<string>> {
        return response.data.queries[0].results[0].tags;
    }

    private registerTemplatingFunctions(): void {
        [
            new TemplatingFunction("metrics",
                (metricNamePart) => this.getMetricNamesContaining(metricNamePart)),
            new TemplatingFunction("tag_names", this.getMetricTagNames.bind(this)),
            new TemplatingFunction("tag_values", this.getMetricTagValues.bind(this))
        ].forEach((func) => this.templatingFunctionsCtrl.register(func));
    }

    private getMetricNamesContaining(metricNamePart) {
        return this.metricNamesStore.get()
            .then((metricNames) => _.filter(metricNames, (metricName) => _.includes(metricName, metricNamePart)));
    }

    private getMetricTagNames(metricName, timeRange?: TimeRange) {
        return this.getMetricTags(metricName, {}, timeRange)
            .then((tags) => _.keys(tags));
    }

    private getMetricTagValues(metricName: string, tagName: string, filters: any, timeRange?: TimeRange) {
        return this.getMetricTags(metricName, filters, timeRange)
            .then((tags) => {
                return _.values(tags[tagName]);
            });
    }

    private mapToTemplatingValue(entry) {
        return {
            text: entry,
            value: entry
        };
    }
}
