import _ from 'lodash';
import { TemplatingFunction } from '../beans/function';
import { TemplatingFunctionResolver } from '../utils/templating_function_resolver';

export class TemplatingFunctionsCtrl {
  private functions: TemplatingFunction[] = [];
  private templatingFunctionResolver: TemplatingFunctionResolver;

  constructor(templatingFunctionResolver: TemplatingFunctionResolver) {
    this.templatingFunctionResolver = templatingFunctionResolver;
  }

  register(func: TemplatingFunction) {
    this.functions.push(func);
  }

  resolve(functionBody: string): () => Promise<string[]> {
    const matchedFunction = _.find(this.functions, (func) => new RegExp(func.regexp).test(functionBody));
    // @ts-ignore
    return this.templatingFunctionResolver.unpackFunction(matchedFunction, functionBody);
  }
}
