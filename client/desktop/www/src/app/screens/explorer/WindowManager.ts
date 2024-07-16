/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../IApp.ts';
import type { Explorer } from './Explorer.ts';
import { Window } from './window/Window.ts';
import { FilesAndFolders } from '../../apps/filesandfolders/FilesAndFolders.ts';
import { Terminal } from '../../apps/terminal/Terminal.ts';
import { Settings } from '../../apps/settings/Settings.ts';
import { AppManager } from '../../apps/appmanager/AppManager.ts';
import type { IWindowDisplayOptions } from './window/Window.ts';
import type { IStorage } from '../../../../../../../shared/src/library/storage/IStorage.ts';
import type { IComponent } from '../../../library/components/IComponent.ts';
import { GCMonitor } from '../../apps/debug/gcmonitor/GCMonitor.ts';
import { Console } from '../../apps/debug/console/Console.ts';
import { DOMTree } from '../../apps/debug/domtree/DOMTree.ts';
import { DestructableEntity } from '../../../../../../../shared/src/library/entity/DestructableEntity.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import { Browser } from '../../apps/browser/Browser.ts';
import { Contacts } from '../../apps/contacts/Contacts.ts';
import { Media } from '../../apps/media/Media.ts';
import { Documents } from '../../apps/documents/Documents.ts';
import { Wallet } from '../../apps/wallet/Wallet.ts';
import { Chat } from '../../apps/_planned/chat/Chat.ts';
import { Share } from '../../apps/_planned/share/Share.ts';
import { PerformanceMonitor } from '../../apps/debug/performancemonitor/PerformanceMonitor.ts';
import { NetworkMonitor } from '../../apps/debug/networkmonitor/NetworkMonitor.ts';
import { DriveStorage } from '../../../../../../../shared/src/library/storage/DriveStorage.ts';
import { type uid } from '../../../library/utils/UIDUtil.ts';

export abstract class WindowManager<A extends IApp<A>> extends DestructableEntity<A>
{
    protected _explorer:Explorer<A>;
    protected _storage:DriveStorage<A>;
    protected _sessionStorage:IStorage<A>;

    constructor(app:A, destructor:IDestructor<A>, uid:uid, explorer:Explorer<A>, storage:DriveStorage<A>, sessionStorage:IStorage<A>)
    {
        super(app, destructor, uid);

        this._explorer = explorer;
        this._storage = storage;
        this._sessionStorage = sessionStorage;
    }

    abstract init():Promise<WindowManager<A>>;
    abstract ready():Promise<void>;

    protected async processDisplayOptions(appID:string, windowID?:string, displayOptions?:IWindowDisplayOptions):Promise<IWindowDisplayOptions | undefined>
    {
        return displayOptions;
    }

    public async createWindow(appID:string, windowID?:string, displayOptions?:IWindowDisplayOptions):Promise<Window<A> | undefined>
    {                
        let appWindow:Window<A> | undefined;
        let app = this._app;

        displayOptions = await this.processDisplayOptions(appID, windowID, displayOptions);

        let element = document.createElement('div');
        element.style.width = '200px';
        element.style.height = '200px';
        this._explorer.windowContainer.appendChild(element);

        let appStorage = new DriveStorage(this._storage, app.uidUtil.derive(this.uid, appID, true)); //create a proxy storage for the app (if not already created)
        //let appLocalStorage = new DriveStorage(this._storage, app.uidUtil.generate(this.uid, appID + 'TEMP', true)); //create a local proxy storage for the app (if not already created)

        let windowStorage;
        if (windowID === undefined) 
        {
            windowID = app.uidUtil.generate();
            windowStorage = new DriveStorage(this._storage, app.uidUtil.derive(this.uid, windowID!, true)); //use the same id for proxy storage as the window id (if not window id is provided, a new one will be generated)
        }
        else windowStorage = new DriveStorage(this._storage, app.uidUtil.derive(this.uid, windowID, true)); //use the same id for proxy storage as the window id
        
        //let windowLocalStorage = new DriveStorage(/*this._localStorage*/ this._storage, app.uidUtil.generate(this.uid, windowID + 'TEMP', true)); //use the same id for local storage as the window id

        let storage = {app:appStorage, window:windowStorage};//{app:{local:appLocalStorage, sync:appStorage}, window:{local:windowLocalStorage, sync:windowStorage}};

        let initPromise:Promise<Array<IComponent<A>>>;
        switch (appID) //switch is temporary till we have a more dynamic way of creating windows
        {
            case 'filesandfolders':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof FilesAndFolders<A>>(this, FilesAndFolders, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            case 'contacts':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof Contacts<A>>(this, Contacts, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            case 'browse':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof Browser<A>>(this, Browser, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            case 'media':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof Media<A>>(this, Media, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            case 'documents':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof Documents<A>>(this, Documents, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            case 'wallet':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof Wallet<A>>(this, Wallet, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            case 'appmanager':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof AppManager<A>>(this, AppManager, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;    
            case 'systemsettings':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof Settings<A>>(this, Settings, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
    
            /// planned apps

            case 'chat':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof Chat<A>>(this, Chat, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            case 'share':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof Share<A>>(this, Share, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            
            /// experimental apps

           

            /// debug apps

            case 'terminal':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof Terminal<A>>(this, Terminal, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            case 'console':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof Console<A>>(this, Console, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            case 'layoutinspector':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof DOMTree<A>>(this, DOMTree, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            case 'performancemonitor':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof PerformanceMonitor<A>>(this, PerformanceMonitor, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            case 'gcmonitor':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof GCMonitor<A>>(this, GCMonitor, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            case 'networkmonitor':
                [appWindow, initPromise] = this._app.componentFactory.createComponent<typeof NetworkMonitor<A>>(this, NetworkMonitor, [appID, windowID, storage, displayOptions], [], [], {name:appID, element:element, log:false});
                break;
            default:
                element.remove();

                this.warn('App not found: ' + appID);

                return undefined;
        }
        await initPromise;

        return appWindow;
    }

    public abstract closeWindow(window:Window<A>):Promise<void>;
    public abstract focusWindow(window:Window<A>):void;
    public abstract getFocusedWindow():Window<A> | undefined;
    public abstract transferWindowToOwnWindow(win:Window<A>, screenX:number, screenY:number):Promise<void>;

    public async getTransferWindowData(transferID:string) //we use a transfer id so we do not put the window id and app id in the url
    {
        return this._sessionStorage.get<{windowID:string, appID:string}>('transferid-' + transferID);
    }

    public async setTransferedWindowData(transferID:string, windowID:string, appID:string):Promise<boolean>
    {
        return this._sessionStorage.set('transferid-' + transferID, {windowID, appID});
    }
}