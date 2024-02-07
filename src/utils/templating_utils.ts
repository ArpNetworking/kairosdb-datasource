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
        const scopedVars = this.scopedVars;
        const interpolations = [];
        const replacedExpression = this.templateSrv.replace(expression, this.scopedVars, null, interpolations);
        // tslint:disable-next-line:no-console
        console.log("calling replace on ", expression, "scopedVars", scopedVars);
        // tslint:disable-next-line:no-console
        console.log("interpolations", interpolations);
        // Looks like "thing0" if single value, or "{thing1_MAGIC_DELIM_thing2}" if multivalue
        const replaced = this.recurseReplace(expression, interpolations);
        // tslint:disable-next-line:no-console
        console.log("result: ", replaced);
        return replaced;
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
        for (const value of _.flatten(interpolation.value)) {
            const replacedExpression = expression.replace(interpolation.match, value);
            partialExpressions.push(this.recurseReplace(replacedExpression, interpolations));
        }
        return _.flatten(partialExpressions);

    }
}
