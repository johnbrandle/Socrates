/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { BrowserWindow, session } from 'electron';
import path from 'path';
import { Store } from '../library/storage/Store.ts';
import { ImplementsDecorator } from '../../../../shared/src/library/decorators/ImplementsDecorator.ts';
import { SealedDecorator } from '../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IError } from '../../../../shared/src/library/error/IError.ts';
import { ConfigUtil } from '../../../../shared/src/library/utils/ConfigUtil.ts';
import { BaseApp } from '../library/BaseApp.ts';
import type { Server } from '../library/Server.ts';
import { type IApp, IAppType } from './IApp.ts';
import type { IEnvironment } from './IEnvironment.ts';
import { ObservableManager } from './managers/ObservableManager.ts';
import { FileMonitorAssistant } from '../library/assistants/FileMonitorAssistant.ts';
import { FolderPath } from '../../../../shared/src/library/file/Path.ts';
import { DevEnvironment } from '../../../../shared/src/library/IEnvironment.ts';
import { ConsoleUtil } from '../../../../shared/src/library/utils/ConsoleUtil.ts';
import { InstanceManager } from '../library/managers/InstanceManager.ts';
import { APIManager } from './managers/APIManager.ts';
import { ArrayUtil } from '../../../../shared/src/library/utils/ArrayUtil.ts';
import { AccessUtil } from '../library/utils/AccessUtil.ts';
import { BigIntUtil } from '../../../../shared/src/library/utils/BigIntUtil.ts';
import { BitmaskUtil } from '../../../../shared/src/library/utils/BitmaskUtil.ts';
import { BitUtil } from '../../../../shared/src/library/utils/BitUtil.ts';
import { ByteUtil } from '../../../../shared/src/library/utils/ByteUtil.ts';
import { CryptUtil } from '../../../../shared/src/library/utils/CryptUtil.ts';
import { CSPUtil } from '../../../../shared/src/library/utils/CSPUtil.ts';
import { GCUtil } from '../../../../shared/src/library/utils/GCUtil.ts';
import { IntegerUtil } from '../../../../shared/src/library/utils/IntegerUtil.ts';
import { JSONUtil } from '../../../../shared/src/library/utils/JSONUtil.ts';
import { NumberUtil } from '../../../../shared/src/library/utils/NumberUtil.ts';
import { ProxyUtil } from '../../../../shared/src/library/utils/ProxyUtil.ts';
import { RequestUtil } from '../../../../shared/src/library/utils/RequestUtil.ts';
import { ResponseUtil } from '../../../../shared/src/library/utils/ResponseUtil.ts';
import { SerializationUtil } from '../../../../shared/src/library/utils/SerializationUtil.ts';
import { StringUtil } from '../../../../shared/src/library/utils/StringUtil.ts';
import { TextUtil } from '../../../../shared/src/library/utils/TextUtil.ts';
import { TypeUtil } from '../../../../shared/src/library/utils/TypeUtil.ts';
import { UIDUtil, type uid } from '../../../../shared/src/library/utils/UIDUtil.ts';
import { URLUtil } from '../../../../shared/src/library/utils/URLUtil.ts';
import { UUIDUtil } from '../../../../shared/src/library/utils/UUIDUtil.ts';
import { BaseUtil } from '../../../../shared/src/library/utils/BaseUtil.ts';
import { DebugUtil } from '../../../../shared/src/library/utils/DebugUtil.ts';
import { HashUtil } from '../../../../shared/src/library/utils/HashUtil.ts';
import { HMACUtil } from '../../../../shared/src/library/utils/HMACUtil.ts';
import { KeyUtil } from '../../../../shared/src/library/utils/KeyUtil.ts';
import { PromiseUtil } from '../../../../shared/src/library/utils/PromiseUtil.ts';
import { ObjectUtil } from '../../../../shared/src/library/utils/ObjectUtil.ts';
import { StreamUtil } from '../../../../shared/src/library/utils/StreamUtil.ts';

let _browserWindow:Electron.BrowserWindow | undefined;

