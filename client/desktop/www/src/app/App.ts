/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { AppModel } from './model/AppModel.ts';
import type { ProgressModal } from './components/modal/ProgressModal.ts';
import type { IApp } from './IApp.ts';
import type { IViewer } from '../library/components/view/IViewer.ts';
import type { ToastNotification } from './components/notification/ToastNotification.ts';
import type { BannerNotification } from './components/notification/BannerNotification.ts';
import { Info } from '../library/components/debug/info/Info.ts';
import { AppRouter } from './router/AppRouter.ts';
import type { IView } from '../library/components/view/IView.ts';
import { BridgeManager } from './managers/BridgeManager.ts';
import { BaseApp } from '../library/BaseApp.ts';
import { UIDUtil, type uid } from '../library/utils/UIDUtil.ts';
import { IAppType } from './IApp.ts';
import { GlobalListenerManager } from '../library/managers/GlobalListenerManager.ts';
import { DragAndDropManager } from '../library/managers/DragAndDropManager.ts';
import { ContextMenuManager } from './managers/ContextMenuManager.ts';
import { DOMUtil } from '../library/utils/DOMUtil.ts';
import { ComponentFactory } from '../library/factories/ComponentFactory.ts';
import { GlobalObserverManager } from '../library/managers/GlobalObserverManager.ts';
import { ObservableManager } from './managers/ObservableManager.ts';
import { ConsoleUtil } from '../library/utils/ConsoleUtil.ts';
import type { IWorkerManager } from '../library/managers/IWorkerManager.ts';
import { WorkerManager } from '../library/managers/WorkerManager.ts';
import { InstanceManager } from './managers/InstanceManager.ts';
import { PerformanceManager } from './managers/PerformanceManager.ts';
import { TranscodeManager } from '../library/managers/TranscodeManager.ts';
import { FileSystemManager } from '../library/managers/FileSystemManager.ts';
import { DownloadManager } from './managers/DownloadManager.ts';
import { UserManager } from './managers/UserManager.ts';
import { WalletManager } from './managers/WalletManager.ts';
import { NetworkManager } from './managers/NetworkManager.ts';
import { LocalStorage } from '../library/storage/LocalStorage.ts';
import { ImplementsDecorator } from '../../../../../shared/src/library/decorators/ImplementsDecorator.ts';
import { SealedDecorator } from '../../../../../shared/src/library/decorators/SealedDecorator.ts';
import { ConfigUtil } from '../../../../../shared/src/library/utils/ConfigUtil.ts';
import type { IError } from '../../../../../shared/src/library/error/IError.ts';
import type { IEnvironment } from './IEnvironment.ts';
import type { IAborted } from '../../../../../shared/src/library/abort/IAborted.ts';
import { AbortableHelper } from '../../../../../shared/src/library/helpers/AbortableHelper.ts';
import { DialogUtil } from './utils/DialogUtil.ts';
import { BrowserUtil } from '../library/utils/BrowserUtil.ts';
import { PDFUtil } from './utils/PDFUtil.ts';
import { ImageUtil } from '../library/utils/ImageUtil.ts';
import { VideoUtil } from '../library/utils/VideoUtil.ts';
import { KeyUtil } from '../library/utils/KeyUtil.ts';
import { BaseUtil } from '../library/utils/BaseUtil.ts';
import { GCUtil } from '../../../../../shared/src/library/utils/GCUtil.ts';
import { DebugUtil } from '../library/utils/DebugUtil.ts';
import { ComponentUtil } from '../library/utils/ComponentUtil.ts';
import { FileUtil } from '../library/utils/FileUtil.ts';
import { TileUtil } from '../library/utils/TileUtil.ts';
import { ValidationUtil } from '../library/utils/ValidationUtil.ts';
import { ArrayUtil } from '../../../../../shared/src/library/utils/ArrayUtil.ts';
import { BigIntUtil } from '../../../../../shared/src/library/utils/BigIntUtil.ts';
import { BitmaskUtil } from '../../../../../shared/src/library/utils/BitmaskUtil.ts';
import { BitUtil } from '../../../../../shared/src/library/utils/BitUtil.ts';
import { ByteUtil } from '../../../../../shared/src/library/utils/ByteUtil.ts';
import { CryptUtil } from '../../../../../shared/src/library/utils/CryptUtil.ts';
import { CSPUtil } from '../../../../../shared/src/library/utils/CSPUtil.ts';
import { HashUtil } from '../library/utils/HashUtil.ts';
import { HMACUtil } from '../library/utils/HMACUtil.ts';
import { IntegerUtil } from '../../../../../shared/src/library/utils/IntegerUtil.ts';
import { JSONUtil } from '../../../../../shared/src/library/utils/JSONUtil.ts';
import { NumberUtil } from '../../../../../shared/src/library/utils/NumberUtil.ts';
import { ObjectUtil } from '../library/utils/ObjectUtil.ts';
import { PromiseUtil } from '../library/utils/PromiseUtil.ts';
import { ProxyUtil } from '../../../../../shared/src/library/utils/ProxyUtil.ts';
import { RequestUtil } from '../../../../../shared/src/library/utils/RequestUtil.ts';
import { ResponseUtil } from '../../../../../shared/src/library/utils/ResponseUtil.ts';
import { SerializationUtil } from '../../../../../shared/src/library/utils/SerializationUtil.ts';
import { StreamUtil } from '../library/utils/StreamUtil.ts';
import { StringUtil } from '../../../../../shared/src/library/utils/StringUtil.ts';
import { TextUtil } from '../../../../../shared/src/library/utils/TextUtil.ts';
import { TypeUtil } from '../../../../../shared/src/library/utils/TypeUtil.ts';
import { URLUtil } from '../../../../../shared/src/library/utils/URLUtil.ts';
import { UUIDUtil } from '../library/utils/UUIDUtil.ts';
import { QRCodeUtil } from './utils/QRCodeUtil.ts';
import { FileSystemUtil } from './utils/FileSystemUtil.ts';
import { DataUtil } from './utils/DataUtil.ts';
import { TOTPUtil } from '../../../../../shared/src/app/utils/TOTPUtil.ts';
import { APIUtil } from '../../../../../shared/src/app/utils/APIUtil.ts';
import { UploadUtil } from '../../../../../shared/src/app/utils/UploadUtil.ts';

