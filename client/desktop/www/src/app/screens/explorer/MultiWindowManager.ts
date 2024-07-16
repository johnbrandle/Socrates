/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../IApp.ts';
import type { Explorer } from './Explorer.ts';
import { Window } from './window/Window.ts';
import { GlobalEvent } from '../../../library/managers/GlobalListenerManager.ts';
import type { IWindowDisplayOptions } from './window/Window.ts';
import { ToastNotification } from '../../components/notification/ToastNotification.ts';
import type { IStorage } from '../../../../../../../shared/src/library/storage/IStorage.ts';
import { BackedArrayStore } from '../../../../../../../shared/src/library/storage/store/BackedArrayStore.ts';
import { WindowManager } from './WindowManager.ts';
import { ArrayStore } from '../../../../../../../shared/src/library/storage/store/ArrayStore.ts';
import { BackedObjectStore } from '../../../../../../../shared/src/library/storage/store/BackedObjectStore.ts';
import { PrimitiveStore } from '../../../../../../../shared/src/library/storage/store/PrimitiveStore.ts';
import { ObjectStore } from '../../../../../../../shared/src/library/storage/store/ObjectStore.ts';
import { GroupStore } from '../../../../../../../shared/src/library/storage/store/GroupStore.ts';
import { RestoreState } from '../../../../../../../shared/src/library/storage/store/RestoreState.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import { EventListenerAssistant } from '../../../library/assistants/EventListenerAssistant.ts';
import type { DriveStorage } from '../../../../../../../shared/src/library/storage/DriveStorage.ts';
import { type uid } from '../../../library/utils/UIDUtil.ts';
import type { IError } from '../../../../../../../shared/src/library/error/IError.ts';
import type { IAborted } from '../../../../../../../shared/src/library/abort/IAborted.ts';

const Z_INDEX_MIN = 100;
const TRANSFER_WINDOW_EVENT_NAME = 'transferWindow';

enum GroupStoreName
{
    Window = 'window',
    Offset = 'offset'
}

/**
 * MultiWindowManager class manages multiple windows in an application.
 */
export class MultiWindowManager<A extends IApp<A>> extends WindowManager<A>
{
    private _windows:BackedArrayStore<A, Window<A>, {appID:string, windowID:string, zIndex:number}>; //open windows
    private _focusedWindow:BackedObjectStore<A, Window<A>, string>;
    private _maxZIndex:PrimitiveStore<A, number>;

    private _transferredWindows:ArrayStore<A, string>; //transferred windows
    
    private _lastXOffset:PrimitiveStore<A, number>;
    private _lastYOffset:PrimitiveStore<A, number>;

    private _groupStores:Record<GroupStoreName, GroupStore<A>>;

    private _eventListenerAssistant:EventListenerAssistant<A>;

    /**
     * MultiWindowManager class manages multiple windows in an application.
     * @param app - The IApp instance.
     * @param explorer - The Explorer instance.
     * @param storage - The ISyncStorage instance for storing data in the local storage.
     * @param localStorage - The ISyncStorage instance for storing data in the local storage.
     * @param sessionStorage - The IStorage instance for storing data in the session storage.
     */
    constructor(app:A, destructor:IDestructor<A>, uid:uid, explorer:Explorer<A>, storage:DriveStorage<A>, /*localStorage:IStorage*/ sessionStorage:IStorage<A>)
    {
        super(app, destructor, uid, explorer, storage, /*localStorage,*/ sessionStorage);

        this._eventListenerAssistant = new EventListenerAssistant(app, this);

        //create the Window group of stores
        this._maxZIndex = new PrimitiveStore<A, number>(this._storage, 'maxZIndex', Z_INDEX_MIN);
        this._windows = new BackedArrayStore(this._storage, 'windows', async (data:{appID:string, windowID:string, zIndex:number}) =>
        {
            let window = await super.createWindow(data.appID, data.windowID, undefined);
            if (window === undefined) 
            {
                console.warn(`Window with id ${data.windowID} not found`);
                return undefined;
            }

            window.element.style.zIndex = String(data.zIndex);

            return window;
        },
        (window:Window<A>) => 
        {
            return {appID:window.appID, windowID:window.windowID, zIndex:parseInt(window.element.style.zIndex)}
        });

        this._focusedWindow = new BackedObjectStore<A, Window<A>, string>(this._storage, 'focusedWindow', async (windowID:string) => 
        {
            let window = this._windows.find(window => window.windowID === windowID);
            if (window === undefined) 
            {
                console.warn(`Focused window with id ${windowID} not found`);
                return undefined;
            }
            
            return window;
        }, (window:Window<A>):string => window.windowID);

        const windowGroup = new GroupStore(this._app, [this._maxZIndex, this._windows, this._focusedWindow]);
        
        //create the transfers window store
        this._transferredWindows = new ArrayStore<A, string>(this._sessionStorage, 'transfers');
        
        //create the Offset group of stores
        this._lastXOffset = new PrimitiveStore<A, number>(this._storage, 'lastXOffset', 0);
        this._lastYOffset = new PrimitiveStore<A, number>(this._storage, 'lastYOffset', 0);
        const offsetGroup = new GroupStore(this._app, [this._lastXOffset, this._lastYOffset]);

        //set the group stores record
        this._groupStores = {[GroupStoreName.Window]: windowGroup, [GroupStoreName.Offset]: offsetGroup};
    }

