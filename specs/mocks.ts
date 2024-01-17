import {ScopedVars, TimeRange, TypedVariableModel} from "@grafana/data";
import {TemplateSrv, VariableInterpolation} from "@grafana/runtime";
import _ from "lodash";
import {sinon} from "sinon";
import {SamplingConverter} from "../src/core/request/sampling_converter";
import {jest} from "@jest/globals";

interface Variables {
    [variableLabel: string]: string[];
}
type FormatterFn = (value: string | string[], variable: any, _unused?: any) => string;

export const buildTemplatingSrvMock = (variables: Variables): TemplateSrv => {
    return {
        replace: (expression?: string,
                  scopedVars?: ScopedVars,
                  format?: string | FormatterFn,
                  interpolations?: VariableInterpolation[]): string => {
            let replacedExpression = expression;
            _.forOwn(variables, (values, key) => {
                const templatedValue = formatterFromTemplateSrv(values, format, variables);
                replacedExpression = replacedExpression.replace("$" + key, templatedValue);
                replacedExpression = replacedExpression.replace("[[" + key + "]]", templatedValue);
            });
            return replacedExpression;
        },
        getVariables: (): TypedVariableModel[] => [],
        containsTemplate: (target?: string): boolean => false,
        updateTimeRange: (timeRange: TimeRange): void => null
    };
};

const formatterFromTemplateSrv = (
    value: string | string[],
    format: string | FormatterFn,
    variable?: Variables
): string => {
    /*
    Based heavily off the real deal.
    https://github.com/grafana/grafana/blob/master/public/app/features/templating/template_srv.ts#L128
     */

    // for some scopedVars there is no variable
    variable = variable || {};

    // Our TemplatingUtils falls into this case - we pass along a custom format fn.
    if (typeof format === "function") {
        return format(value, variable, undefined);
    }

    switch (format) {
        case "regex":
        case "lucene":
        case "pipe":
        case "distributed":
        case "csv":
        case "percentencode":
        case "html": {
            throw Error("Unsupported by this simplified version of the function");
        }
        case "json": {
            return JSON.stringify(value);
        }
        default: {
            /*
            If value is ["abc", "def"]
            return "{abc,def}"
             */
            if (Array.isArray(value) && value.length > 1) {
                return `{${value.join(",")}}`;
            }
            return String(value);
        }
    }
};

export const buildNoopTemplatingSrvMock = () => {
    return {
        replace: (expression) => expression
    };
};

export const buildSamplingConverterMock = (interval, unit, applicable) => {
    const converterMock = jest.fn() as unknown as SamplingConverter;
    converterMock.isApplicable = jest.fn().mockReturnValue(applicable) as any;
    converterMock.convert = jest.fn().mockReturnValue({interval, unit}) as any;
    return converterMock;
};
