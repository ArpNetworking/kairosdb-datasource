import {ScopedVars} from "@grafana/data";
import {TemplateSrv, VariableInterpolation} from "@grafana/runtime";
import _ from "lodash";

export class TemplatingUtils {
    private templateSrv: TemplateSrv;
    private scopedVars: ScopedVars;

    constructor(templateSrv: TemplateSrv, scopedVars: ScopedVars) {
        this.templateSrv = templateSrv;
        this.scopedVars = scopedVars;
    }

    public replace(expression: string): string[] {
        const interpolations = [];
        this.templateSrv.replace(expression, this.scopedVars, this.formatter, interpolations);
        return this.recurseReplace(expression, Array.from(interpolations), {});
    }

    public replaceAll(expressions: string[]): string[] {
        return _.flatten(expressions.map((expression) => this.replace(expression)));
    }

    private formatter(value, _variable, _formatter): string[] {
        return value;
    }

    private recurseReplace(expression: string, interpolations: VariableInterpolation[], bound: any): string[] {
        if (interpolations.length === 0) {
            return [expression];
        }
        const partialExpressions = [];
        const interpolation = interpolations.pop();
        if (interpolation.found && interpolation.value !== undefined) {
            if (bound[interpolation.variableName] === undefined) {
                for (const value of _.flatten(interpolation.value)) {
                    bound[interpolation.variableName] = value;
                    const replacedExpression = expression.replace(interpolation.match, value);
                    partialExpressions.push(this.recurseReplace(replacedExpression, Array.from(interpolations), bound));
                }
                delete bound[interpolation.variableName];
            } else {
                const replacedExpression = expression.replace(interpolation.match, bound[interpolation.variableName]);
                partialExpressions.push(this.recurseReplace(replacedExpression, Array.from(interpolations), bound));
            }
        } else {
            partialExpressions.push(this.recurseReplace(expression, Array.from(interpolations), bound));
        }
        return _.flatten(partialExpressions);

    }
}
