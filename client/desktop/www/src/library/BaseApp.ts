/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "./IBaseApp.ts";
import { IBaseAppType } from "./IBaseApp.ts";
import { type IGlobalListenerMap } from './managers/GlobalListenerManager.ts';
import type { IViewer } from './components/view/IViewer.ts';
import type { IRouter } from './router/IRouter.ts';
import { ConsoleUtil } from './utils/ConsoleUtil.ts';
import type { IView } from './components/view/IView.ts';
import { GCUtil } from "../../../../../shared/src/library/utils/GCUtil.ts";
import type { IObservableManager } from "../../../../../shared/src/library/managers/IObservableManager.ts";
import type { INetworkManager } from "./managers/INetworkManager.ts";
import type { IComponentFactory } from "./factories/IComponentFactory.ts";
import type { IGlobalObserverManager } from "./managers/IGlobalObserverManager.ts";
import type { IGlobalObserverMap } from "./managers/GlobalObserverManager.ts";
import type { IGlobalListenerManager } from "./managers/IGlobalListenerManager.ts";
import type { IDragAndDropManager } from "./managers/IDragAndDropManager.ts";
import type { IContextMenuManager } from "./managers/IContextMenuManager.ts";
import type { IWorkerManager } from "./managers/IWorkerManager.ts";
import { DebugUtil } from "./utils/DebugUtil.ts";
import { BaseUtil } from "./utils/BaseUtil.ts";
import { VideoUtil } from "./utils/VideoUtil.ts";
import { ImageUtil } from "./utils/ImageUtil.ts";
import type { IInstanceManager } from "./managers/IInstanceManager.ts";
import { IDestructorType } from "../../../../../shared/src/library/IDestructor.ts";
import type { IDestructable } from "../../../../../shared/src/library/IDestructable.ts";
import { KeyUtil } from "./utils/KeyUtil.ts";
import type { IPerformanceManager } from "./managers/IPerformanceManager.ts";
import type { ITranscodeManager } from "./managers/ITranscodeManager.ts";
import type { IFileSystemManager } from "./managers/IFileSystemManager.ts";
import { IUIdentifiableType } from "../../../../../shared/src/library/IUIdentifiable.ts";
import { UIDUtil, type uid } from "./utils/UIDUtil.ts";
import { ImplementsDecorator } from "../../../../../shared/src/library/decorators/ImplementsDecorator.ts";
import { ConfigUtil } from "../../../../../shared/src/library/utils/ConfigUtil.ts";
import { IBaseAppType as ISharedBaseAppType } from "../../../../../shared/src/library/IBaseApp.ts";
import type { IError } from "../../../../../shared/src/library/error/IError.ts";
import type { IEnvironment } from "./IEnvironment.ts";
import { IAbortableType, type IAbortable } from "../../../../../shared/src/library/abort/IAbortable.ts";
import type { IWeakSignal } from "../../../../../shared/src/library/signal/IWeakSIgnal.ts";
import { WeakSignal } from "../../../../../shared/src/library/signal/WeakSignal.ts";
import type { IAborted } from "../../../../../shared/src/library/abort/IAborted.ts";
import type { IComponent } from "./components/IComponent.ts";
import type { ArrayUtil } from "../../../../../shared/src/library/utils/ArrayUtil.ts";
import type { BigIntUtil } from "../../../../../shared/src/library/utils/BigIntUtil.ts";
import type { BitmaskUtil } from "../../../../../shared/src/library/utils/BitmaskUtil.ts";
import type { BitUtil } from "../../../../../shared/src/library/utils/BitUtil.ts";
import type { ByteUtil } from "../../../../../shared/src/library/utils/ByteUtil.ts";
import type { CryptUtil } from "../../../../../shared/src/library/utils/CryptUtil.ts";
import type { CSPUtil } from "../../../../../shared/src/library/utils/CSPUtil.ts";
import type { HashUtil } from "./utils/HashUtil.ts";
import type { HMACUtil } from "./utils/HMACUtil.ts";
import type { IntegerUtil } from "../../../../../shared/src/library/utils/IntegerUtil.ts";
import type { JSONUtil } from "../../../../../shared/src/library/utils/JSONUtil.ts";
import type { NumberUtil } from "../../../../../shared/src/library/utils/NumberUtil.ts";
import type { ObjectUtil } from "./utils/ObjectUtil.ts";
import type { PromiseUtil } from "./utils/PromiseUtil.ts";
import type { ProxyUtil } from "../../../../../shared/src/library/utils/ProxyUtil.ts";
import type { RequestUtil } from "../../../../../shared/src/library/utils/RequestUtil.ts";
import type { ResponseUtil } from "../../../../../shared/src/library/utils/ResponseUtil.ts";
import type { SerializationUtil } from "../../../../../shared/src/library/utils/SerializationUtil.ts";
import type { StreamUtil } from "./utils/StreamUtil.ts";
import type { StringUtil } from "../../../../../shared/src/library/utils/StringUtil.ts";
import type { TextUtil } from "../../../../../shared/src/library/utils/TextUtil.ts";
import type { TypeUtil } from "../../../../../shared/src/library/utils/TypeUtil.ts";
import type { URLUtil } from "../../../../../shared/src/library/utils/URLUtil.ts";
import type { UUIDUtil } from "./utils/UUIDUtil.ts";
import type { BrowserUtil } from "./utils/BrowserUtil.ts";
import type { ValidationUtil } from "./utils/ValidationUtil.ts";
import type { TileUtil } from "./utils/TileUtil.ts";
import type { FileUtil } from "./utils/FileUtil.ts";
import type { DOMUtil } from "./utils/DOMUtil.ts";
import type { ComponentUtil } from "./utils/ComponentUtil.ts";
import { CorrectableError } from "../../../../../shared/src/library/error/CorrectableError.ts";
import { Error } from "../../../../../shared/src/library/error/Error.ts";

