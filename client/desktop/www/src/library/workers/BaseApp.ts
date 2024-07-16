/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAborted } from "../../../../../../shared/src/library/abort/IAborted";
import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator";
import type { IError } from "../../../../../../shared/src/library/error/IError";
import { IBaseAppType as ISharedBaseAppType } from "../../../../../../shared/src/library/IBaseApp";
import type { IDestructable } from "../../../../../../shared/src/library/IDestructable";
import { IDestructorType } from "../../../../../../shared/src/library/IDestructor";
import type { IEnvironment } from "../../../../../../shared/src/library/IEnvironment";
import { IUIdentifiableType } from "../../../../../../shared/src/library/IUIdentifiable";
import type { IObservableManager } from "../../../../../../shared/src/library/managers/IObservableManager";
import type { ArrayUtil } from "../../../../../../shared/src/library/utils/ArrayUtil";
import type { BaseUtil } from "../../../../../../shared/src/library/utils/BaseUtil";
import type { BigIntUtil } from "../../../../../../shared/src/library/utils/BigIntUtil";
import type { BitmaskUtil } from "../../../../../../shared/src/library/utils/BitmaskUtil";
import type { BitUtil } from "../../../../../../shared/src/library/utils/BitUtil";
import type { ByteUtil } from "../../../../../../shared/src/library/utils/ByteUtil";
import type { ConfigUtil } from "../../../../../../shared/src/library/utils/ConfigUtil";
import type { ConsoleUtil } from "../../../../../../shared/src/library/utils/ConsoleUtil";
import type { CryptUtil } from "../../../../../../shared/src/library/utils/CryptUtil";
import type { CSPUtil } from "../../../../../../shared/src/library/utils/CSPUtil";
import type { DebugUtil } from "../../../../../../shared/src/library/utils/DebugUtil";
import type { GCUtil } from "../../../../../../shared/src/library/utils/GCUtil";
import type { HashUtil } from "../../../../../../shared/src/library/utils/HashUtil";
import type { HMACUtil } from "../../../../../../shared/src/library/utils/HMACUtil";
import type { IntegerUtil } from "../../../../../../shared/src/library/utils/IntegerUtil";
import type { JSONUtil } from "../../../../../../shared/src/library/utils/JSONUtil";
import type { KeyUtil } from "../../../../../../shared/src/library/utils/KeyUtil";
import type { NumberUtil } from "../../../../../../shared/src/library/utils/NumberUtil";
import type { ObjectUtil } from "../../../../../../shared/src/library/utils/ObjectUtil";
import type { PromiseUtil } from "../../../../../../shared/src/library/utils/PromiseUtil";
import type { ProxyUtil } from "../../../../../../shared/src/library/utils/ProxyUtil";
import type { RequestUtil } from "../../../../../../shared/src/library/utils/RequestUtil";
import type { ResponseUtil } from "../../../../../../shared/src/library/utils/ResponseUtil";
import type { SerializationUtil } from "../../../../../../shared/src/library/utils/SerializationUtil";
import type { StreamUtil } from "../../../../../../shared/src/library/utils/StreamUtil";
import type { StringUtil } from "../../../../../../shared/src/library/utils/StringUtil";
import type { TextUtil } from "../../../../../../shared/src/library/utils/TextUtil";
import type { TypeUtil } from "../../../../../../shared/src/library/utils/TypeUtil";
import type { uid, UIDUtil } from "../../../../../../shared/src/library/utils/UIDUtil";
import type { URLUtil } from "../../../../../../shared/src/library/utils/URLUtil";
import type { UUIDUtil } from "../../../../../../shared/src/library/utils/UUIDUtil";
import { IBaseAppType, type IBaseApp } from "./IBaseApp";
import { CorrectableError } from "../../../../../../shared/src/library/error/CorrectableError";
import { Error } from "../../../../../../shared/src/library/error/Error";

/**
 * @verifyInterfacesTransformer_ignore
 */
@ImplementsDecorator(ISharedBaseAppType, IBaseAppType, IDestructorType, IUIdentifiableType)
export abstract class BaseApp<A extends IBaseApp<A>> implements IBaseApp<A>
{
    public get uid():uid { return this.throw('not implemented', []); }

    public addDestructable(_destructable:IDestructable<A> | (() => Promise<any>)):void { return this.throw('not implemented', []); }
    public removeDestructable(_destructable:IDestructable<A> | (() => Promise<any>)):boolean { return this.throw('not implemented', []); }
    public get app():A { return this as unknown as A; }

    public get environment():IEnvironment { return this.throw('not implemented', []); }

    public get arrayUtil():ArrayUtil<A> { return this.throw('not implemented', []); }
    public get baseUtil():BaseUtil<A> { return this.throw('not implemented', []); }
    public get bigIntUtil():BigIntUtil<A> { return this.throw('not implemented', []); }
    public get bitmaskUtil():BitmaskUtil<A> { return this.throw('not implemented', []); }
    public get bitUtil():BitUtil<A> { return this.throw('not implemented', []); }
    public get byteUtil():ByteUtil<A> { return this.throw('not implemented', []); }
    public get configUtil():ConfigUtil<A> { return this.throw('not implemented', []); }
    public get consoleUtil():ConsoleUtil<A> { return this.throw('not implemented', []); }
    public get cryptUtil():CryptUtil<A> { return this.throw('not implemented', []); }
    public get cspUtil():CSPUtil<A> { return this.throw('not implemented', []); }
    public get debugUtil():DebugUtil<A> { return this.throw('not implemented', []); }
    public get gcUtil():GCUtil<A> { return this.throw('not implemented', []); }
    public get hashUtil():HashUtil<A> { return this.throw('not implemented', []); }
    public get hmacUtil():HMACUtil<A> { return this.throw('not implemented', []); }
    public get integerUtil():IntegerUtil<A> { return this.throw('not implemented', []); }
    public get jsonUtil():JSONUtil<A> { return this.throw('not implemented', []); }
    public get keyUtil():KeyUtil<A> { return this.throw('not implemented', []); }
    public get numberUtil():NumberUtil<A> { return this.throw('not implemented', []); }
    public get objectUtil():ObjectUtil<A> { return this.throw('not implemented', []); }
    public get promiseUtil():PromiseUtil<A> { return this.throw('not implemented', []); }
    public get proxyUtil():ProxyUtil<A> { return this.throw('not implemented', []); }
    public get requestUtil():RequestUtil<A> { return this.throw('not implemented', []); }
    public get responseUtil():ResponseUtil<A> { return this.throw('not implemented', []); }
    public get serializationUtil():SerializationUtil<A> { return this.throw('not implemented', []); }
    public get streamUtil():StreamUtil<A> { return this.throw('not implemented', []); }
    public get stringUtil():StringUtil<A> { return this.throw('not implemented', []); }
    public get textUtil():TextUtil<A> { return this.throw('not implemented', []); }
    public get typeUtil():TypeUtil<A> { return this.throw('not implemented', []); }
    public get uidUtil():UIDUtil<A> { return this.throw('not implemented', []); }
    public get urlUtil():URLUtil<A> { return this.throw('not implemented', []); }
    public get uuidUtil():UUIDUtil<A> { return this.throw('not implemented', []); }

    public get observableManager():IObservableManager<A> { return this.throw('not implemented', []); }

    public get name():string { return this.throw('not implemented', []); }

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