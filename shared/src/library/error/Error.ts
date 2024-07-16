/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { IAborted } from "../abort/IAborted";
import { DevEnvironment } from "../IEnvironment";
import { __format2 } from "../utils/__internal/__format";
import { __is } from "../utils/__internal/__is";
import { IError, IErrorType } from "./IError";
import { IBaseApp } from "../IBaseApp";

const SelfError = globalThis.Error;

/** 
 * @forceSuperTransformer_ignoreParent 
 * @verifyInterfacesTransformer_ignore
 */
@ImplementsDecorator(IErrorType)
export class Error extends SelfError implements IError
{ 
    /**
     * This is used for outputting complex objects to the console. (e.g. objects, arrays, etc.)
     * However, keep in mind that this will prevent those objects from being garbage collected.
     */
    #_objects:any[] = [];

    /**
     * This is used to determine if the stack trace has been captured. This is important because
     * if the stack trace has not been captured, we will capture it when the error is thrown for
     * the first time. This is important because it allows us to capture the stack trace at the
     * point of the error, rather than at the point of the error being thrown.
     */
    #_stackTraceCaptured = false;

    #_stack?:string;

    /**
     * True if the error was caused by an abort.
     */
    #_aborted:IAborted | undefined;

    /**
     * protected so that we use static methods to create instances (unless there is a good reason not to, hence __getNewError)
     * @param templateString 
     * @param objects
     * 
     * The first of these objects are for constructing the error message. Using the optional string formatting
     * mechanism, you can pass in a string with placeholders and then pass in the values to replace.
     * 
     * Example:
     * 
     * FrameworkError.throw("This is a test error, ${value1}, ${value2}", ["foo", "bar"]);
     * 
     * The second set of objects are for outputting complex objects to the console. (e.g. objects, arrays, etc.)
     * However, keep in mind that this will prevent those objects from being garbage collected.
     * 
     * Example:
     * 
     * FrameworkError.throw("This is a test error, ${value1}, ${value2}", ["foo", "bar", {foo: "bar"}]);
     * 
     * outputs: "This is a test error, foo, bar" and {foo: "bar"} to the console
     */
    protected constructor(templateString:string, objects:ArrayLike<any> = [], cause?:unknown, stack?:string, name?:string, aborted?:IAborted)
    {
        const isDebug = globalThis.environment.frozen.isDebug;

        const [error, remainingObjects] = isDebug === true ? __format2(templateString, objects) : [templateString, Array.from(objects)];
        
        super(error, {cause});

        this.#_objects = remainingObjects;

        if (stack !== undefined) this.#_stack = stack;

        //adjust the name to match the custom class name
        this.name = name ?? this.constructor.name; 

        this.#_aborted = aborted;

        //propagate the aborted flag from the cause
        if (__is<IError>(cause, IErrorType) === true && cause.aborted !== undefined) this.#_aborted = cause.aborted;

        //because Error is a built-in class
        Object.defineProperty(this, 'stack', 
        {
            get:() => this.#_stack ?? super.stack ?? '',
            configurable:true,
        });

        //because Error is a built-in class
        Object.defineProperty(this, 'cause', 
        {
            get:() => super.cause ?? undefined,
            configurable:true,
        });
    }

    public static throw<A extends IBaseApp<A>>(app:A, templateString:string, objects:ArrayLike<any>, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):never
    {
        return this.__handleThrow(app, () => this.__getNewError(templateString, objects), {stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.throw, alwaysThrow:false});
    }

    public static rethrow<A extends IBaseApp<A>>(app:A, error:IError, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):never;
    public static rethrow<A extends IBaseApp<A>>(app:A, error:unknown, templateString:string, objects:ArrayLike<any>, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):never;
    public static rethrow<A extends IBaseApp<A>>(app:A, error:unknown, ...args:any[]):never
    {
        if (app.typeUtil.isString(args[0]) === true)
        {
            const [templateString, objects, options] = args as [string, ArrayLike<any>, {names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}];

            return this.__handleRethrow(app, error, () => this.__getNewError(templateString, objects, error), {names:options?.names, stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.rethrow, alwaysThrow:false});
        }

        const options = args as {names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function};

        return this.__handleRethrow(app, error, () => this.__getNewError('Error rethrow', [], error), {names:options?.names, stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.rethrow, alwaysThrow:false});
    }

