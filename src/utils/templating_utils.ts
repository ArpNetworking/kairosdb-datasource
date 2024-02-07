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
        this.templateSrv.replace(expression, this.scopedVars, null, interpolations);
        return this.recurseReplace(expression, interpolations);
    }

    public replaceAll(expressions: string[]): string[] {
        return _.flatten(expressions.map((expression) => this.replace(expression)));
    }

    private recurseReplace(expression: string, interpolations: VariableInterpolation[]): string[] {
        if (interpolations.length === 0) {
            return [expression];
        }
        const partialExpressions = [];
        const interpolation = interpolations.pop();
        if (interpolation.found && interpolation.value !== undefined) {
            for (const value of _.flatten(interpolation.value)) {
                const replacedExpression = expression.replace(interpolation.match, value);
                partialExpressions.push(this.recurseReplace(replacedExpression, Array.from(interpolations)));
            }
        } else {
            partialExpressions.push(this.recurseReplace(expression, Array.from(interpolations)));
        }
        return _.flatten(partialExpressions);

    }
}
