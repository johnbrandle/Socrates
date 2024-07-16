/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ImplementsDecorator } from "../../../../shared/src/library/decorators/ImplementsDecorator.ts";
import type { IError } from "../../../../shared/src/library/error/IError.ts";
import type { IDestructable } from "../../../../shared/src/library/IDestructable.ts";
import { IDestructorType } from "../../../../shared/src/library/IDestructor.ts";
import { IBaseAppType as ISharedBaseAppType } from "../../../../shared/src/library/IBaseApp.ts";
import { IUIdentifiableType } from "../../../../shared/src/library/IUIdentifiable.ts";
import type { IObservableManager } from "../../../../shared/src/library/managers/IObservableManager.ts";
import { ConsoleUtil } from "../../../../shared/src/library/utils/ConsoleUtil.ts";
import { GCUtil } from "../../../../shared/src/library/utils/GCUtil.ts";
import type { IBaseApp } from "./IBaseApp.ts";
import { IBaseAppType } from "./IBaseApp.ts";
import type { IEnvironment } from "./IEnvironment.ts";
import type { IInstanceManager } from "./managers/IInstanceManager.ts";
import type { ArrayUtil } from "../../../../shared/src/library/utils/ArrayUtil.ts";
import type { BigIntUtil } from "../../../../shared/src/library/utils/BigIntUtil.ts";
import type { BitmaskUtil } from "../../../../shared/src/library/utils/BitmaskUtil.ts";
import type { BitUtil } from "../../../../shared/src/library/utils/BitUtil.ts";
import type { ByteUtil } from "../../../../shared/src/library/utils/ByteUtil.ts";
import type { ConfigUtil } from "../../../../shared/src/library/utils/ConfigUtil.ts";
import type { CryptUtil } from "../../../../shared/src/library/utils/CryptUtil.ts";
import type { CSPUtil } from "../../../../shared/src/library/utils/CSPUtil.ts";
import type { IntegerUtil } from "../../../../shared/src/library/utils/IntegerUtil.ts";
import type { JSONUtil } from "../../../../shared/src/library/utils/JSONUtil.ts";
import type { NumberUtil } from "../../../../shared/src/library/utils/NumberUtil.ts";
import type { ProxyUtil } from "../../../../shared/src/library/utils/ProxyUtil.ts";
import type { RequestUtil } from "../../../../shared/src/library/utils/RequestUtil.ts";
import type { ResponseUtil } from "../../../../shared/src/library/utils/ResponseUtil.ts";
import type { SerializationUtil } from "../../../../shared/src/library/utils/SerializationUtil.ts";
import type { StringUtil } from "../../../../shared/src/library/utils/StringUtil.ts";
import type { TextUtil } from "../../../../shared/src/library/utils/TextUtil.ts";
import type { TypeUtil } from "../../../../shared/src/library/utils/TypeUtil.ts";
import type { URLUtil } from "../../../../shared/src/library/utils/URLUtil.ts";
import type { AccessUtil } from "./utils/AccessUtil.ts";
import type { BaseUtil } from "../../../../shared/src/library/utils/BaseUtil.ts";
import type { DebugUtil } from "../../../../shared/src/library/utils/DebugUtil.ts";
import type { HashUtil } from "../../../../shared/src/library/utils/HashUtil.ts";
import type { HMACUtil } from "../../../../shared/src/library/utils/HMACUtil.ts";
import type { KeyUtil } from "../../../../shared/src/library/utils/KeyUtil.ts";
import type { ObjectUtil } from "../../../../shared/src/library/utils/ObjectUtil.ts";
import type { PromiseUtil } from "../../../../shared/src/library/utils/PromiseUtil.ts";
import type { StreamUtil } from "../../../../shared/src/library/utils/StreamUtil.ts";
import type { uid, UIDUtil } from "../../../../shared/src/library/utils/UIDUtil.ts";
import type { UUIDUtil } from "../../../../shared/src/library/utils/UUIDUtil.ts";
import type { IAborted } from "../../../../shared/src/library/abort/IAborted.ts";
import { Error } from "../../../../shared/src/library/error/Error.ts";
import { CorrectableError } from "../../../../shared/src/library/error/CorrectableError.ts";

