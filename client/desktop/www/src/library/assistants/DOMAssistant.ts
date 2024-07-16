/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity";
import { Signal } from "../../../../../../shared/src/library/signal/Signal";

export class DOMAssistant<A extends IBaseApp<A>> extends DestructableEntity<A> 
{
    private _trackedElements:Set<Node> = new Set();
    private _observer:MutationObserver;

    public readonly onElementAddedToDOMSignal = new Signal<[DOMAssistant<A>, Element]>(this);
    public readonly onElementRemovedFromDOMSignal = new Signal<[DOMAssistant<A>, Element]>(this);

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);

        const trackedElements = this._trackedElements;
        this._observer = new MutationObserver((mutationsList) => 
        {
            for (const mutation of mutationsList) 
            {
                //check if any added node contains tracked elements
                mutation.addedNodes.forEach((node) => 
                {
                    if (node.nodeType === Node.ELEMENT_NODE) 
                    {
                        const element = node as Element;
                        trackedElements.forEach(trackedElement => 
                        {
                            if (element.contains(trackedElement)) this.onElementAddedToDOMSignal.dispatch(this, trackedElement as Element); 
                        });
                    }
                });
        
                //check if any removed node contains tracked elements
                mutation.removedNodes.forEach((node) => 
                {
                    if (node.nodeType === Node.ELEMENT_NODE) 
                    {
                        const element = node as Element;
                        trackedElements.forEach(trackedElement => 
                        {
                            if (element.contains(trackedElement)) this.onElementRemovedFromDOMSignal.dispatch(this, trackedElement as Element);
                            
                        });
                    }
                });
            }
        });

        this._observer.observe(document.body, {childList:true, subtree:true});
    }

    subscribe(element:Element):void 
    {
        this._trackedElements.add(element);
    }

    unsubscribe(element:Element):void 
    {
        this._trackedElements.delete(element);
    }

    clear():void 
    {
        this._trackedElements.clear();
    }

    public override async dnit():Promise<boolean>
    {
        if (await super.dnit() !== true) return false;

        this.clear();
        this._observer.disconnect();

        return true;
    }
}