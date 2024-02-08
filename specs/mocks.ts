import {TemplateSrv} from "@grafana/runtime";
import {jest} from "@jest/globals";
import {SamplingConverter} from "../src/core/request/sampling_converter";
import {TemplateSrv as TemplateSrvMock} from "./utils/templatesrvmock";

interface Variables {
    [variableLabel: string]: string[];
}
type FormatterFn = (value: string | string[], variable: any, _unused?: any) => string;

export const buildTemplatingSrvMock = (variables: Variables): TemplateSrv => {
    const deps = {
        getFilteredVariables: (filter) => deps.getVariables(),
        getVariables: () => { variables.map((v) => {
            return {
                name: v,
                current: {
                    value: variables[v][0]
                }
            };
        }); },
        getVariableWithName: (name) => {
            return {
                current: {
                    value: variables[name]
                }
            };
        },
    };
    return new  TemplateSrvMock(deps);
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
