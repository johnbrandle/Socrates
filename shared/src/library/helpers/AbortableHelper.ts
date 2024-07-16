/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IAbortable } from '../abort/IAbortable.ts';
import { IAborted } from '../abort/IAborted.ts';
import { IError } from '../error/IError.ts';
import { IFailure } from '../fail/IFailure.ts';
import { IBaseApp } from '../IBaseApp.ts';

/**
 * A utility class for handling results that might be abortable or contain errors.
 * It provides methods to add abortable operations and to extract values from operations,
 * throwing an exception if the operation resulted in an error or was aborted.
 */
export class AbortableHelper<A extends IBaseApp<A>>
{
    #_app:A;

    /**
     * Stores a collection of IAbortable items.
     * @private
     */
    #_abortables:IAbortable[] = [];
    
    /**
     * Constructs a new instance of ResultHelper, optionally initializing it with a list of IAbortable items.
     * @param {IAbortable[]} abortables - An optional array of IAbortable items to initialize the ResultHelper.
     */
    constructor(app:A, ...abortables:IAbortable[])
    {
        this.#_app = app;

        this.#_abortables = abortables;
    }

    public throwIfAborted():AbortableHelper<A> | never
    {
        const app = this.#_app;

        for (const abortable of this.#_abortables) if (abortable.aborted === true) throw app.abort(abortable as IAborted, 'abortable is aborted', [abortable], {stackTraceFunctionToExclude:this.throwIfAborted, names:[AbortableHelper, this.throwIfAborted]});

        return this;
    }

    public value<V>(result:V):Exclude<V | never, IFailure | IAborted | IError>;
    public value<V>(result:V, options:{allowFailure:true}):Exclude<V | never, IAborted | IError>;
    public value<V>(result:V, options:{allowError:true}):Exclude<V | never, IFailure | IAborted>;
    public value<V>(result:V, options?:{allowFailure?:boolean, allowError?:boolean}):Exclude<V | never, IFailure | IAborted | IError> | Exclude<V | never, IAborted | IError> | Exclude<V | never, IFailure | IAborted>
    {    
        const app = this.#_app;
        const thisFn = this.value;

        if (app.typeUtil.isError(result) === true)
        {
            if (app.typeUtil.isError(result, true) !== true) throw app.warn(result, 'The result is a standard error.', [], {stackTraceFunctionToExclude:thisFn, errorOnly:true, names:[AbortableHelper, thisFn]});
         
            if (options?.allowError === true) return result as Exclude<V | never, IFailure | IAborted>; //standard errors still throw an exception, even if allowError is true

            app.rethrow(result, {stackTraceFunctionToExclude:thisFn});
        }

        for (const abortable of this.#_abortables) if (abortable.aborted === true) throw app.abort(abortable as IAborted, 'abortable is aborted', [abortable], {stackTraceFunctionToExclude:thisFn, names:[AbortableHelper, thisFn]});
        if (app.typeUtil.isAborted(result) === true) throw app.abort(result, 'The result aborted', [], {stackTraceFunctionToExclude:thisFn, names:[AbortableHelper, thisFn]});
        
        if (options?.allowFailure === true) return result as Exclude<V | never, IAborted | IError>;

        if (app.typeUtil.isFailure(result) === true) app.throw('Unhandled failure result.', [result], {stackTraceFunctionToExclude:thisFn});

        return result as Exclude<V, IFailure | IAborted | IError>;
    }

    public result<V>(result:V):V
    {    
        const app = this.#_app;
        const thisFn = this.result;

        for (const abortable of this.#_abortables) if (abortable.aborted === true) throw app.abort(abortable as IAborted, 'abortable is aborted', [abortable], {stackTraceFunctionToExclude:thisFn, names:[AbortableHelper, thisFn]});

        return result;
    }

    public values<V>(values:V[]):Exclude<V | never, IAborted | IError>[]; 
    public values<V>(values:V[], options:{extract:true}):Exclude<V | never, IAborted | IError>[] | IAborted | IError; 
    public values<V>(values:V[], options?:{extract:boolean}):Exclude<V | never, IAborted | IError>[] | IAborted | IError 
    {
        const app = this.#_app;
        const thisFn = this.values;
        const extractedValues:Exclude<V, IAborted | IError>[] = [];

        const extract = options?.extract === true;

        for (let value of values) 
        {
            if (app.typeUtil.isError(value) === true)
            {
                if (extract !== true) value = app.extractOrRethrow(value, {stackTraceFunctionToExclude:thisFn});
                else 
                {
                    if (app.typeUtil.isError(value, true) === true) return value;
                    
                    return app.warn(value, 'value is an error', [value], {names:[AbortableHelper, thisFn]});
                }
            }    
            
            if (app.typeUtil.isAborted(value) === true) 
            {
                if (extract !== true) throw app.abort(value as IAborted, 'value is aborted', [value], {stackTraceFunctionToExclude:thisFn, names:[AbortableHelper, thisFn]});
                
                return value;    
            }

            extractedValues.push(value as Exclude<V, IAborted | IError>);
        }

        for (const abortable of this.#_abortables) 
        {
            if (abortable.aborted !== true) continue;
            
            if (extract !== true) throw app.abort(abortable as IAborted, 'abortable is aborted', [abortable], {stackTraceFunctionToExclude:thisFn, names:[AbortableHelper, thisFn]});

            return abortable as IAborted;
        }

        return extractedValues;
    }

    public check(result?:any):void | never
    {    
        const app = this.#_app;
        const thisFn = this.check;

        if (app.typeUtil.isError(result) === true)
        {
            if (app.typeUtil.isError(result, true) !== true) throw app.warn(result, 'The result is a standard error.', [], {stackTraceFunctionToExclude:thisFn, errorOnly:true, names:[AbortableHelper, thisFn]});
            
            app.rethrow(result, {stackTraceFunctionToExclude:thisFn});
        }

        for (const abortable of this.#_abortables) if (abortable.aborted === true) throw app.abort(abortable as IAborted, 'abortable is aborted', [abortable], {stackTraceFunctionToExclude:thisFn, names:[AbortableHelper, thisFn]});
        if (app.typeUtil.isAborted(result) === true) throw app.abort(result, 'The result aborted', [], {stackTraceFunctionToExclude:thisFn, names:[AbortableHelper, thisFn]});
        
        if (app.typeUtil.isFailure(result) === true) app.throw('Unhandled failure result.', [result], {stackTraceFunctionToExclude:thisFn});
    }

    public failure<F=any>(result:any):IFailure<F> | undefined | never
    {    
        const app = this.#_app;
        const thisFn = this.failure;

        if (app.typeUtil.isError(result) === true)
        {
            if (app.typeUtil.isError(result, true) !== true) throw app.warn(result, 'The result is a standard error.', [], {stackTraceFunctionToExclude:thisFn, errorOnly:true, names:[AbortableHelper, thisFn]});
            
            app.rethrow(result, {stackTraceFunctionToExclude:thisFn});
        }

        for (const abortable of this.#_abortables) if (abortable.aborted === true) throw app.abort(abortable as IAborted, 'abortable is aborted', [abortable], {stackTraceFunctionToExclude:thisFn, names:[AbortableHelper, thisFn]});
        if (app.typeUtil.isAborted(result) === true) throw app.abort(result, 'The result aborted', [], {stackTraceFunctionToExclude:thisFn, names:[AbortableHelper, thisFn]});
        
        if (app.typeUtil.isFailure(result) === true) return result as IFailure<F>;

        return undefined;
    }

    public aborted(result?:any):IAborted | undefined | never
    {    
        const app = this.#_app;
        const thisFn = this.aborted;

        if (app.typeUtil.isError(result) === true)
        {
            if (app.typeUtil.isError(result, true) !== true) throw app.warn(result, 'The result is a standard error.', [], {stackTraceFunctionToExclude:thisFn, errorOnly:true, names:[AbortableHelper, thisFn]});
            
            app.rethrow(result, {stackTraceFunctionToExclude:thisFn});
        }

        for (const abortable of this.#_abortables) if (abortable.aborted === true) return abortable as IAborted;
        if (app.typeUtil.isAborted(result) === true) return result as IAborted;

        return undefined;
    }

    public error(result:any):IError | undefined | never
    {    
        const app = this.#_app;
        const thisFn = this.error;

        if (app.typeUtil.isError(result) !== true) return undefined;
        if (app.typeUtil.isError(result, true) !== true) return app.warn(result, 'The result is a standard error.', [], {stackTraceFunctionToExclude:thisFn, errorOnly:true, names:[AbortableHelper, thisFn]});
            
        return result;
    }
}