const filterSerializableArguments = (args:any[]):any[] =>
{
    const isBasicSerializableType = (value:any):boolean =>
    {
        const type = typeof value;
        return type === 'boolean' || type === 'string' || type === 'number' || type === 'undefined';
    }

    const containsOnlySerializableTypes = (obj:any):boolean => 
    {    
        const stack = [obj];
    
        while (stack.length > 0) 
        {
            const current = stack.pop();
    
            if (isBasicSerializableType(current) === true)  continue;
    
            if (Array.isArray(current) || (typeof current === 'object' && current !== null && current.constructor === Object)) for (const key in current) if (current.hasOwnProperty(key)) stack.push(current[key]);
            else return false;
        }
    
        return true;
    }

    return args.filter(arg => isBasicSerializableType(arg) || containsOnlySerializableTypes(arg));
}

const originalLog = console.log;
console.log = (...args) =>
{
    originalLog.apply(this, args);

    _browserWindow?.webContents.send('log', ...filterSerializableArguments(args)); //so bridge can log the messages
}

const originalWarn = console.warn;
console.warn = (...args) =>
{
    originalWarn.apply(this, args);

    _browserWindow?.webContents.send('warn', ...filterSerializableArguments(args)); //so bridge can log the messages
}

const originalError = console.error;
console.error = (...args) =>
{
    originalError.apply(this, args);
    
    _browserWindow?.webContents.send('error', ...filterSerializableArguments(args)); //so bridge can log the messages
}

