/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../IApp.ts';
import type { Explorer } from './Explorer.ts';
import { Window } from './window/Window.ts';
import type { IWindowDisplayOptions } from './window/Window.ts';
import type { IStorage } from '../../../../../../../shared/src/library/storage/IStorage.ts';
import { WindowManager } from './WindowManager.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import { EventListenerAssistant } from '../../../library/assistants/EventListenerAssistant.ts';
import type { DriveStorage } from '../../../../../../../shared/src/library/storage/DriveStorage.ts';
import type { uid } from '../../../library/utils/UIDUtil.ts';

/**
 * Manages a single window for the application.
 */
export class SingleWindowManager<A extends IApp<A>> extends WindowManager<A>
{
    private _window:Window<A> | undefined;

    private _eventListenerAssistant!:EventListenerAssistant<A>;

    /**
     * Creates a new SingleWindowManager instance.
     * @param app - The IApp instance.
     * @param explorer - The Explorer instance.
     * @param storage - The ISyncStorage instance.
     * @param localStorage - The ISyncStorage instance for local storage.
     * @param sessionStorage - The IStorage instance for session storage.
     */
    constructor(app:A, destructor:IDestructor<A>, uid:uid, explorer:Explorer<A>, storage:DriveStorage<A>, /*localStorage:SyncStorage,*/ sessionStorage:IStorage<A>)
    {
        super(app, destructor, uid, explorer, storage, /*localStorage,*/ sessionStorage);
    }

    /**
     * Initializes the SingleWindowManager instance.
     * 
     * @returns A Promise that resolves with the initialized SingleWindowManager instance.
     */
    public async init():Promise<SingleWindowManager<A>>
    {
        this._eventListenerAssistant = new EventListenerAssistant(this._app, this);
        
        //this will close all popups when the parent window closes, because the parent window will dispatch this event with an empty transferID, which indicates all transferred windows should close
        this._eventListenerAssistant.subscribe(window.opener, 'transferWindow', this.#onTransferWindowListened);

        return this;
    }

    #onTransferWindowListened = (event:TransferWindowCustomEvent) =>
    {
        this._eventListenerAssistant.unsubscribe(window.opener, 'transferWindow');

        if (!event.detail.transferID) window.close();
    }

    /**
     * It retrieves the transfer ID from the URL, gets the transfer window data, 
     * creates a new app window, and sets the focus to the new window.
     * @returns A Promise that resolves when the method completes successfully.
     * @throws An error if no transfer ID is provided.
     */
    public async ready():Promise<void>
    {
        const url = new URL(window.location.href);
        const transferID = url.searchParams.get('transferID');
        if (!transferID) throw new Error('No transfer id provided');

        const transferWindowData = await this.getTransferWindowData(transferID); 
        if (!transferWindowData) throw new Error('No transfer window data found');

        this._eventListenerAssistant.subscribe(window.opener, 'beforeunload', this.#onBeforeUnloadListened, {capture:true});
        this._eventListenerAssistant.subscribe(window.opener, 'unload', this.#onUnloadListened, {capture:true});

        if (!transferWindowData.windowID || !transferWindowData.appID) 
        {
            alert('No window id or app id provided');
            window.close();
            return;
        }
        
       let appWindow = await super.createWindow(transferWindowData.appID, transferWindowData.windowID);
        if (!appWindow) 
        {
            alert('Failed to create window');
            window.close(); //close the window if the app window could not be created
            return;
        }

        this._window = appWindow;

        this.focusWindow(appWindow);
    }

    #onBeforeUnloadListened = () =>
    {
        this._eventListenerAssistant.unsubscribe(window.opener, 'beforeunload');
        this._eventListenerAssistant.unsubscribe(window.opener, 'unload');

        window.close();
    }

    #onUnloadListened = () =>
    {
        this._eventListenerAssistant.unsubscribe(window.opener, 'beforeunload');
        this._eventListenerAssistant.unsubscribe(window.opener, 'unload');

        window.close();
    }

    public override async createWindow(appID:string, windowID?:string, displayOptions?:IWindowDisplayOptions, restoringState:boolean=false):Promise<Window<A> | undefined>
    {
        throw new Error('Cannot create window in single window mode');
    }

    public focusWindow(window:Window<A>):void 
    {
        if (window !== this._window) throw new Error('Cannot focus window that is not in own window mode');

        window.onFocus(true);
    }

    public getFocusedWindow():Window<A> | undefined
    {
        return undefined;
    }

    public async transferWindowToOwnWindow(win:Window<A>, screenX:number, screenY:number)
    {
        throw new Error('Window already transferred');
    }

    public async closeWindow(appWindow:Window<A>)
    {
        if (appWindow !== this._window) throw new Error('Cannot close window that is not in own window mode');

        window.close(); //close the browser popup window
    }
}