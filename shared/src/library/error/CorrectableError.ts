/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../decorators/ImplementsDecorator";
import { IAborted } from "../abort/IAborted";
import { __format2 } from "../utils/__internal/__format";
import { __is } from "../utils/__internal/__is";
import { Error } from "./Error";
import { ICorrectableError, ICorrectableErrorType } from "./ICorrectableError";
import { IError, IErrorType } from "./IError";
import { IBaseApp } from "../IBaseApp";

const SelfError = globalThis.Error;

/**
 * Represents errors attributable to developer oversight. The designation "correctable" suggests these errors are 
 * fundamentally avoidable, and their occurrence signals a lapse in development rigor.
 * 
 * @see ICorrectableError for details on the error handling strategy.
 * 
 * @forceSuperTransformer_ignoreParent 
 * @verifyInterfacesTransformer_ignore
 */
@ImplementsDecorator(IErrorType, ICorrectableErrorType)
export class CorrectableError extends SelfError implements ICorrectableError
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

    protected constructor(templateString:string, objects:ArrayLike<any> = [], cause?:unknown, stack?:string, name?:string)
    {
        const isDebug = globalThis.environment.frozen.isDebug;

        const [error, remainingObjects] = isDebug === true ? __format2(templateString, objects) : [templateString, Array.from(objects)];
        
        super(error, {cause});

        this.#_objects = remainingObjects;

        if (stack !== undefined) this.#_stack = stack;

        //adjust the name to match the custom class name
        this.name = name ?? this.constructor.name; 

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

    public static throw<A extends IBaseApp<A>>(app:A, templateString:string, objects:ArrayLike<any> = [], options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):never
    {
        return Error.__handleThrow(app, () => this.__getNewError(templateString, objects), {names:options?.names, stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? CorrectableError.throw, alwaysThrow:false});
    }

    public static rethrow<A extends IBaseApp<A>>(app:A, error:IError, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):never;
    public static rethrow<A extends IBaseApp<A>>(app:A, error:unknown, templateString:string, objects:ArrayLike<any>, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):never;
    public static rethrow<A extends IBaseApp<A>>(app:A, error:unknown, ...args:any[]):never
    {
        if (app.typeUtil.isString(args[0]) === true)
        {
            const [templateString, objects, options] = args as [string, ArrayLike<any>, {names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}];

            return Error.__handleRethrow(app, error, () => this.__getNewError(templateString, objects, error), {names:options?.names, stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.rethrow, alwaysThrow:false});
        }

        const options = args as {names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function};

        return Error.__handleRethrow(app, error, () => this.__getNewError('Error rethrow', [], error), {names:options?.names, stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.rethrow, alwaysThrow:false});  
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

        if (templateString === undefined) Error.__handleRethrow(app, value, () => this.__getNewError('Rethrown: ' + value.message, objects, value), {stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.extractOrRethrow, alwaysThrow:true});

        Error.__handleRethrow(app, value, () => this.__getNewError(templateString, objects, value), {stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.extractOrRethrow, alwaysThrow:true});    
    }

    public static __getNewError = (templateString:string, objects:ArrayLike<any> = [], cause?:unknown):CorrectableError => new CorrectableError(templateString, objects, cause);

    public get objects():any[]
    {
        return this.#_objects;
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

    public get correctable():true
    {
        return true;
    }

    public get aborted():IAborted | undefined
    {
        return this.#_aborted;
    }

    public get __stackTraceCaptured():boolean
    {
        return this.#_stackTraceCaptured;
    }

    public set __stackTraceCaptured(value:boolean)
    {
        this.#_stackTraceCaptured = value;
    }
}