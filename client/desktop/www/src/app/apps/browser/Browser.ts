/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../IApp.ts';
import html from './Browser.html';
import { Window, type IWindowDisplayOptions, type IWindowStorage } from '../../screens/explorer/window/Window.ts';
import { ComponentDecorator } from '../../../library/decorators/ComponentDecorator.ts';
import { WindowElements } from '../../screens/explorer/window/WindowElements.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import type { IViewer } from '../../../library/components/view/IViewer.ts';
import { Signal } from '../../../../../../../shared/src/library/signal/Signal.ts';
import type Electron from 'electron';
import type { IDriveFolder } from '../../../../../../../shared/src/library/file/drive/IDriveFolder.ts';
import { FileType, type IImageFileInfo } from '../../../../../../../shared/src/library/file/drive/IDrive.ts';

export class Elements extends WindowElements
{
    tabView!:HTMLElement;

    homeButton!:HTMLButtonElement;
    backButton!:HTMLButtonElement;
    forwardButton!:HTMLButtonElement;
    refreshButton!:HTMLButtonElement;

    pathTextField!:HTMLInputElement;

    webviewViewer!:HTMLElement;
}

@ComponentDecorator()
export class Browser<A extends IApp<A>> extends Window<A>
{
    private _homeURL = 'https://download.blender.org/peach/bigbuckbunny_movies/';
    private _searchURI = 'https://www.google.com/search?q=';

    public onTabCreatedSignal = new Signal<[Browser<A>, string, Electron.WebviewTag]>(this);
    public onTabUpdatedSignal = new Signal<[Browser<A>, string, Electron.WebviewTag, folder:IDriveFolder<A>]>(this);
    public onTabDestroyedSignal = new Signal<[Browser<A>, string, Electron.WebviewTag]>(this);