/**
 * @verifyInterfacesTransformer_ignore
 */
@ImplementsDecorator(ISharedBaseAppType, IBaseAppType, IDestructorType, IUIdentifiableType)
export abstract class BaseApp<A extends IBaseApp<A>> implements IBaseApp<A>
{
    public abstract get uid():uid;

    #_destructables:Set<IDestructable<A> | (() => Promise<any>)> = new Set();
    public addDestructable(destructable:IDestructable<A> | (() => Promise<any>)):void { this.#_destructables.add(destructable); }
    public removeDestructable(destructable:IDestructable<A> | (() => Promise<any>)):boolean { return this.#_destructables.delete(destructable); }
    public get app():A { return this as unknown as A; }

    #_environment!:IEnvironment;
    get environment():IEnvironment { return this.#_environment; }

    constructor(environment:IEnvironment) 
    {
        this.#_environment = environment;
    }

    /**
     * 
     * @forceSuperTransformer_forceSuperCall
     */
    public async init():Promise<true | IError>
    {
        return true;
    }

    public abstract get accessUtil():AccessUtil<A>;

    public abstract get arrayUtil():ArrayUtil<A>;
    public abstract get baseUtil():BaseUtil<A>;
    public abstract get bigIntUtil():BigIntUtil<A>;
    public abstract get bitmaskUtil():BitmaskUtil<A>;
    public abstract get bitUtil():BitUtil<A>;
    public abstract get byteUtil():ByteUtil<A>;
    public abstract get configUtil():ConfigUtil<A>;
    public abstract get consoleUtil():ConsoleUtil<A>;
    public abstract get cryptUtil():CryptUtil<A>;
    public abstract get cspUtil():CSPUtil<A>;
    public abstract get debugUtil():DebugUtil<A>;
    public abstract get gcUtil():GCUtil<A>;
    public abstract get hashUtil():HashUtil<A>;
    public abstract get hmacUtil():HMACUtil<A>;
    public abstract get integerUtil():IntegerUtil<A>;
    public abstract get jsonUtil():JSONUtil<A>;
    public abstract get keyUtil():KeyUtil<A>;
    public abstract get numberUtil():NumberUtil<A>;
    public abstract get objectUtil():ObjectUtil<A>;
    public abstract get promiseUtil():PromiseUtil<A>;
    public abstract get proxyUtil():ProxyUtil<A>;
    public abstract get requestUtil():RequestUtil<A>;
    public abstract get responseUtil():ResponseUtil<A>;
    public abstract get serializationUtil():SerializationUtil<A>;
    public abstract get streamUtil():StreamUtil<A>;
    public abstract get stringUtil():StringUtil<A>;
    public abstract get textUtil():TextUtil<A>;
    public abstract get typeUtil():TypeUtil<A>;
    public abstract get uidUtil():UIDUtil<A>;
    public abstract get urlUtil():URLUtil<A>;
    public abstract get uuidUtil():UUIDUtil<A>;

    public abstract get observableManager():IObservableManager<A>;
    public abstract get instanceManager():IInstanceManager<A>;

    public abstract get name():string;

    public throw(templateString:string, objects:ArrayLike<any>, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean}):never
    {
        if (options?.correctable !== true) Error.throw<IBaseApp<A>>(this, templateString, objects, {names:options?.names, stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.throw});
        else CorrectableError.throw<IBaseApp<A>>(this, templateString, objects, {names:options.names, stackTraceFunctionToExclude:options.stackTraceFunctionToExclude ?? this.throw});
    }
    
    public rethrow(error:IError, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean}):never;
    public rethrow(error:unknown, templateString:string, objects:ArrayLike<any>, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean}):never;
    public rethrow(error:unknown | IError, ...args:any[]):never
    {
        if (this.typeUtil.isString(args[0]) === true)
        {
            const [templateString, objects, options] = args as [string, ArrayLike<any>, {names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean} | undefined];

            if (options?.correctable !== true) Error.rethrow<IBaseApp<A>>(this, error as unknown, templateString, objects, {names:options?.names, stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.rethrow});
            else CorrectableError.rethrow<IBaseApp<A>>(this, error as unknown, templateString, objects, {names:options.names, stackTraceFunctionToExclude:options.stackTraceFunctionToExclude ?? this.rethrow});
        }

        const options = args as {names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean} | undefined;

        if (options?.correctable !== true) Error.rethrow<IBaseApp<A>>(this, error as IError, {names:options?.names, stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.rethrow});
        else CorrectableError.rethrow<IBaseApp<A>>(this, error as IError, {names:options.names, stackTraceFunctionToExclude:options.stackTraceFunctionToExclude ?? this.rethrow});
    }
    