@ImplementsDecorator(IAppType)
@SealedDecorator()
export class App extends BaseApp<App> implements IApp<App>
{
   #_accessUtil:AccessUtil<App> | undefined;
    public get accessUtil():AccessUtil<App> { return this.#_accessUtil ??= new AccessUtil<App>(this); }

    #_arrayUtil:ArrayUtil<App> | undefined;
    public get arrayUtil():ArrayUtil<App> { return this.#_arrayUtil ??= new ArrayUtil<App>(this); }

    #_baseUtil:BaseUtil<App> | undefined;
    public get baseUtil():BaseUtil<App> { return this.#_baseUtil ??= new BaseUtil<App>(this); }

    #_bigIntUtil:BigIntUtil<App> | undefined;
    public get bigIntUtil():BigIntUtil<App> { return this.#_bigIntUtil ??= new BigIntUtil<App>(this); }

    #_bitmaskUtil:BitmaskUtil<App> | undefined;
    public get bitmaskUtil():BitmaskUtil<App> { return this.#_bitmaskUtil ??= new BitmaskUtil<App>(this); }

    #_bitUtil:BitUtil<App> | undefined;
    public get bitUtil():BitUtil<App> { return this.#_bitUtil ??= new BitUtil<App>(this); }

    #_byteUtil:ByteUtil<App> | undefined;
    public get byteUtil():ByteUtil<App> { return this.#_byteUtil ??= new ByteUtil<App>(this); }

    #_configUtil:ConfigUtil<App> | undefined;
    public get configUtil():ConfigUtil<App> { return this.#_configUtil ??= new ConfigUtil<App>(this); }

    #_consoleUtil:ConsoleUtil<App> | undefined;
    public get consoleUtil():ConsoleUtil<App> { return this.#_consoleUtil ??= new ConsoleUtil<App>(this, 'ELECTRON APP'); }

    #_cryptUtil:CryptUtil<App> | undefined;
    public get cryptUtil():CryptUtil<App> { return this.#_cryptUtil ??= new CryptUtil<App>(this); }

    #_cspUtil:CSPUtil<App> | undefined;
    public get cspUtil():CSPUtil<App> { return this.#_cspUtil ??= new CSPUtil<App>(this); }

    #_dateUtil:DebugUtil<App> | undefined;
    public get debugUtil():DebugUtil<App> { return this.#_dateUtil ??= new DebugUtil<App>(this); }

    #_gcUtil:GCUtil<App> | undefined;
    public get gcUtil():GCUtil<App> { return this.#_gcUtil ??= new GCUtil<App>(this); }

    #_hashUtil:HashUtil<App> | undefined;
    public get hashUtil():HashUtil<App> { return this.#_hashUtil ??= new HashUtil<App>(this); }

    #_hmacUtil:HMACUtil<App> | undefined;
    public get hmacUtil():HMACUtil<App> { return this.#_hmacUtil ??= new HMACUtil<App>(this); }

    #_integerUtil:IntegerUtil<App> | undefined;
    public get integerUtil():IntegerUtil<App> { return this.#_integerUtil ??= new IntegerUtil<App>(this); }

    #_jsonUtil:JSONUtil<App> | undefined;
    public get jsonUtil():JSONUtil<App> { return this.#_jsonUtil ??= new JSONUtil<App>(this); }

    #_keyUtil:KeyUtil<App> | undefined;
    public get keyUtil():KeyUtil<App> { return this.#_keyUtil ??= new KeyUtil<App>(this); }

    #_numberUtil:NumberUtil<App> | undefined;
    public get numberUtil():NumberUtil<App> { return this.#_numberUtil ??= new NumberUtil<App>(this); }

    #_objectUtil:ObjectUtil<App> | undefined;
    public get objectUtil():ObjectUtil<App> { return this.#_objectUtil ??= new ObjectUtil<App>(this); }

    #_promiseUtil:PromiseUtil<App> | undefined;
    public get promiseUtil():PromiseUtil<App> { return this.#_promiseUtil ??= new PromiseUtil<App>(this); }

    #_proxyUtil:ProxyUtil<App> | undefined;
    public get proxyUtil():ProxyUtil<App> { return this.#_proxyUtil ??= new ProxyUtil<App>(this); }

    #_requestUtil:RequestUtil<App> | undefined;
    public get requestUtil():RequestUtil<App> { return this.#_requestUtil ??= new RequestUtil<App>(this); }

    #_responseUtil:ResponseUtil<App> | undefined;
    public get responseUtil():ResponseUtil<App> { return this.#_responseUtil ??= new ResponseUtil<App>(this); }

    #_serializationUtil:SerializationUtil<App> | undefined;
    public get serializationUtil():SerializationUtil<App> { return this.#_serializationUtil ??= new SerializationUtil<App>(this); }

    #_streamUtil:StreamUtil<App> | undefined;
    public get streamUtil():StreamUtil<App> { return this.#_streamUtil ??= new StreamUtil<App>(this); }

    #_stringUtil:StringUtil<App> | undefined;
    public get stringUtil():StringUtil<App> { return this.#_stringUtil ??= new StringUtil<App>(this); }

    #_textUtil:TextUtil<App> | undefined;
    public get textUtil():TextUtil<App> { return this.#_textUtil ??= new TextUtil<App>(this); }

    #_typeUtil:TypeUtil<App> | undefined;
    public get typeUtil():TypeUtil<App> { return this.#_typeUtil ??= new TypeUtil<App>(this); }

    #_uidUtil:UIDUtil<App> | undefined;
    public get uidUtil():UIDUtil<App> { return this.#_uidUtil ??= new UIDUtil<App>(this); }

    #_urlUtil:URLUtil<App> | undefined;
    public get urlUtil():URLUtil<App> { return this.#_urlUtil ??= new URLUtil<App>(this); }

    #_uuidUtil:UUIDUtil<App> | undefined;
    public get uuidUtil():UUIDUtil<App> { return this.#_uuidUtil ??= new UUIDUtil<App>(this); }


    public get uid():uid { return this.throw('uid not implemented', [], {correctable:true}); }

    #_contentPath:FolderPath;
    public get contentPath():FolderPath { return this.#_contentPath; }
    
    #_dataPath:FolderPath;
    public get dataPath():FolderPath { return this.#_dataPath; }

    #_server:Server;
    
    #_store!:Store;

    #_session!:Electron.Session;

    #_browserWindow!:BrowserWindow;

    #_observableManager = new ObservableManager<App>(this, this);
    public get observableManager():ObservableManager<App> { return this.#_observableManager; }

    #_instanceManager = new InstanceManager<App>(this, this);
    public get instanceManager():InstanceManager<App> { return this.#_instanceManager; }

    #_apiManager:APIManager<App> = new APIManager(this, this);
    public get apiManager():APIManager<App> { return this.#_apiManager; }

    constructor(environment:IEnvironment, props:{server:Server, contentPath:FolderPath, dataPath:FolderPath}) 
    {
        super(environment);

        this.#_server = props.server;
        this.#_contentPath = props.contentPath;
        this.#_dataPath = props.dataPath;
    }

    public override async init():Promise<true | IError> 
    {
        try 
        {        
            this.extractOrRethrow(await super.init());

            //init any managers that need to be initialized before the app starts

            //init the app model

            //create an in-memory session
            this.#_session = session.fromPartition('memory:appInMemorySession', {cache:false});

            //for storing app data such as last window size and position
            this.#_store = new Store({});

            this.#_server.init(this);

            //options for the main window
            const options:Electron.BrowserWindowConstructorOptions = 
            {
                width:1024, height:768, minWidth:1024, minHeight:768, show:false,  
                webPreferences:
                {
                    nodeIntegration:false, 
                    devTools:this.environment.frozen.devEnvironment !== DevEnvironment.Prod, 
                    contextIsolation:true, 
                    sandbox:true, 
                    webSecurity:true, 
                    preload:path.join(__dirname, 'bridge.bundle.js'),
                    session:this.#_session,
                    webviewTag:true,
                    plugins:true
                },
                ...this.#_store.get('bounds') as any
            };

            //if we are in debug mode, enable the dev tools and set the window to always be on top
            //also watch the app content path for changes and reload the window when changes are detected
            if (this.environment.frozen.isDebug === true)
            {
                const onAppFileChanged = (app:Electron.App):boolean => 
                {
                    //remember the window size and position
                    this.#_store.set('bounds', this.#_browserWindow.getBounds());

                    //reload the app
                    app.relaunch(); 
                    app.exit(0);

                    return true;
                };
                const onChange = (browserWindow:BrowserWindow) => browserWindow.webContents.reloadIgnoringCache();

                new FileMonitorAssistant<App>(this, this.#_contentPath.toString(), FolderPath.normalize(__dirname), onAppFileChanged, onChange, {ignore:['src']});
                
                options.alwaysOnTop = true;
                options.webPreferences!.devTools = true;
            }    

            //create the main window
            this.#_browserWindow = _browserWindow = new BrowserWindow(options);  
            //this.#_browserWindow.setContentProtection(true);
            this.#_browserWindow.once('ready-to-show', () => this.#_browserWindow.show());
            this.#_browserWindow.on('close', () => this.#_store.set('bounds', this.#_browserWindow.getBounds())); //save window size and position

            this.#_browserWindow.webContents.on('did-finish-load', () => 
            {
            });

            //handle webview downloads
            this.#_browserWindow.webContents.on('did-attach-webview', (event, webContents) => 
            {   
                webContents.session.on('will-download', async (event, item:Electron.DownloadItem, webContents) =>
                {
                    console.log('will-download', item.getURL(), item.getFilename(), item.getTotalBytes());

                    //prevent the default saving of the file
                    event.preventDefault();
        
                    const url = item.getURL();
                    const filename = item.getFilename();
                    const totalBytes = item.getTotalBytes();
        
                    this.#_browserWindow.webContents.send('renderer', 'downloadRequest', webContents.id, url, filename, totalBytes);
                });
        
                return true;
            });

            //'a' represents nothing, just put that there so we don't have to be concerned about the ?
            let query = environment.frozen.isDebug === true ? '?d' : '?a'; 

            //load the main window
            await this.#_server.loadURL(this.#_browserWindow, query);

            //if we are in debug mode, open dev tools
            if (this.environment.frozen.devEnvironment !== DevEnvironment.Prod) this.#_browserWindow.webContents.openDevTools();

            this.consoleUtil.log(this.constructor, 'app initialized');

            return true;
        }
        catch (error)
        {
            return this.warn(error, 'app errored initializing', arguments, {errorOnly:true, names:[this.constructor, this.init]});
        }
    }

    public get browserWindow():BrowserWindow
    {
        return this.#_browserWindow;
    }

    public get server():Server
    {
        return this.#_server;
    }

    public get session():Electron.Session
    {
        return this.#_session;
    }

    public override get name() { return this.configUtil.get(true).app.name; }
}