    private _webview!:Electron.WebviewTag;
    private _browserFolder!:IDriveFolder<A>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, appID:string, windowID:string, storage:IWindowStorage<A>, displayOptions?:IWindowDisplayOptions) 
    {
        super(app, destructor, element, appID, windowID, storage, displayOptions);
    }

	protected override preprocessHTML(element:HTMLElement):HTMLElement
	{ 
        const contentContainer = this.get<HTMLElement>('windowContent', element, false);
        if (!contentContainer) throw new Error('Could not find window content container');

        contentContainer.innerHTML = html;

        const webviewViewer = this.get<HTMLElement>('webviewViewer', contentContainer)!;
        webviewViewer.appendChild(this._app.bridgeManager.createWebviewElement(this._homeURL));

        return super.preprocessHTML(element);
	}

    public override async init(...args:any):Promise<void> 
    { 
        this.set(this._elements);

        await super.init();

        this.title = this.appName;

        const eventListenerAssistant = this._eventListenerAssistant;
        const elements = this._elements;
        const webviewViewer = elements.webviewViewer.component as IViewer<A>;
        
        this._webview = webviewViewer.current.element as Electron.WebviewTag;

        eventListenerAssistant.subscribe(elements.homeButton, 'click', () => this._webview.loadURL(this._homeURL));
        eventListenerAssistant.subscribe(elements.backButton, 'click', () => this._webview.goBack());
        eventListenerAssistant.subscribe(elements.forwardButton, 'click', () => this._webview.goForward());
        eventListenerAssistant.subscribe(elements.refreshButton, 'click', () => this._webview.reload());
        eventListenerAssistant.subscribe(elements.pathTextField, 'change', () => this.#goto(elements.pathTextField.value));

        const tempFolder = this._app.userManager.systemDrive.tempFolder;
        this._browserFolder = this.abortableHelper.value(await tempFolder.createFolder(this._app.uidUtil.generate(), {compressed:false, app:false, immutable:false, hidden:false, extra:{}}))!;
    }

    public override async ready():Promise<void>
    {
        await super.ready();

        const webview = this._webview;
        this.#createTab(webview);

        this.#goto(this._homeURL);
    }

    #createTab(webview:Electron.WebviewTag):void
    {
        const _ = this.abortableHelper.throwIfAborted();

        const eventListenerAssistant = this._eventListenerAssistant;
        const elements = this._elements;

        eventListenerAssistant.subscribe(webview, 'did-navigate', () => elements.pathTextField.value = this.#beautifyURL(webview.getURL()));
        eventListenerAssistant.subscribe(webview, 'did-navigate-in-page', () => elements.pathTextField.value = this.#beautifyURL(webview.getURL()));
        eventListenerAssistant.subscribe(webview, 'page-title-updated', () => this.title = this.appName + ' - ' + webview.getTitle());
        
        eventListenerAssistant.subscribe(webview, 'did-stop-loading', async () => 
        {
            const webContentsID = webview.getWebContentsId();

            const result = _.value(await this._app.bridgeManager.api.nonStreaming.webView.makeScreenshotOfWebContents(webContentsID));
 
            const imageFileInfo:IImageFileInfo = {type:FileType.Image, bytes:0, mimeType:'image/jpeg', immutable:false, hidden:false, title:webview.getTitle(), url:webview.getURL()};
            const id = `webContentsID_${webContentsID}`;

            await this._browserFolder.createFileIfNotExists(id, imageFileInfo, result, this, {overwrite:true});

            /*
            const success = await this._browserFolder.system.storage.transaction(async (batchAPI:ISyncTransactionAPI):Promise<boolean> => 
            {
                let file = await this._browserFolder.getChild(id, batchAPI) as IStorageFile | undefined;
                if (file === undefined) file = await this._browserFolder.createFile(this.#beautifyURL(webview.getURL()), 'jpg', imageFileInfo, new Data(async () => this._app.streamUtil.fromUint8Array(uint8Array)), {id}, batchAPI);
                else 
                {
                    await file.setName(this.#beautifyURL(webview.getURL()), batchAPI);
                    await file.setBytes(new Data(async () => this._app.streamUtil.fromUint8Array(uint8Array)), batchAPI);
                }
                return file !== undefined;
            });
            */
            
            this.onTabUpdatedSignal.dispatch(this, webview.getAttribute('name')!, webview, this._browserFolder);
        });
        //eventListenerAssistant.subscribe(webview, 'page-favicon-updated', () => this.icon = webview.getFavicon());
        //eventListenerAssistant.subscribe(webview, 'did-start-loading', () => elements.pathTextField.value = this.#beautifyURL(webview.getURL()));
        //eventListenerAssistant.subscribe(webview, 'did-stop-loading', () => elements.pathTextField.value = this.#beautifyURL(webview.getURL()));
        //eventListenerAssistant.subscribe(webview, 'did-fail-load', () => elements.pathTextField.value = this.#beautifyURL(webview.getURL()));
        //eventListenerAssistant.subscribe(webview, 'did-frame-finish-load', () => elements.pathTextField.value = this.#beautifyURL(webview.getURL()));
        //eventListenerAssistant.subscribe(webview, 'did-finish-load', () => elements.pathTextField.value = this.#beautifyURL(webview.getURL()));
        //eventListenerAssistant.subscribe(webview, 'did-get-response-details', () => elements.pathTextField.value = this.#beautifyURL(webview.getURL()));
        //eventListenerAssistant.subscribe(webview, 'did-get-redirect-request', () => elements.pathTextField.value = this.#beautifyURL(webview.getURL()));
        

        this.onTabCreatedSignal.dispatch(this, webview.getAttribute('name')!, webview);
    }

    #beautifyURL(url:string):string
    {
        //remove protocol (http://, https://)
        let beautified = url.replace(/^(http:\/\/|https:\/\/)/, '');
        
        //remove 'www.' if it is the start of the domain
        beautified = beautified.replace(/^www\./, '');
                
        if (beautified.lastIndexOf('/') === beautified.length - 1) beautified = beautified.slice(0, -1);
        
        return beautified;
    }

    async #goto(input:string):Promise<void>
    {
        const processInput = (input:string):string | undefined =>
        {
            const searchURI = this._searchURI;
        
            //trim leading and trailing whitespaces
            input = input.trim();
        
            if (input === '') return undefined;
        
            //check if input includes space - likely a search query
            if (input.includes(' ')) return searchURI + encodeURIComponent(input);
            
            const processHTTP = (input:string):string =>
            {
                if (!input.startsWith('http://') && !input.startsWith('https://')) 
                {
                    //check if it looks like a domain name, localhost, or an IP address
                    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input)) 
                    {
                        //looks like a domain name, prepend 'https://'
                        return 'https://' + input;
                    } 
                    else if (input.startsWith('localhost') || /^\d{1,3}(\.\d{1,3}){3}$/.test(input))
                    {
                        //looks like localhost or an IP address, prepend 'http://'
                        return 'http://' + input;
                    }
                    else 
                    {
                        //if not, treat as a search query
                        return searchURI + encodeURIComponent(input);
                    }
                } 
                else 
                {
                    try
                    {
                        const url = new URL(input);

                        return url.toString();
                    }
                    catch(error)
                    {
                        //if it starts with http:// or https:// but is still invalid, treat as a search query
                        return searchURI + encodeURIComponent(input);
                    }
                }
            }

            try 
            {
                //try to create a new URL object, which will validate the URL
                const url = new URL(input);
                
                return processHTTP(url.toString());
            } 
            catch (error) 
            { 
                //error means it's not a valid URL
                //check if it's missing a protocol
                return processHTTP(input);
            }
        };
        
        const url = processInput(input);
        if (url === undefined) return;

        try
        {
            await this._webview.loadURL(url);
        }
        catch(error:unknown)
        {
            this.log('handled', 'webview navigation, error', error);

            if (this._app.typeUtil.isString(error) === false || error.indexOf('Error: ERR_ABORTED (-3)') === -1) this._webview.loadURL(this._searchURI + encodeURIComponent(input));
        }
    }

    public override get appName()
    {
        return 'Browse';
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}