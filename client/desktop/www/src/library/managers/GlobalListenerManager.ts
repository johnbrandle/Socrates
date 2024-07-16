/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp.ts";
import { IGlobalListenerManagerType, type IGlobalListenerMap as IShared } from "./IGlobalListenerManager.ts";
import type { IGlobalListenerManager } from "./IGlobalListenerManager.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator.ts";

export enum GlobalEvent
{
    Click = 'click',
    ConsoleLog = 'consoleLog',
    ContextMenu = 'contextmenu',
    DragStart = 'dragstart',
    Blur = 'blur',
    Focus = 'focus',
    Move = 'move',
    Up = 'up',
    Down = 'down',
    Resize = 'resize',
    VisibilityChange = 'visibilitychange',
    PopState = 'popstate',
    Online = 'online',
    Offline = 'offline',
    DeviceOrientation = 'deviceorientation',

    ContextMenu_Capture = 'contextmenu_capture',
    Click_Capture = 'click_capture',
    DragOver_Capture = 'dragover_capture',
    Drop_Capture = 'drop_capture',
    TouchMove_Capture = 'touchmove_capture',
}

export interface IGlobalListenerMap extends IShared
{
    [GlobalEvent.Click]:(event:MouseEvent) => void;
    [GlobalEvent.ConsoleLog]:(event:CustomEvent) => void;
    [GlobalEvent.ContextMenu]:(event:MouseEvent) => void;
    [GlobalEvent.DragStart]:(event:DragEvent) => void;
    [GlobalEvent.Blur]:(event:Event) => void;
    [GlobalEvent.Focus]:(event:Event) => void;
    [GlobalEvent.Move]:(event:PointerEvent) => void;
    [GlobalEvent.Up]:(event:PointerEvent) => void;
    [GlobalEvent.Down]:(event:PointerEvent) => void;
    [GlobalEvent.Resize]:(event:Event) => void;
    [GlobalEvent.VisibilityChange]:(event:Event) => void;
    [GlobalEvent.PopState]:(event:PopStateEvent) => void;
    [GlobalEvent.Online]:(event:Event) => void;
    [GlobalEvent.Offline]:(event:Event) => void;
    [GlobalEvent.DeviceOrientation]:(event:DeviceOrientationEvent) => void;

    [GlobalEvent.ContextMenu_Capture]:(event:MouseEvent) => void;
    [GlobalEvent.Click_Capture]:(event:MouseEvent) => void;
    [GlobalEvent.DragOver_Capture]:(event:DragEvent) => void;
    [GlobalEvent.Drop_Capture]:(event:DragEvent) => void;
    [GlobalEvent.TouchMove_Capture]:(event:TouchEvent) => void;
}

interface IListener
{
    subject:any;
    name:string;
    func:(event:Event) => void;
    options:AddEventListenerOptions;
}

//We use the destructor passed into subscribe as the destructor for this, so that when the subscribe destructor is destructed, so will this be destructed, and thus the event listener will be removed automatically
class GlobalListenerDestructableEntity<A extends IBaseApp<A>, L extends IGlobalListenerMap> extends DestructableEntity<A>
{
    private _globalListenerManager:GlobalListenerManager<A, L>;
    private _eventType:keyof L;

    constructor(app:A, destructor:IDestructor<A>, globalListenerManager:GlobalListenerManager<A, L>, eventType:keyof L)
    {
        super(app, destructor);

        this._globalListenerManager = globalListenerManager;
        this._eventType = eventType;
    }

    public override async dnit(unsubcribe:boolean=true):Promise<boolean>
    {
        const destructor = this.destructor;
        if (destructor === undefined) return super.dnit(); //destructor will be undefined if this has already been dnited

        if (unsubcribe === true) this._globalListenerManager.unsubscribe(destructor, this._eventType);
        this._globalListenerManager = undefined!;

        return super.dnit();
    }
}

/**
 * The GlobalListener class manages global event listeners and provides methods
 * to subscribe and unsubscribe objects to these events.
 */