    public static extractOrRethrow<A extends IBaseApp<A>, T>(app:A, value:T, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean}):Exclude<T, IError>;
    public static extractOrRethrow<A extends IBaseApp<A>, T>(app:A, value:T, templateString:string, objects:ArrayLike<any>, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean}):Exclude<T, IError>;
    public static extractOrRethrow<A extends IBaseApp<A>, T>(app:A, value:T, ...args:any[]):Exclude<T, IError>
    {
        if (__is<IError>(value, IErrorType) !== true) return value as Exclude<T, IError>;

        let templateString:string | undefined;
        let objects:any[] | undefined;
        let options:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean} | undefined;

        if (app.typeUtil.isString(args[0]) === true)
        {
            templateString = args[0];
            objects = args[1]; 
            options = args[2];
        }
        else options = args[0];

        if (templateString === undefined) this.__handleRethrow(app, value, () => this.__getNewError('Rethrown: ' + value.message, objects, value), {stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.extractOrRethrow, alwaysThrow:true});

        this.__handleRethrow(app, value, () => this.__getNewError(templateString, objects, value), {stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.extractOrRethrow, alwaysThrow:true});
    }

    /*
    public static expectOrThrow<T>(valueToExpect:T, value:any, templateString?:string, objects?:ArrayLike<any>):T | never
    {
        if (valueToExpect === value) return valueToExpect;

        if (__is<IError>(value, IErrorType) !== true) this.__handleThrow(() => this.__getNewError(templateString ?? `exected ${valueToExpect}, got ${typeof value}`, objects), this.expectOrThrow);
        
        this.__handleRethrow(value, () => this.__getNewError(templateString ?? `exected ${valueToExpect}, got ${typeof value}`, objects, value), this.extractOrRethrow);
    }
    */

    public static warn<A extends IBaseApp<A>>(app:A, originatingError:unknown, options?:{errorOnly?:false, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IAborted | IError;
    public static warn<A extends IBaseApp<A>>(app:A, originatingError:unknown, templateString:string, objects:ArrayLike<any>, options?:{errorOnly?:false, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IAborted | IError;
    public static warn<A extends IBaseApp<A>>(app:A, originatingError:unknown, options:{errorOnly:true, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IError;
    public static warn<A extends IBaseApp<A>>(app:A, originatingError:unknown, templateString:string, objects:ArrayLike<any>, options:{errorOnly:true, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IError;
    public static warn<A extends IBaseApp<A>>(app:A, originatingError:unknown, ...args:any[]):IAborted | IError
    {
        if (app.typeUtil.isString(args[0]) === true)
        {
            let [templateString, objects, options] = args as [string, ArrayLike<any>, {errorOnly?:boolean, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}];

            return this.__handleWarn(app, originatingError, templateString, objects, this.__getNewError, {stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.warn, names:options?.names, errorOnly:options.errorOnly ?? false});
        }

        let options = args[0] as {errorOnly?:boolean, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function};
        let templateString = '';

        return this.__handleWarn(app, originatingError, templateString, [], this.__getNewError, {stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.warn, names:options?.names, errorOnly:options.errorOnly ?? false});
    }

    public static abort<A extends IBaseApp<A>>(app:A, aborted:IAborted, templateString:string, objects:ArrayLike<any>, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IError
    {
        return this.__handleAbort(app, aborted, templateString, objects, (templateString:string, objects:ArrayLike<any>, aborted:IAborted) => this.__getNewError(templateString, objects, undefined, undefined, undefined, aborted), {stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.abort, names:options?.names});
    }

    public static __handleThrow<A extends IBaseApp<A>>(app:A, createError:() => IError, options:{names?:({name:string} | string)[], stackTraceFunctionToExclude:Function, alwaysThrow:boolean}):never
    {
        const error = createError();

        //capture the stack trace for better debugging
        if (SelfError.captureStackTrace !== undefined) SelfError.captureStackTrace(error, options.stackTraceFunctionToExclude);
        error.__stackTraceCaptured = true;

        if (globalThis.environment.isDevToolsOpen !== true) throw error; //if developer tools is closed, we will throw the error
        
        //if this is a dev environment, return, as the debugger statement inserted by the compiler will pause execution immediatly after this, and will throw the error
        if (globalThis.environment.frozen.devEnvironment === DevEnvironment.Dev && options.alwaysThrow !== true)
        {
            //@ts-ignore
            //return error; //return it so we can throw it later (see builder 'custom-loader.js' for more info)
        }

        //developer tools is open, but this is not the dev enviornment, so we will pause execution, and then throw the error

        //debugger;

        throw error;
    }

    public static __handleRethrow<A extends IBaseApp<A>>(app:A, originatingError:unknown, createError:() => IError, options:{names?:({name:string} | string)[], stackTraceFunctionToExclude:Function, alwaysThrow:boolean}):never
    {
        const isDebug = globalThis.environment.frozen.isDebug;

        if (__is<IError>(originatingError, IErrorType) === true)
        {
            //capture the stack trace if it hasn't been captured yet (it's possible for an error to have been created and returned without having been thrown before)
            if (originatingError.__stackTraceCaptured !== true && SelfError.captureStackTrace !== undefined) SelfError.captureStackTrace(originatingError, options.stackTraceFunctionToExclude);

            if (isDebug === true) app.consoleUtil.warn(Error, originatingError, originatingError.objects);
            else app.consoleUtil.warn(Error, originatingError);
        } 
        else app.consoleUtil.warn(Error, originatingError);

        return this.__handleThrow(app, createError, options);
    }

    public static __handleWarn<A extends IBaseApp<A>, T extends IError>(app:A, originatingError:unknown, templateString:string, objects:ArrayLike<any> = [], createError:(templateString:string, objects:ArrayLike<any>, cause?:unknown) => T, options:{names?:({name:string} | string)[], stackTraceFunctionToExclude:Function, errorOnly:boolean}):IAborted | T
    {
        if (options?.names !== undefined) templateString = `${options.names.map(obj => (typeof obj === 'string' ? obj : obj.name)).join(', ')}: ${templateString}`;

        if (options.errorOnly !== true && (__is<IError>(originatingError, IErrorType) === true && originatingError.aborted !== undefined)) return originatingError.aborted;

       let aborted = false;
       const isDebug = globalThis.environment.frozen.isDebug;

        if (__is<IError>(originatingError, IErrorType) !== true)
        {
            //we never should have gotten here, but if we did we need to wrap the originating error in a new preventable uncaught error
            const error = this.__getNewError(`Unhandled Non-framework originating error passed into framework error handleWarn method. use rethrow and then warn instead of calling warn directly.`, [], originatingError);
            if (SelfError.captureStackTrace !== undefined) SelfError.captureStackTrace(error); //we want to capture it from here, not from the originating error
            error.__stackTraceCaptured = true;

            app.consoleUtil.warn(Error, originatingError);

            if (isDebug === true) app.consoleUtil.warn(Error, error, ...error.objects);
            else app.consoleUtil.warn(Error, error);

            originatingError = error;
        } 
        else 
        {
            aborted = originatingError.aborted !== undefined;

            if (aborted !== true)
            {
                if (isDebug === true) app.consoleUtil.warn(Error, originatingError, ...originatingError.objects);
                else app.consoleUtil.warn(Error, originatingError);
            }
        }
        
        //now wrap it in our specific error
        const error = createError(templateString, objects, originatingError);
        if (SelfError.captureStackTrace !== undefined) SelfError.captureStackTrace(error, options.stackTraceFunctionToExclude); //capture this from the originating error
        error.__stackTraceCaptured = true;

        if (aborted === true) return error;
        
        if (isDebug === true) app.consoleUtil.warn(Error, error, ...error.objects);
        else app.consoleUtil.warn(Error, error);

        if (globalThis.environment.isDevToolsOpen !== true) return error; //if developer tools is closed, we will return the error

        //if developer tools is open, but this is not the dev enviornment, so we will pause execution before returning the error
        //if (globalThis.environment.frozen?.devEnvironment !== DevEnvironment.Dev) debugger;

        return error;
    }

    public static __handleAbort<A extends IBaseApp<A>, T extends IError>(app:A, aborted:IAborted, templateString:string, objects:ArrayLike<any>=[], createError:(templateString:string, objects:ArrayLike<any>, aborted:IAborted) => T, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):T
    {
        //now wrap it in our specific error
        const error = createError(templateString, objects, aborted);
        if (SelfError.captureStackTrace !== undefined) SelfError.captureStackTrace(error, options?.stackTraceFunctionToExclude ?? this.__handleAbort); //capture this from the originating error
        error.__stackTraceCaptured = true;

        //if (isDebug === true) ConsoleUtil.warn(Error, error, ...error.objects, aborted);
        //else ConsoleUtil.warn(Error, error, aborted);

        return error;
    }

    public get objects():any[]
    {
        return this.#_objects;
    }

    public get correctable():false
    {
        return false;
    }

    public get aborted():IAborted | undefined
    {
        return this.#_aborted;
    }

    //never used, just here to satisfy the interface (see the constructor for the actual implementation)
    public override get stack():string
    {
        return '';
    }

    //never used, just here to satisfy the interface (see the constructor for the actual implementation)
    public override get cause():unknown
    {
        return undefined;
    }

    public get __stackTraceCaptured():boolean
    {
        return this.#_stackTraceCaptured;
    }

    public set __stackTraceCaptured(value:boolean)
    {
        this.#_stackTraceCaptured = value;
    }

    public static __getNewError = <A extends IBaseApp<A>>(templateString:string, objects:ArrayLike<any> = [], cause?:unknown, stack?:string, name?:string, aborted?:IAborted):IError => new Error(templateString ?? 'No reason provided!', objects, cause, stack, name, aborted);
}