class Elements
{
    rootViewer!:HTMLElement;

    progressModal!:HTMLElement;
    toastNotification!:HTMLElement;
    bannerNotification!:HTMLElement;
    info!:HTMLElement;
}

/**
 * @verifyInterfacesTransformer_ignore
 */
@ImplementsDecorator(IAppType)
@SealedDecorator()
export class App extends BaseApp<App> implements IApp<App>
{
    public static get componentContext():{context:WebpackContext, path:string}
    { 
        return {context:require.context('../app', true, /^.\/(apps|components|screens)\/.*\.ts$/, 'eager'), path:'app/'};
    }

    #_browserUtil:BrowserUtil<App> | undefined;
    public get browserUtil():BrowserUtil<App> { return this.#_browserUtil ??= new BrowserUtil<App>(this); }

    #_componentUtil:ComponentUtil<App> | undefined;
    public get componentUtil():ComponentUtil<App> { return this.#_componentUtil ??= new ComponentUtil<App>(this); }

    #_domUtil:DOMUtil<App> | undefined;
    public get domUtil():DOMUtil<App> { return this.#_domUtil ??= new DOMUtil<App>(this); }

    #_fileUtil:FileUtil<App> | undefined;
    public get fileUtil():FileUtil<App> { return this.#_fileUtil ??= new FileUtil<App>(this); }
    
    #_imageUtil:ImageUtil<App> | undefined;
    public get imageUtil():ImageUtil<App> { return this.#_imageUtil ??= new ImageUtil<App>(this); }

    #_tileUtil:TileUtil<App> | undefined;
    public get tileUtil():TileUtil<App> { return this.#_tileUtil ??= new TileUtil<App>(this); }

    #_validationUtil:ValidationUtil<App> | undefined;
    public get validationUtil():ValidationUtil<App> { return this.#_validationUtil ??= new ValidationUtil<App>(this); }

    #_videoUtil:VideoUtil<App> | undefined;
    public get videoUtil():VideoUtil<App> { return this.#_videoUtil ??= new VideoUtil<App>(this); }


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
    public get consoleUtil():ConsoleUtil<App> { return this.#_consoleUtil ??= new ConsoleUtil<App>(this, 'APP'); }

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


    #_apiUtil:APIUtil<App> | undefined;
    public get apiUtil():APIUtil<App> { return this.#_apiUtil ??= new APIUtil<App>(this); }

    #_totpUtil:TOTPUtil<App> | undefined;
    public get totpUtil():TOTPUtil<App> { return this.#_totpUtil ??= new TOTPUtil<App>(this); }

    #_uploadUtil:UploadUtil<App> | undefined;
    public get uploadUtil():UploadUtil<App> { return this.#_uploadUtil ??= new UploadUtil<App>(this); }

    
    #_dataUtil:DataUtil<App> | undefined;
    public get dataUtil():DataUtil<App> { return this.#_dataUtil ??= new DataUtil<App>(this); }

    #_dialogUtil:DialogUtil<App> | undefined;
    public get dialogUtil():DialogUtil<App> { return this.#_dialogUtil ??= new DialogUtil<App>(this); }

    #_fileSystemUtil:FileSystemUtil<App> | undefined;
    public get fileSystemUtil():FileSystemUtil<App> { return this.#_fileSystemUtil ??= new FileSystemUtil<App>(this); }

    #_pdfUtil:PDFUtil<App> | undefined;
    public get pdfUtil():PDFUtil<App> { return this.#_pdfUtil ??= new PDFUtil<App>(this); }

    #_qrCodeUtil:QRCodeUtil<App> | undefined;
    public get qrCodeUtil():QRCodeUtil<App> { return this.#_qrCodeUtil ??= new QRCodeUtil<App>(this); }


    public get uid():uid { return this.uidUtil.derive(this.configUtil.get(true).classes.App.frozen.uid as uid, 'www', true); };

    #_elements = new Elements();

    #_observableManager = new ObservableManager<App>(this, this);
    public get observableManager():ObservableManager<App> { return this.#_observableManager; }

    #_globalObserverManager = new GlobalObserverManager<App>(this, this);
    public get globalObserverManager():GlobalObserverManager<App> { return this.#_globalObserverManager; }

    #_globalListenerManager = new GlobalListenerManager<App>(this, this);
    public get globalListenerManager():GlobalListenerManager<App> { return this.#_globalListenerManager; }

    #_networkManager = new NetworkManager<App>(this, this);
    public get networkManager():NetworkManager<App> { return this.#_networkManager; }

    #_dragAndDropManager = new DragAndDropManager<App>(this, this);
    public get dragAndDropManager():DragAndDropManager<App> { return this.#_dragAndDropManager; }

    #_contextMenuManager = new ContextMenuManager<App>(this, this);
    public get contextMenuManager():ContextMenuManager<App> { return this.#_contextMenuManager; }

    #_workerManager = new WorkerManager<App>(this, this);
    public get workerManager():IWorkerManager<App> { return this.#_workerManager; }

    #_instanceManager = new InstanceManager<App>(this, this);
    public get instanceManager():InstanceManager<App> { return this.#_instanceManager; }

    #_performanceManager = new PerformanceManager<App>(this, this);
    public get performanceManager():PerformanceManager<App> { return this.#_performanceManager; }

    #_transcodeManager = new TranscodeManager<App>(this, this);
    public get transcodeManager():TranscodeManager<App> { return this.#_transcodeManager; }

    #_fileSystemManager = new FileSystemManager<App>(this, this);
    public get fileSystemManager():FileSystemManager<App> { return this.#_fileSystemManager; }


    #_componentFactory = new ComponentFactory<App>(this, this);
    public get componentFactory():ComponentFactory<App> { return this.#_componentFactory; }


    #_userManager = new UserManager<App>(this, this, this.uidUtil.derive(this.uid, 'userManager', true));
    public get userManager():UserManager<App> { return this.#_userManager; }

    #_walletManager = new WalletManager<App>(this, this);
    public get walletManager():WalletManager<App> { return this.#_walletManager; }

    #_bridgeManager = new BridgeManager<App>(this, this);
    public get bridgeManager():BridgeManager<App> { return this.#_bridgeManager; }

    #_downloadManager = new DownloadManager<App>(this, this);
    public get downloadManager():DownloadManager<App> { return this.#_downloadManager; }


    #_model = new AppModel<App>(this, this);
    public get model():AppModel<App> { return this.#_model; }

    #_router = new AppRouter<App>(this, this);
    public override get router():AppRouter<App> { return this.#_router; }

    constructor(environment:IEnvironment) 
    {
        super(environment);
    }

    public override async init():Promise<true | IAborted | IError> 
    {
        try 
        {        
            const _ = new AbortableHelper<App>(this, this).throwIfAborted();

            _.check(await super.init());

            //init any managers that need to be initialized before the app starts
            _.check(await this.#_bridgeManager.init());

            //set elements found in the document body
            this.domUtil.set(document.body, this.#_elements);

            //init the app model
            _.check(await this.#_model.init(new LocalStorage<App>(this, this.uidUtil.derive(this.uid, 'model', true))));

            //attempt to resume a previous session (if one exists)
            _.check(await this.userManager.resumeSession()); 

            //create components, and wait for them to be initialized
            const [_components, promise] = this.componentFactory.createComponents(this, document.body);
            _.check(await promise);

            //wait for the router to navigate to the current url
            _.check(await this.#_router.goto(new URL(document.location.toString()).pathname, {createHistoryEntry:false, goto:false}));

            this.log('initialized');

            if (this.browserUtil.isFirefox() === true) //i really went out of my way to support it, but the CTR implementation issue was the last straw
            {
                await this.dialogUtil.error(this, 
                {
                    title:'Unsupported Browser', 
                    html:`We're sorry, but Firefox is not supported at this time due to unresolved security issues. Please try using another browser.`, 
                    detailsHTML:`
                    <ul>
                        <li>PBKDF2 is slow, <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1854562" target="_blank">2X slower than in Chrome.</a></li>
                        <li>PBKDF2 deriveBits has a 2048 bit limit, <a href="https://bugzilla.mozilla.org/show_bug.cgi?id=1469482" target="_blank">6 year old bug</a>.</li>
                        <li>Invalid AES-CTR implementation, example: encrypting 1-32 bytes with a counter bit length of 1 fails.</li>
                    </ul>`
                });

                this.environment.frozen.redirect('unsupported');
            }
            
            if (this.browserUtil.isSafari() === true) //we can/will support this, but it will take some time
            {
                await this.dialogUtil.error(this, 
                {
                    title:'Unsupported Browser', 
                    html:`We're sorry, but Safari is not supported at this time due to a missing feature. Please try using another browser.`, 
                    detailsHTML:`
                    <ul>
                        <li><a href="https://webkit.org/blog/12257/the-file-system-access-api-with-origin-private-file-system/" target="_blank">Reading/Writing file data is only available in a Web Worker.</a></li>
                    </ul>`
                });

                this.environment.frozen.redirect('unsupported');
            }

            return true;
        }
        catch (e)
        {
            alert('Oh, oh. Something went wrong. Please restart the app to try again.');

            return this.warn(e, 'app errored initializing', arguments, {names:[App, this.init]});
        }
    }

    protected log(...data:any[]):void { this.consoleUtil.log(this.constructor, ...data); }

    public override get name() { return this.configUtil.get(true).app.name; }

    public override get rootView():IView<App> { return this.#_elements.rootViewer.component as IView<App>; }
    public override get rootViewer():IViewer<App> { return this.#_elements.rootViewer.component as IViewer<App>; }
        
    public get progressModal():ProgressModal<App> { return this.#_elements.progressModal.component as ProgressModal<App>; }
    public get toastNotification():ToastNotification<App> { return this.#_elements.toastNotification.component as ToastNotification<App>; }
    public get bannerNotification():BannerNotification<App> { return this.#_elements.bannerNotification.component as BannerNotification<App>; }
    public get info():Info<App> { return this.#_elements.info.component as Info<App>; }
}