@ImplementsDecorator(IGlobalListenerManagerType)
export class GlobalListenerManager<A extends IBaseApp<A>, L extends IGlobalListenerMap=IGlobalListenerMap> extends DestructableEntity<A> implements IGlobalListenerManager<A, L>
{
    private readonly _subscribers:Map<keyof L, Set<{destructor:IDestructor<A>, handler:L[keyof L], destructable:GlobalListenerDestructableEntity<A, L>}>> = new Map();
    private readonly _eventListeners:Map<keyof L, Array<IListener>> = new Map();

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }

    public subscribe(destructor:IDestructor<A>, eventType:keyof L, handler:L[keyof L]):void
    {
        let subscriptions = this._subscribers.get(eventType)!;
        if (subscriptions === undefined) 
        {
            this._subscribers.set(eventType, subscriptions = new Set());
            this.#addEventListener(eventType);
        }

        if (this.subscribed(destructor, eventType, handler) === true) this._app.throw('cannot subscribe to an entry more than once simultaneously', [eventType], {correctable:true});

        const destructable = new GlobalListenerDestructableEntity(this._app, destructor, this, eventType);
        subscriptions.add({handler, destructor, destructable});
    }

    public subscribed(destructor:IDestructor<A>, eventType:keyof L, handler:L[keyof L]):boolean
    {
        const subscriptions = this._subscribers.get(eventType);
        if (subscriptions === undefined) return false;

        for (const subscription of subscriptions) if (subscription.destructor === destructor && subscription.handler === handler) return true;

        return false;
    }

    public unsubscribe(destructor:IDestructor<A>, eventType:keyof L, handler?:L[keyof L]):void
    {
        const subscriptions = this._subscribers.get(eventType);
        if (subscriptions === undefined) return;

        for (const subscription of subscriptions)
        {
            if (subscription.destructor !== destructor || (handler !== undefined && subscription.handler !== handler)) continue;
            
            subscription.destructable.dnit(false);
            subscriptions.delete(subscription);
        }
        
        if (subscriptions.size > 0) return;
        
        this._subscribers.delete(eventType);
        this.#removeEventListener(eventType);
    }

    #notifySubscribers(eventType:keyof L, event:Event):void 
    {
        const subscriptions = this._subscribers.get(eventType);
        if (subscriptions === undefined) return;

        for (const subscription of subscriptions)
        {
            const func = subscription.handler as Function;
            
            if (subscription.destructable.dnited === true) this._app.throw('callback called after dnit', [eventType], {correctable:true}); //this should not be possible, but just in case...
            func(event);
        }
    }

    #addEventListener(eventType:keyof L):void 
    {
        const eventListeners = this._eventListeners;

        if (eventListeners.has(eventType) === true) this._app.throw('event listener already exists', [eventType], {correctable:true});
        
        const listeners:Array<IListener> = [];
        let func = (event:Event) => this.#notifySubscribers(eventType, event);

        switch (eventType)
        {
            case GlobalEvent.VisibilityChange:
                listeners.push({subject:document, name:'visibilitychange', func, options:{passive:true}});
                break;
            case GlobalEvent.Resize:
                listeners.push({subject:window, name:'resize', func, options:{passive:true}});
                break;
            case GlobalEvent.Move:
                listeners.push({subject:document, name:'pointermove', func, options:{passive:true}});
                break;
            case GlobalEvent.Up:
                listeners.push({subject:document, name:'pointerup', func, options:{passive:true}});
                listeners.push({subject:document, name:'dragend', func, options:{passive:true}}); //because pointerup is not fired when dragging on draggable elements
                break;
            case GlobalEvent.Down:
                listeners.push({subject:document, name:'pointerdown', func, options:{passive:true}});
                break;
            case GlobalEvent.Blur:
                listeners.push({subject:window, name:'blur', func, options:{passive:true}});
                break;
            case GlobalEvent.Focus:
                listeners.push({subject:window, name:'focus', func, options:{passive:true}});
                break;
            case GlobalEvent.ContextMenu:
                listeners.push({subject:document, name:'contextmenu', func, options:{passive:true}});
                break;
            case GlobalEvent.Click:
                listeners.push({subject:document, name:'click', func, options:{passive:true}});
                break;
            case GlobalEvent.DragStart:
                listeners.push({subject:document, name:'dragstart', func, options:{passive:true}});    
                break;
            case GlobalEvent.ConsoleLog:
                listeners.push({subject:window, name:'consoleLog', func, options:{passive:true}});
                break;
            case GlobalEvent.PopState:
                listeners.push({subject:window, name:'popstate', func, options:{passive:true}});
                break;
            case GlobalEvent.Online:
                listeners.push({subject:window, name:'online', func, options:{passive:true}});
                break;
            case GlobalEvent.Offline:
                listeners.push({subject:window, name:'offline', func, options:{passive:true}});
                break;
            case GlobalEvent.DeviceOrientation:
                listeners.push({subject:window, name:'deviceorientation', func, options:{passive:true}});
                break;

            case GlobalEvent.ContextMenu_Capture:
                listeners.push({subject:document, name:'contextmenu', func, options:{passive:false, capture:true}});
                break;
            case GlobalEvent.Click_Capture:
                listeners.push({subject:document, name:'click', func, options:{passive:false, capture:true}});
                break;
            case GlobalEvent.DragOver_Capture:
                listeners.push({subject:document, name:'dragover', func, options:{passive:false, capture:true}});
                break;
            case GlobalEvent.Drop_Capture:
                listeners.push({subject:document, name:'drop', func, options:{passive:false, capture:true}});
                break;
            case GlobalEvent.TouchMove_Capture:
                listeners.push({subject:document, name:'touchmove', func, options:{passive:false, capture:true}});
                break;
            default:
                this._app.throw('event listener not implemented', [eventType], {correctable:true});
        }

        for (const listener of listeners) listener.subject.addEventListener(listener.name, listener.func, listener.options);

        eventListeners.set(eventType, listeners);
    }

    #removeEventListener(eventType:keyof L):void 
    {
        const eventListeners = this._eventListeners;
        if (!eventListeners.has(eventType)) this._app.throw('event listener does not exist', [eventType], {correctable:true});
        
        const listeners = eventListeners.get(eventType)!;

        for (const listener of listeners) listener.subject.removeEventListener(listener.name, listener.func, listener.options);

        eventListeners.delete(eventType);
    }
}