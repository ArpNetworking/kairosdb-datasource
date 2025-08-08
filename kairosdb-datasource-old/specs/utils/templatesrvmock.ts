import {
    AdHocVariableModel,
    ScopedVar,
    ScopedVars,
    TimeRange,
    TypedVariableModel,
    VariableModel
} from "@grafana/data";
import { VariableFormatID } from "@grafana/schema";

import {TemplateSrv as BaseTemplateSrv, VariableInterpolation} from "@grafana/runtime";
import {property} from "lodash";

const variableRegex = /\$(\w+)|\[\[(\w+?)(?::(\w+))?\]\]|\${(\w+)(?:\.([^:^\}]+))?(?::([^\}]+))?}/g;

class LegacyVariableWrapper {
    public state: { name: string; value: any; text: any; type: any };

    constructor(variable: VariableModel, value: any, text: any) {
        this.state = { name: variable.name, value, text, type: variable.type };
    }

    public getValue(_fieldPath: string): any {
        const { value } = this.state;

        if (value === "string" || value === "number" || value === "boolean") {
            return value;
        }

        return String(value);
    }

    public getValueText(): string {
        const { value, text } = this.state;

        if (typeof text === "string") {
            return value === ALL_VARIABLE_VALUE ? ALL_VARIABLE_TEXT : text;
        }

        if (Array.isArray(text)) {
            return text.join(" + ");
        }

        // tslint:disable-next-line:no-console
        console.log("value", text);
        return String(text);
    }
}

let legacyVariableWrapper: LegacyVariableWrapper | undefined;

/**
 * Reuses a single instance to avoid unnecessary memory allocations
 */
function getVariableWrapper(variable: VariableModel, value: any, text: string) {
    // TODO: provide more legacy variable properties, i.e. multi, includeAll that are used in custom interpolators,
    // see Prometheus data source for example
    if (!legacyVariableWrapper) {
        legacyVariableWrapper = new LegacyVariableWrapper(variable, value, text);
    } else {
        legacyVariableWrapper.state.name = variable.name;
        legacyVariableWrapper.state.type = variable.type;
        legacyVariableWrapper.state.value = value;
        legacyVariableWrapper.state.text = text;
    }

    return legacyVariableWrapper;
}

const formatVariableValue = (value: any, format?: any, variable?: any, text?: string): string => {
    return value;
};

type ReplaceFunction = (fullMatch: string, variableName: string, fieldPath: string, format: string) => string;
/**
 * Mock for TemplateSrv where you can just supply map of key and values and it will do the interpolation based on that.
 * For simple tests whether you your data source for example calls correct replacing code.
 *
 * This is implementing TemplateSrv interface but that is not enough in most cases. Datasources require some additional
 * methods and usually require TemplateSrv class directly instead of just the interface which probably should be fixed
 * later on.
 */

/**
 * Internal regex replace function
 */
const ALL_VARIABLE_TEXT = "All";
const ALL_VARIABLE_VALUE = "$__all";
const isAdHoc = (model: VariableModel): model is AdHocVariableModel => {
    return model.type === "adhoc";
};

export interface TemplateSrvDependencies {
    getFilteredVariables: (filter: (model: TypedVariableModel) => boolean) => any[];
    getVariables: () => any[];
    getVariableWithName: (name: string) => TypedVariableModel | undefined;
}

export class TemplateSrv implements BaseTemplateSrv {

    /**
     * @deprecated: this instance variable should not be used and will be removed in future releases
     *
     * Use getVariables function instead
     */
    get variables(): TypedVariableModel[] {
        return this.getVariables();
    }
    private _variables: any[];
    private regex = variableRegex;
    private index: any = {};
    private grafanaVariables = new Map<string, any>();
    private timeRange?: TimeRange | null = null;
    private _adhocFiltersDeprecationWarningLogged = new Map<string, boolean>();

    public constructor(private dependencies: TemplateSrvDependencies) {
        this._variables = [];
    }

    public init(variables: any, timeRange?: TimeRange) {
        this._variables = variables;
        this.timeRange = timeRange;
        this.updateIndex();
    }

    public getVariables(): TypedVariableModel[] {
        // For scenes we have this backward compatiblity translation

        return this.dependencies.getVariables();
    }

    public updateIndex() {
        const existsOrEmpty = (value: unknown) => value || value === "";

        this.index = this._variables.reduce((acc, currentValue) => {
            if (currentValue.current && (currentValue.current.isNone || existsOrEmpty(currentValue.current.value))) {
                acc[currentValue.name] = currentValue;
            }
            return acc;
        }, {});

        if (this.timeRange) {
            const from = this.timeRange.from.valueOf().toString();
            const to = this.timeRange.to.valueOf().toString();

            this.index = {
                ...this.index,
                ["__from"]: {
                    current: { value: from, text: from },
                },
                ["__to"]: {
                    current: { value: to, text: to },
                },
            };
        }
    }

    public updateTimeRange(timeRange: TimeRange) {
        this.timeRange = timeRange;
        this.updateIndex();
    }