    public warn(error:unknown, options?:{errorOnly?:false, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IAborted | IError;
    public warn(error:unknown, templateString:string, objects:ArrayLike<any>, options?:{errorOnly?:false, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IAborted | IError;
    public warn(error:unknown, options:{errorOnly:true, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IError;
    public warn(error:unknown, templateString:string, objects:ArrayLike<any>, options:{errorOnly:true, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IError;
    public warn(error:unknown, ...args:any[]):IAborted | IError
    {
        if (this.typeUtil.isString(args[0]) === true)
        {
            const [templateString, objects, options] = args as [string, ArrayLike<any>, {errorOnly?:boolean, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function} | undefined];
            
            if (options?.errorOnly === true) return Error.warn<IBaseApp<A>>(this, error, templateString, objects, {errorOnly:options.errorOnly, names:options.names, stackTraceFunctionToExclude:options.stackTraceFunctionToExclude ?? this.warn});
            else return Error.warn<IBaseApp<A>>(this, error, templateString, objects, {errorOnly:options?.errorOnly, names:options?.names, stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.warn});
        }

        const options = args[0] as {errorOnly?:boolean, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function} | undefined;

        if (options?.errorOnly === true) return Error.warn<IBaseApp<A>>(this, error, {errorOnly:options.errorOnly, names:options.names, stackTraceFunctionToExclude:options.stackTraceFunctionToExclude ?? this.warn});
        else return Error.warn<IBaseApp<A>>(this, error, {errorOnly:options?.errorOnly, names:options?.names, stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.warn});
    }
    
    public abort(aborted:IAborted, templateString:string, objects:ArrayLike<any>, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IError
    {
        return Error.abort<IBaseApp<A>>(this, aborted, templateString, objects, {names:options?.names, stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.abort});
    }
    
    public extractOrRethrow<T>(value:T, templateString:string, objects:ArrayLike<any>, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean}):Exclude<T, IError>;
    public extractOrRethrow<T>(value:T, options?:{objects?:ArrayUtil<any>, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean}):Exclude<T, IError>;
    public extractOrRethrow<T>(value:T, ...args:any[]):Exclude<T, IError>
    {
        if (this.typeUtil.isString(args[0]) === true)
        {
            const [templateString, objects, options] = args as [string, ArrayLike<any>, {names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean} | undefined];

            if (options?.correctable !== true) return Error.extractOrRethrow<IBaseApp<A>, T>(this, value, templateString, objects, {names:options?.names, stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.extractOrRethrow});
            else return CorrectableError.extractOrRethrow<IBaseApp<A>, T>(this, value, templateString, objects, {names:options.names, stackTraceFunctionToExclude:options.stackTraceFunctionToExclude ?? this.extractOrRethrow});
        }

        const options = args as {objects?:ArrayUtil<any>, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean} | undefined;

        if (options?.correctable !== true) return Error.extractOrRethrow<IBaseApp<A>, T>(this, value, {names:options?.names, stackTraceFunctionToExclude:options?.stackTraceFunctionToExclude ?? this.extractOrRethrow});
        else return CorrectableError.extractOrRethrow<IBaseApp<A>, T>(this, value, {names:options.names, stackTraceFunctionToExclude:options.stackTraceFunctionToExclude ?? this.extractOrRethrow});
    }
}