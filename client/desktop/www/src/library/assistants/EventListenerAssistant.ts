/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 *
 * A utility class for managing event listeners, allowing for easy adding and removal.
 * Only supports one handler per event type per element.
 */

import type { IBaseApp } from "../IBaseApp";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import { WeakKeyMap } from "../../../../../../shared/src/library/weak/WeakKeyMap";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity";

export class EventListenerAssistant<A extends IBaseApp<A>> extends DestructableEntity<A>
{
    private readonly scope?:Object;

    private readonly _eventMap:WeakKeyMap<Element | Window | Document, Record<string, {f:(event:any) => any, options:AddEventListenerOptions | undefined}>> = new WeakKeyMap(true);

    constructor(app:A, destructor:IDestructor<A>, scope?:Object) 
    {
        super(app, destructor);

        this.scope = scope ?? {};
    }

    /**
     * Adds an event listener to an element.
     * @param element - The DOM element to attach the event to.
     * @param event - The event type to listen for.
     * @param handler - The function to call when the event occurs.
     * @param context - The value of `this` within the event handler.
     * @throws Will throw an error if the event map is undefined.
     * @throws Will throw an error if a handler for the specified event already exists.
     */
    public subscribe<T extends Event>(element:Element | Window | Document, event:string, handler:(event:T) => any, options?:AddEventListenerOptions):void 
    {
        const scope = this.scope;

        const boundHandler = scope ? handler.bind(scope) : handler;

        //if the element doesn't exist in the map, add it.
        if (!this._eventMap.has(element)) this._eventMap.set(element, {});

        const handlers = this._eventMap.get(element);

        if (handlers === undefined) throw new Error(`Failed to retrieve handlers for the given element.`);
        if (handlers[event] !== undefined) throw new Error(`A handler for the event "${event}" already exists on the specified element.`);
        
        handlers[event] = {f:boundHandler, options:options};
        element.addEventListener(event, boundHandler as any, options);
    }

    /**
    * Removes all event listeners from a specific element.
    * @param element The DOM element to remove all events from.
    */
    public unsubscribe(element:Element | Window | Document): void;

    /**
    * Removes a specific event listener from a specific element.
    * @param element The DOM element to detach the event from.
    * @param event The event type to stop listening for.
    */
    public unsubscribe(element:Element | Window | Document, event:string):void;

    public unsubscribe(element:Element | Window | Document, event?:string):void 
    {
        const handlers = this._eventMap.get(element);
        if (handlers === undefined) return;

        if (!event) //remove all for element
        {
            for (const event in handlers) 
            {
                const obj = handlers[event];
                element.removeEventListener(event, obj.f, obj.options);
            }
            this._eventMap.delete(element);
            return;
        }

        if (handlers[event] === undefined) return;
        const obj = handlers[event];
        element.removeEventListener(event, obj.f, obj.options);
        delete handlers[event];
    }

    /**
     * Removes all event listeners from all elements.
     */
    public clear():void
    {
        const eventMap = this._eventMap;
        for (const [element, handlers] of eventMap)
        {
            for (const event in handlers) 
            {
                const obj = handlers[event];
                element.removeEventListener(event, obj.f, obj.options);
            }
        }

        this._eventMap.clear();
    }
   
    public async dnit():Promise<boolean>
    {
        if (await super.dnit() !== true) return false;

        this.clear();

        return true;
    }
}