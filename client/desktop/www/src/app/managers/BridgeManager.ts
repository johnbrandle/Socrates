/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { AppAPI } from "../../../../src/app/api/AppAPI.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { Data } from "../../../../../../shared/src/library/data/Data.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";
import { FileType, type IVideoFileInfo } from "../../../../../../shared/src/library/file/drive/IDrive.ts";
import { GlobalEvent } from "../../library/managers/GlobalListenerManager.ts";
import { ResolvePromise } from "../../../../../../shared/src/library/promise/ResolvePromise.ts";
import { type uid } from "../../library/utils/UIDUtil.ts";
import type { IApp } from "../IApp.ts";
import { ErrorJSONObject } from "../../../../../../shared/src/app/json/ErrorJSONObject.ts";
import type { IError } from "../../../../../../shared/src/library/error/IError.ts";
import { SerializationHelper } from "../bridge/helpers/SerializationHelper.ts";
import type { BridgeAPI } from "../../../../src/library/bridge/BridgeAPI.ts";
import { DevEnvironment } from "../../../../../../shared/src/library/IEnvironment.ts";

/**
 * Use IPC when you dont use it when you don't need streaming, as it is faster (though, this may be due to my stream code). 
 * Currently, only HTTP supports response streaming. HTTP Request streaming is broken due to an electron bug (when sending a 
 * stream to electron the byte order gets jumbled).
 * 
 * I implemented a streaming solution for IPC, but it wasn't any faster than using HTTP, so I did away with it. Though, if 
 * the electron issue doesn't get resolved, I may have to revert back to it.
 */
export const enum CommunicationProtocol
{
    IPC,
    HTTP,
}

export class BridgeManager<A extends IApp<A>> extends DestructableEntity<A>
{
    #_key!:uid;

    #_bridgeAPI:BridgeAPI | undefined = this._app.environment.bridgeAPI;

    #_serializationHelper = new SerializationHelper(this._app);

    #_appAPI_IPC!:AppAPI;
    #_appAPI_HTTP!:AppAPI; 

