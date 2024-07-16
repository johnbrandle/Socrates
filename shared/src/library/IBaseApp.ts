/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IUIdentifiable } from "./IUIdentifiable";
import type { IDestructor } from "./IDestructor";
import type { IObservableManager } from "./managers/IObservableManager";
import type { IEnvironment } from "./IEnvironment";
import type { ArrayUtil } from "./utils/ArrayUtil";
import type { StringUtil } from "./utils/StringUtil";
import type { UUIDUtil } from "./utils/UUIDUtil";
import type { URLUtil } from "./utils/URLUtil";
import type { UIDUtil } from "./utils/UIDUtil";
import type { TypeUtil } from "./utils/TypeUtil";
import type { TextUtil } from "./utils/TextUtil";
import type { StreamUtil } from "./utils/StreamUtil";
import type { SerializationUtil } from "./utils/SerializationUtil";
import type { ResponseUtil } from "./utils/ResponseUtil";
import type { RequestUtil } from "./utils/RequestUtil";
import type { ProxyUtil } from "./utils/ProxyUtil";
import type { PromiseUtil } from "./utils/PromiseUtil";
import type { ObjectUtil } from "./utils/ObjectUtil";
import type { NumberUtil } from "./utils/NumberUtil";
import type { KeyUtil } from "./utils/KeyUtil";
import type { JSONUtil } from "./utils/JSONUtil";
import type { IntegerUtil } from "./utils/IntegerUtil";
import type { HMACUtil } from "./utils/HMACUtil";
import type { HashUtil } from "./utils/HashUtil";
import type { GCUtil } from "./utils/GCUtil";
import type { DebugUtil } from "./utils/DebugUtil";
import type { CSPUtil } from "./utils/CSPUtil";
import type { CryptUtil } from "./utils/CryptUtil";
import type { ConsoleUtil } from "./utils/ConsoleUtil";
import type { ConfigUtil } from "./utils/ConfigUtil";
import type { ByteUtil } from "./utils/ByteUtil";
import type { BitUtil } from "./utils/BitUtil";
import type { BitmaskUtil } from "./utils/BitmaskUtil";
import type { BigIntUtil } from "./utils/BigIntUtil";
import type { BaseUtil } from "./utils/BaseUtil";
import { IError } from "./error/IError";
import { IAborted } from "./abort/IAborted";

export const IBaseAppType = Symbol("IBaseApp");

export interface IBaseApp<A extends IBaseApp<A>> extends IDestructor<A>, IUIdentifiable
{
    get environment():IEnvironment;

    get arrayUtil():ArrayUtil<A>;
    get baseUtil():BaseUtil<A>;
    get bigIntUtil():BigIntUtil<A>;
    get bitmaskUtil():BitmaskUtil<A>;
    get bitUtil():BitUtil<A>;
    get byteUtil():ByteUtil<A>;
    get configUtil():ConfigUtil<A>;
    get consoleUtil():ConsoleUtil<A>;
    get cryptUtil():CryptUtil<A>;
    get cspUtil():CSPUtil<A>;
    get debugUtil():DebugUtil<A>;
    get gcUtil():GCUtil<A>;
    get hashUtil():HashUtil<A>;
    get hmacUtil():HMACUtil<A>;
    get integerUtil():IntegerUtil<A>;
    get jsonUtil():JSONUtil<A>;
    get keyUtil():KeyUtil<A>;
    get numberUtil():NumberUtil<A>;
    get objectUtil():ObjectUtil<A>;
    get promiseUtil():PromiseUtil<A>;
    get proxyUtil():ProxyUtil<A>;
    get requestUtil():RequestUtil<A>;
    get responseUtil():ResponseUtil<A>;
    get serializationUtil():SerializationUtil<A>;
    get streamUtil():StreamUtil<A>;
    get stringUtil():StringUtil<A>;
    get textUtil():TextUtil<A>;
    get typeUtil():TypeUtil<A>;
    get uidUtil():UIDUtil<A>;
    get urlUtil():URLUtil<A>;
    get uuidUtil():UUIDUtil<A>;

    get observableManager():IObservableManager<A>;

    get name():string;

    throw(templateString:string, objects:ArrayLike<any>, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean}):never;
    
    rethrow(error:IError, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean}):never;
    rethrow(error:unknown, templateString:string, objects:ArrayLike<any>, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean}):never;
    
    warn(error:unknown, options?:{errorOnly?:false, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IAborted | IError;
    warn(error:unknown, templateString:string, objects:ArrayLike<any>, options?:{errorOnly?:false, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IAborted | IError;
    warn(error:unknown, options:{errorOnly:true, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IError;
    warn(error:unknown, templateString:string, objects:ArrayLike<any>, options:{errorOnly:true, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IError;
    
    abort(aborted:IAborted, templateString:string, objects:ArrayLike<any>, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function}):IError;
    
    extractOrRethrow<T>(value:T, templateString:string, objects:ArrayLike<any>, options?:{names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean}):Exclude<T, IError>;
    extractOrRethrow<T>(value:T, options?:{objects?:ArrayUtil<any>, names?:({name:string} | string)[], stackTraceFunctionToExclude?:Function, correctable?:boolean}):Exclude<T, IError>;
}