    /**
     * Initializes the MultiWindowManager instance by subscribing to the globalObserver's DOWN event and adding a listener for the TRANSFER_WINDOW_EVENT_NAME event.
     * @returns A Promise that resolves with the MultiWindowManager instance.
     */
    public async init():Promise<MultiWindowManager<A>>
    {
        //listen for click event on a window to focus it
        this._app.globalListenerManager.subscribe(this, GlobalEvent.Down, (event:PointerEvent) => this.onDownListened(event));

        //this event fires by a window when it is transferred to its own popup window or when the popup window is closed (transferred back to the parent window)
        this._eventListenerAssistant.subscribe(window, TRANSFER_WINDOW_EVENT_NAME, this.#initTransferredWindowListener);

        return this;
    }

    /**
     * Cleans up the MultiWindowManager instance by removing event listeners and unsubscribing from the global observer.
     */
    public override async dnit():Promise<boolean>
    {
        if (await super.dnit() !== true) return false;

        //let all the transferred windows know that we are closing
        window.dispatchEvent(new CustomEvent<TransferWindowCustomEventDetail>(TRANSFER_WINDOW_EVENT_NAME, {detail:{type:'close', window:undefined!, transferID:''}})); 

        return true;
    }

    public onDownListened(event:PointerEvent)
    {
        let target = event.target as HTMLElement;
        if (!target) return;

        //find the window that contains the target
        let window = this._windows.find(window => window.element.contains(target));
        if (!window) return;

        this.focusWindow(window);
    }

    public async ready()
    {
        if (this._groupStores.window.restoreState !== RestoreState.Default) return; //aready started restoring
        
        await this._groupStores.window.restore();
        await this._groupStores.offset.restore();

        await this._transferredWindows.restore();
        this._transferredWindows.clear(); //then clear it, as we don't want to restore any transferred windows from a previous session
    }

    /**
     * Processes display options for a given window.
     * Where the window begins and ends (tweening) and sizing is determined by the display options.
     * 
     * @param appID - The ID of the app.
     * @param windowID - The ID of the window (optional).
     * @param displayOptions - The display options for the window (optional).
     * @returns The processed display options.
     */
    protected override async processDisplayOptions(appID:string, windowID?:string, displayOptions?:IWindowDisplayOptions):Promise<IWindowDisplayOptions | undefined>
    {
        const getRandomEdgePosition = (bounds:{left:number, top:number, right:number, bottom:number}):{top:number, left:number} =>
        {
            const edge = Math.floor(Math.random() * 4); //choose a random edge: top, bottom, left, right
            
            let top = 0;
            let left = 0;
            switch (edge) 
            {
                case 0: //top
                    top = bounds.top;
                    left = bounds.left + Math.floor(Math.random() * (bounds.right - bounds.left));
                    break;
                case 1: //bottom
                    top = bounds.bottom;
                    left = bounds.left + Math.floor(Math.random() * (bounds.right - bounds.left));
                    break;
                case 2: //left
                    left = bounds.left;
                    top = bounds.top + Math.floor(Math.random() * (bounds.bottom - bounds.top));
                    break;
                case 3: //right
                    left = bounds.right;
                    top = bounds.top + Math.floor(Math.random() * (bounds.bottom - bounds.top));
                    break;
            }
            
            return {top:top, left:left};
        }
        
        let appDimensions = this.abortableHelper.value(await this.#getAppDimensions(appID));
        
        displayOptions = displayOptions ?? {from:{top:0, left:0, width:0, height:0}, to:{}};
        if (windowID) //we are restoring a window, so use a random position instead of the default
        {
            let position = getRandomEdgePosition(this._explorer.getBounds()); //tween in from random point alongside the explorer bounds
            displayOptions.from.top = position.top;
            displayOptions.from.left = position.left;
            displayOptions.from.width = 0;
            displayOptions.from.height = 0;
        }
        else 
        {
            if (!displayOptions.from.top || !displayOptions.from.left) this._app.throw('Invalid display options', []);

            displayOptions.from.width = 0;
            displayOptions.from.height = 0;

            //get last dimensions if exists
            let lastDimensions = appDimensions.value;
            if (lastDimensions)
            {
                displayOptions.to.top = lastDimensions.top;
                displayOptions.to.left = lastDimensions.left;
                displayOptions.to.width = lastDimensions.width;
                displayOptions.to.height = lastDimensions.height;

                //reset last dimensions top and left
                appDimensions.value = {top:0, left:0, width:lastDimensions.width, height:lastDimensions.height};
            }
            
            //get the values for storage
            let lastXOffset = this._lastXOffset;
            let lastYOffset = this._lastYOffset;

            lastXOffset.value += 50;
            lastYOffset.value += 50;

            //TODO, verify this is correct, especially Y offset
            if (lastXOffset.value + this._explorer.element.offsetLeft / 2 > this._explorer.element.offsetWidth) lastXOffset.value = 0;
            if (lastYOffset.value + this._explorer.element.offsetTop / 2 > this._explorer.element.offsetHeight) lastYOffset.value = 0;
            
            if (!displayOptions.to.top) displayOptions.to.top = this._explorer.element.offsetTop / 2 + lastYOffset.value;
            if (!displayOptions.to.left) displayOptions.to.left = this._explorer.element.offsetLeft / 2 + lastXOffset.value;
            if (!displayOptions.to.width) displayOptions.to.width = this._explorer.element.offsetWidth / 2;
            if (!displayOptions.to.height) displayOptions.to.height = this._explorer.element.offsetHeight / 2;

            this._groupStores.offset.commit(); //save any changes we made to offsets
        }

        return displayOptions;
    }

    /**
     * Creates a new window for the specified app ID and adds it to the window manager.
     * @param appID The ID of the app to create the window for.
     * @param windowID (Optional) The ID to assign to the new window. If not provided, a new ID will be generated.
     * @param displayOptions (Optional) The display options to use for the new window.
     * @param restoringState (Optional) Whether the window is being restored from a previous state.
     * @returns A promise that resolves with the new window, or undefined if the window could not be created.
     */
    public override async createWindow(appID:string, windowID?:string, displayOptions?:IWindowDisplayOptions):Promise<Window<A> | undefined>
    {
        let window = await super.createWindow(appID, windowID, displayOptions);
        if (!window) return window;

        this._windows.add(window);

        this.focusWindow(window); //focus the window by default

        this._groupStores.window.commit(); //save any changes we made to windows

        return window;
    }

    /**
     * Closes the specified window and removes it from the window store. If the window being closed has the highest z-index, the next highest z-index window will be focused.
     * @param window The window to close.
     * @returns A Promise that resolves when the window has been closed and removed from the window store.
     */
    public async closeWindow(window:Window<A>)
    {
        const has = this._windows.has(window);
        if (!has) return;

        let maxZIndex = this._maxZIndex;

        //check if the window being closed has the max zIndex
        if (parseInt(window.element.style.zIndex) === maxZIndex.value) 
        {
            //start searching from the next lesser zIndex value
            maxZIndex.value--;

            //check if any window is occupying the next lesser zIndex value
            while (maxZIndex.value >= Z_INDEX_MIN && !this._windows.some(win => parseInt(win.element.style.zIndex) === maxZIndex.value)) maxZIndex.value--; //if not, decrement maxZIndex again
            
            //if the maxZIndex went below the minimum, reset it
            if (maxZIndex.value < Z_INDEX_MIN) maxZIndex.value = Z_INDEX_MIN;
        }

        this._windows.remove(window);

        if (this._focusedWindow.value === window) this._focusedWindow.value = undefined; //reset the focused window if it was the window we just closed

        //focus the window with the next highest z index
        if (this._windows.length) 
        {
            let window = this._windows.find(win => parseInt(win.element.style.zIndex) === maxZIndex.value);
            if (!window) this._app.consoleUtil.error(this.constructor, 'Window not found');
            else this.focusWindow(window);
        }

        //save the last dimensions, so we can open it again starting from their next time
        let appDimensions = this.abortableHelper.value(await this.#getAppDimensions(window.appID));
        appDimensions.value = {top:window.element.offsetTop, left:window.element.offsetLeft, width:window.element.offsetWidth, height:window.element.offsetHeight};
        
        await window.dnit();
        window.element.remove();

        const success = await this._groupStores.window.commit(); //save any changes we made to windows
        if (!success) this.warn('Failed to commit window changes');
    }

    /**
     * Focuses the specified window and brings it to the front of the z-order.
     * @param window The window to focus.
     */
    public focusWindow(window:Window<A>):void 
    {
        let previousFocusedWindow = this._focusedWindow.value;
        let focusedWindow = window;

        if (previousFocusedWindow === focusedWindow) return; //don't do anything if the window is already focused
        this._focusedWindow.value = window;

        let maxZIndex = this._maxZIndex;

        //increment the max z-index
        maxZIndex.value++;

        //set the z-index of the focused window
        focusedWindow!.element.style.zIndex = maxZIndex.value.toString();

        previousFocusedWindow?.onFocus(false);
        focusedWindow?.onFocus(true);

        this._groupStores.window.commit(); //save any changes we made to windows
    }
    
    /**
     * Returns the currently focused window, if any.
     * @returns The focused window, or undefined if no window is currently focused.
     */
    public getFocusedWindow():Window<A> | undefined
    {
        return this._focusedWindow.value;
    }

    /**
     * Initializes the listener for the transfer window custom event.
     * @param event The transfer window custom event.
     * @returns A Promise that resolves with the transferred window data.
     * @throws An error if the transferred window data is invalid.
     */
    #initTransferredWindowListener = async (event:TransferWindowCustomEvent) =>
    {
        let transferID = event.detail.transferID;        
        const transferredWindowData = await this.getTransferWindowData(transferID);
        if (transferredWindowData === undefined) this._app.throw('Invalid transfered window data', []);

        let windowID = transferredWindowData.windowID;

        let windowComponent = this._windows.find(window => window.windowID === windowID);
        if (!windowComponent)
        {
            this.warn(`Window with id ${windowID} not found`);
            return;
        }

        if (event.detail.type === 'load') 
        {
            this._transferredWindows.add(windowID); //add the window id to the list of transfers

            if (!windowComponent.isTransferedToOwnWindow) windowComponent.onTransferedToOwnWindow(); //this will occur if the window was transferred by drag and drop
            event.detail.window.document.title = windowComponent.appName;
            return;
        }

        if (event.detail.type === 'close')
        {                
            const screenX = event.detail.window.screenX;
            const screenY = event.detail.window.screenY - (event.detail.window.outerHeight - event.detail.window.innerHeight); //subtract the height of the title bar

            //get the bounding rectangle of the element
            const rect = this._explorer.element.getBoundingClientRect();

            //calculate the position of the element relative to the screen
            const elementScreenX = window.screenX + rect.left;
            const elementScreenY = window.screenY + rect.top;

            //convert screen coordinates to local coordinates
            const localX = screenX - elementScreenX;
            const localY = screenY - elementScreenY;

            //set the initial position, so the window tweens in from where it was last
            windowComponent.element.style.left = `${localX}px`;
            windowComponent.element.style.top = `${localY}px`;

            this._transferredWindows.remove(windowID); //remove the window id from the list of transfers

            windowComponent.onTransferedBackToParentWindow();
        }
    }

    /**
     * Transfers the given window to a new browser window with the specified screen coordinates.
     * @param win The window to transfer.
     * @param screenX The x-coordinate of the new window on the screen.
     * @param screenY The y-coordinate of the new window on the screen.
     */
    public async transferWindowToOwnWindow(win:Window<A>, screenX:number, screenY:number)
    {
        let transferID = this._app.uidUtil.generate();
        const success = await this.setTransferedWindowData(transferID, win.windowID, win.appID);
        if (!success) 
        {
            this._app.consoleUtil.error(this.constructor, `Failed to create transfered window model for window ${win.windowID}`);
            return;
        }

        let url = new URL(window.location.href);
        url.searchParams.set('transferID', transferID);

        let width = Math.max(win.minWidth, win.element.clientWidth);
        let height = Math.max(win.minHeight, win.element.clientHeight);

        let popup = window.open(url, win.windowID, `popup=true,width=${width},height=${height},screenY=${screenY},screenX=${screenX}`);
        if (!popup) 
        {
            this._app.toastNotification.show('Please disable your pop-up blocker and try again.', ToastNotification.TYPE_WARNING);
            win.moveWithinParentBounds(); //move the window back
            return;
        }
        
        win.onTransferedToOwnWindow();
    }

    /**
     * Retrieves the last saved dimensions of the specified app.
     * @param appID - The ID of the app to retrieve dimensions for.
     * @returns A Promise that resolves with an ObjectStore containing the last saved dimensions of the app, or undefined if no dimensions were saved.
     */
    async #getAppDimensions(appID:string):Promise<ObjectStore<A, {top:number, left:number, width:number, height:number} | undefined> | IAborted | IError>
    {
        try
        {
            return this.abortableHelper.value(await (new ObjectStore<A, {top:number, left:number, width:number, height:number} | undefined>(this._storage, appID + '_lastDimensions', undefined)).restore());
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get app dimensions, {}', [appID], {names:[this.constructor, this.#getAppDimensions]});
        }
    }
}