    #_weakMap:WeakMap<any, ResolvePromise<uid | false>> = new WeakMap();

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }

    public async init():Promise<true | IError>
    {
        try
        {
            if (this.#_bridgeAPI === undefined)
            {
                this.log('bridge not available');
                return true;
            }

            //init the bridge and set the communication key
            this.#_key = await this.#_bridgeAPI.init(this._app.environment.frozen.isLocalhost) || this._app.throw('failed to initialize bridge', []);
            
            //init bridge messages
            this._app.extractOrRethrow(await this.#initMessages());

            //init the api
            this._app.extractOrRethrow(await this.#initAPI());

            if (this._app.environment.frozen.devEnvironment === DevEnvironment.Prod) return true;

            //temp till we add an inspect menu item in our custom context menu
            this._app.globalListenerManager.subscribe(this, GlobalEvent.ContextMenu_Capture, (event:MouseEvent) =>
            {
                //event.preventDefault(); //prevents the browser's default right-click menu from appearing

                const x = event.clientX; //get the horizontal coordinate
                const y = event.clientY; //get the vertical coordinate
                
                this.api.nonStreaming.inspect(x, y);
            });

            this._app.environment.isDevToolsOpen = true;

            this.log('initialized');

            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'init errored', arguments, {errorOnly:true, names:[BridgeManager, this.init]});
        }
    }

    #_onBridgeMessage:((event:string, ...args:any[]) => Promise<void>) | undefined;
    async #initMessages():Promise<true | IError>
    {
        try
        {
            this.#_onBridgeMessage = async (event:string, ...args:any[]) =>
            {
                switch (event)
                {
                    case 'downloadRequest':
                    {
                        const [webContentsID, url, filename, totalBytes] = args;
        
                        const parts:Array<string> = filename.split('.');
        
                        this.log('download request called');
        
                        const videoFileInfo:IVideoFileInfo = {type:FileType.Video, mimeType:'video/mp4', hidden:false, immutable:false, thumbnailInfo:undefined, transcodeInfo:undefined};
        
                        const bridge = this.api.streaming;
                        const file = await this._app.userManager.systemDrive.desktopFolder.createFile(filename, videoFileInfo, new Data(this._app, async () => 
                        {
                            return bridge.webView.downloadFileFromWebContents(webContentsID, url);
                        }), this);
        
                        if (file === undefined) return;
        
                        //this._app.downloadManager.download(url, filename);
                        break;
                    }
                }
        
                this.log('recieved message: ', event, args);
            }

            return (await this.#_bridgeAPI!.subscribe(this.#_key, this.#_onBridgeMessage)) || this._app.throw('failed to subscribe to bridge messages', []);
        }
        catch (error)
        {
            return this._app.warn(error, 'initMessages errored', arguments, {errorOnly:true, names:[BridgeManager, this.#initMessages]});
        }
    }
    
    public async getRemoteObjectUID(proxy:any):Promise<uid | undefined>
    {
        const uid = await this.#_weakMap.get(proxy);

        return uid === false ? undefined : uid;
    }

    #_finalizationRegistry!:FinalizationRegistry<string>;
    async #initAPI():Promise<true | IError>
    {
        try
        {
            //this is used to instantiate API objects
            const onCreate = (path:string[], args:any[]) => 
            {
                const initialized:ResolvePromise<uid | false> = new ResolvePromise();
                let uid:uid;
              
                let proxy:any;

                //create the instance in the main process
                this.api.streaming.createInstance(path, args).then((result) =>
                {
                    try
                    {
                        uid = this._app.extractOrRethrow(result);

                        //register the proxy object and the uid with the finalization registry
                        this.#_finalizationRegistry.register(proxy, uid);

                        //resolve the promise
                        initialized.resolve(uid);
                    }
                    catch (error)
                    {
                        //if we failed to create the instance, we need to resolve promise with false
                        initialized.resolve(false);

                        this._app.rethrow(error, 'createInstance errored', [path, args]);
                    }
                });

                //we create and return the proxy object immediatly, so that the caller can start calling methods on it and so we can use new without await
                proxy = this._app.proxyUtil.createImpersonator(async (path, args) =>
                {
                    try
                    {
                        //we need to wait for the uid to be set before we can call methods on the object
                        if (uid === undefined) 
                        {
                            const success = await initialized; 

                            if (success === false) this._app.throw('failed to create instance', []);
                        }

                        return this.api.streaming.callOnInstance(uid!, path, ...args);
                    }
                    catch (error)
                    {
                        return this._app.warn(error, 'failed to call method on object', [path, args], {names:[BridgeManager, this.#initAPI]});
                    }
                });

                this.#_weakMap.set(proxy, initialized);

                return proxy;
            }

            /**
             * UIDs are associated with a proxy object which is used to call methods on an object in the main process.
             * When the proxy object is garbage collected, we want to release the object in the main process.
             * 
             * This is done by registering the proxy object with a FinalizationRegistry, which will call the callback
             * with the UID of the object when the proxy object is garbage collected. 
             */
            this.#_finalizationRegistry = new FinalizationRegistry((uid:uid) => 
            {
                this.api.streaming.releaseInstance(uid);
            });

            ///setup main api communication (IPC)
            this.#_appAPI_IPC = this._app.proxyUtil.createImpersonator(async (path, args) => 
            {
                try
                {
                    const input = this._app.extractOrRethrow(await this._app.streamUtil.toUint8Array(this._app.extractOrRethrow(await this.#_serializationHelper.toStream(args))));

                    //console.log('calling ipc api', path, args);
                    const output = await this.#_bridgeAPI!.invoke(this.#_key, path, input);
                    if (output === undefined) this._app.throw('no response body', [output], {correctable:true});
                    //console.log('finished calling ipc api', path, args);

                    return this._app.extractOrRethrow(await this.#_serializationHelper.extractValueFromStream(this._app.streamUtil.fromUint8Array(output)), 'extractCallResult errored', [path, args]);
                }
                catch (error)
                {
                    return this._app.warn(error, 'ipc, main api errored, calling {}, {}', [path, args], {names:[BridgeManager, this.#initAPI]});
                }
            }, onCreate);
            
            //setup main api communication (HTTP)
            this.#_appAPI_HTTP = this._app.proxyUtil.createImpersonator(async (path, args) => 
            {
                try
                {
                    const stream = this._app.extractOrRethrow(await this.#_serializationHelper.toStream(args));

                    //i would pass the stream directly to 'getJSON' but it appears there's an electron bug that jumbles the bytes when sending a stream 
                    //so we need to convert the stream to a blob first
                    const uint8Array = this._app.extractOrRethrow(await this._app.streamUtil.toUint8Array(stream));
                    const blob = new Blob([uint8Array], {type:'application/octet-stream'});

                    //console.log('calling http api', path, args);
                    const response = await this._app.networkManager.webClient.getJSON('./bridge.api', {path, key:this.#_key} as JsonObject, blob, false, 1, false);
                    if (response instanceof ErrorJSONObject) this._app.throw(response.toString(), []);
                    if (response.body === undefined) this._app.throw('no response body', [], {correctable:true});
                    //console.log('finished calling http api', path, args);
                    
                    return this._app.extractOrRethrow(await this.#_serializationHelper.extractValueFromStream(response.body));
                }
                catch (error)
                {
                    return this._app.warn(error, 'http, main api errored, calling {}, {}', [path, args], {names:[BridgeManager, this.#initAPI]});
                }
            }, onCreate);

            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'initAPI errored', arguments, {errorOnly:true, names:[BridgeManager, this.#initAPI]});
        }
    }

    /**
     * Creates a webview element with the given src.
     * @param src - the src of the webview
     * @returns - the webview element
     * 
     * @reference https://www.electronjs.org/docs/latest/api/webview-tag
     */
    public createWebviewElement(src:string):Electron.WebviewTag
    {
        const webview = document.createElement('webview') as Electron.WebviewTag;
        webview.setAttribute('name', this._app.uidUtil.generate());
        webview.setAttribute('data-component', 'library/components/view/View');
        webview.setAttribute('src', src);
        webview.setAttribute('partition', 'memory:browserInMemorySession');
        webview.setAttribute('webpreferences', 'devTools=no, nodeIntegration=no, nodeIntegrationInSubFrames=no, sandbox=yes');  

        return webview;
    }

    public get api():{streaming:AppAPI, nonStreaming:AppAPI}
    {
        return {streaming:this.#_appAPI_HTTP, nonStreaming:this.#_appAPI_IPC};
    }

    public get available():boolean
    {
        return this.#_bridgeAPI !== undefined;
    }

    public override async dnit():Promise<boolean>
    {
        if (await super.dnit() !== true) return false;

        if (this.#_onBridgeMessage !== undefined) await this.#_bridgeAPI!.unsubscribe(this.#_key, this.#_onBridgeMessage);

        return true;
    }
}