    public variableInitialized(variable: any) {
        this.index[variable.name] = variable;
    }

    public setGrafanaVariable(name: string, value: any) {
        this.grafanaVariables.set(name, value);
    }

    public getVariableName(expression: string) {
        this.regex.lastIndex = 0;
        const match = this.regex.exec(expression);
        if (!match) {
            return null;
        }
        // tslint:disable-next-line:no-shadowed-variable
        const variableName = match.slice(1).find((match) => match !== undefined);
        return variableName;
    }

    public containsTemplate(target: string | undefined): boolean {
        if (!target) {
            return false;
        }
        const name = this.getVariableName(target);
        const variable = name && this.getVariableAtIndex(name);
        return variable !== null && variable !== undefined;
    }

    public variableExists(expression: string): boolean {
        return this.containsTemplate(expression);
    }

    public getAllValue(variable: any) {
        if (variable.allValue) {
            return variable.allValue;
        }
        const values = [];
        for (let i = 1; i < variable.options.length; i++) {
            values.push(variable.options[i].value);
        }
        return values;
    }

    public replace(
        target?: string,
        scopedVars?: ScopedVars,
        // tslint:disable-next-line:ban-types
        format?: string | Function | undefined,
        interpolations?: VariableInterpolation[]
    ): string {
        if (!target) {
            return target ?? "";
        }

        this.regex.lastIndex = 0;

        return this._replaceWithVariableRegex(target, format, (match, variableName, fieldPath, fmt) => {
            const value = this._evaluateVariableExpression(match, variableName, fieldPath, fmt, scopedVars);

            // If we get passed this interpolations map we will also record all the expressions that were replaced
            if (interpolations) {
                interpolations.push({ match, variableName, fieldPath, format: fmt, value, found: value !== match });
            }

            return value;
        });
    }

    public getFieldAccessor(fieldPath: string) {
        return property(fieldPath);
    }

    public isAllValue(value: unknown) {
        return value === ALL_VARIABLE_VALUE || (Array.isArray(value) && value[0] === ALL_VARIABLE_VALUE);
    }

    private getVariableValue(scopedVar: ScopedVar, fieldPath: string | undefined) {
        if (fieldPath) {
            return this.getFieldAccessor(fieldPath)(scopedVar.value);
        }

        return scopedVar.value;
    }

    private getVariableText(scopedVar: ScopedVar, value: any) {
        if (scopedVar.value === value || typeof value !== "string") {
            return scopedVar.text;
        }

        return value;
    }

    private _evaluateVariableExpression(
        match: string,
        variableName: string,
        fieldPath: string,
        // tslint:disable-next-line:ban-types
        format: string | Function | undefined,
        scopedVars: ScopedVars | undefined
    ) {
        const variable = this.getVariableAtIndex(variableName);
        const scopedVar = scopedVars?.[variableName];

        if (scopedVar) {
            // tslint:disable-next-line:no-shadowed-variable
            const value = this.getVariableValue(scopedVar, fieldPath);
            // tslint:disable-next-line:no-shadowed-variable
            const text = this.getVariableText(scopedVar, value);

            if (value !== null && value !== undefined) {
                return formatVariableValue(value, format, variable, text);
            }
        }

        const systemValue = this.grafanaVariables.get(variable.current.value);
        if (systemValue) {
            return formatVariableValue(systemValue, format, variable);
        }

        let value = variable.current.value;
        let text = variable.current.text;

        if (this.isAllValue(value)) {
            value = this.getAllValue(variable);
            text = ALL_VARIABLE_TEXT;
            // skip formatting of custom all values unless format set to text or percentencode
            if (variable.allValue && format !== VariableFormatID.Text && format !== VariableFormatID.PercentEncode) {
                return this.replace(value);
            }
        }

        if (fieldPath) {
            const fieldValue = this.getVariableValue({ value, text }, fieldPath);
            if (fieldValue !== null && fieldValue !== undefined) {
                return formatVariableValue(fieldValue, format, variable, text);
            }
        }

        return formatVariableValue(value, format, variable, text);
    }

    /**
     * Tries to unify the different variable format capture groups into a simpler replacer function
     */
    // tslint:disable-next-line:ban-types
    private _replaceWithVariableRegex(text: string, format: string | Function | undefined, replace: ReplaceFunction) {
        this.regex.lastIndex = 0;

        return text.replace(this.regex, (match, var1, var2, fmt2, var3, fieldPath, fmt3) => {
            const variableName = var1 || var2 || var3;
            const fmt = fmt2 || fmt3 || format;
            return replace(match, variableName, fieldPath, fmt);
        });
    }

    private getVariableAtIndex(name: string) {
        if (!name) {
            return;
        }

        if (!this.index[name]) {
            return this.dependencies.getVariableWithName(name);
        }

        return this.index[name];
    }

    private getAdHocVariables(): AdHocVariableModel[] {
        return this.dependencies.getFilteredVariables(isAdHoc) as AdHocVariableModel[];
    }
}