/**
 * @verifyInterfacesTransformer_ignore
 */
@ImplementsDecorator(ISharedBaseAppType, IBaseAppType, IDestructorType, IAbortableType, IUIdentifiableType)
export abstract class BaseApp<A extends IBaseApp<A>, R=any> implements IBaseApp<A, R>
{
    public abstract get uid():uid;

    #_destructables:Set<IDestructable<A> | (() => Promise<any>)> = new Set();
    public addDestructable(destructable:IDestructable<A> | (() => Promise<any>)):void { this.#_destructables.add(destructable); }
    public removeDestructable(destructable:IDestructable<A> | (() => Promise<any>)):boolean { return this.#_destructables.delete(destructable); }
    public get app():A { return this as unknown as A; }

    public get aborted():boolean { return false; }    
    public get reason():string { return this.throw('Method not implemented.', [], {correctable:true}); }
    public get result():R { return this.throw('Method not implemented.', [], {correctable:true}); }
    public get signal():AbortSignal { return this.throw('Method not implemented.', [], {correctable:true}); }
    public addAbortable(_abortable:IAbortable):void { this.throw('Method not implemented.', [], {correctable:true}); }
    
    #_onAbortedSignal:IWeakSignal<[IAbortable<R>, string, R | undefined]> | undefined;
    public get onAbortedSignal():IWeakSignal<[IAbortable<R>, string, R | undefined]> { return this.#_onAbortedSignal ?? (this.#_onAbortedSignal = new WeakSignal(this)); }

    #_environment:IEnvironment;
    get environment():IEnvironment { return this.#_environment; }

    constructor(environment:IEnvironment) 
    {
        this.#_environment = environment;
    }

    /**
     * 
     * @forceSuperTransformer_forceSuperCall
     */
    public async init():Promise<true | IAborted | IError>
    {
        if (crossOriginIsolated !== true) this.throw('crossOriginIsolated must be true, see: https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory', [], {correctable:true});

        return true;
    }

    public abstract get browserUtil():BrowserUtil<A>;
    public abstract get componentUtil():ComponentUtil<A>;
    public abstract get domUtil():DOMUtil<A>;
    public abstract get fileUtil():FileUtil<A>;
    public abstract get imageUtil():ImageUtil<A>;
    public abstract get tileUtil():TileUtil<A>;
    public abstract get validationUtil():ValidationUtil<A>;
    public abstract get videoUtil():VideoUtil<A>;

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
    public abstract get globalListenerManager():IGlobalListenerManager<A, IGlobalListenerMap>;
    public abstract get globalObserverManager():IGlobalObserverManager<A, IGlobalObserverMap>;
    public abstract get networkManager():INetworkManager<A>;
    public abstract get dragAndDropManager():IDragAndDropManager<A>;
    public abstract get contextMenuManager():IContextMenuManager<A>;
    public abstract get workerManager():IWorkerManager<A>;
    public abstract get instanceManager():IInstanceManager<A>;
    public abstract get performanceManager():IPerformanceManager<A>;
    public abstract get transcodeManager():ITranscodeManager<A>;
    public abstract get fileSystemManager():IFileSystemManager<A>;

    public abstract get name():string;
    public abstract get router():IRouter<A>;
    public abstract get rootView():IView<A>;
    public abstract get rootViewer():IViewer<A>;

    public abstract get componentFactory():IComponentFactory<A>;

    public abstract get info():
    {
        show:(component:IComponent<A>) => void;
        hide:(component:IComponent<A>) => void;
        update:(component:IComponent<A>, id:string, value:string) => void;
    }

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