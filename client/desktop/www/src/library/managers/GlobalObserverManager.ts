/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity";
import type { IBaseApp } from "../IBaseApp";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import type { IGlobalObserverManager } from "./IGlobalObserverManager";
import { IGlobalObserverManagerType, type IGlobalObserverMap as IShared } from "./IGlobalObserverManager";
import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator";

export enum GlobalEntry
{
    Intersection = 'onIntersectionObserved',
    Visibility = 'onVisibilityObserved', 

    Resize = 'onResizeObserved',
    
    Mutation = 'onMutationObserved',
}

export interface IGlobalObserverMap extends IShared
{
    [GlobalEntry.Intersection]:(entry:IntersectionObserverEntry) => void;
    [GlobalEntry.Visibility]:(entry:IntersectionObserverEntry, style:CSSStyleDeclaration, visible:boolean) => void;

    [GlobalEntry.Resize]:(entry:ResizeObserverEntry) => void;
    
    [GlobalEntry.Mutation]:(entry:MutationRecord) => void;
}

//We use the destructor passed into subscribe as the destructor for this, so that when the subscribe destructor is destructed, so will this be destructed, and thus the event listener will be removed automatically
class GlobalObserverDestructableEntity<A extends IBaseApp<A>, O extends IGlobalObserverMap> extends DestructableEntity<A>
{
    private _globalObserverManager:GlobalObserverManager<A, O>;
    private _entryType:keyof O;
    private _element:Element;

    constructor(app:A, destructor:IDestructor<A>, globalListenerManager:GlobalObserverManager<A, O>, entryType:keyof O, element:Element)
    {
        super(app, destructor);

        this._globalObserverManager = globalListenerManager;
        this._entryType = entryType;
        this._element = element;
    }

    public override async dnit(unsubcribe:boolean=true):Promise<boolean>
    {
        const destructor = this.destructor;
        if (destructor === undefined) return super.dnit(); //destructor will be undefined if this has already been dnited

        if (unsubcribe === true) this._globalObserverManager.unsubscribe(this._element, this._entryType);
        this._globalObserverManager = undefined!;
        this._element = undefined!;

        return super.dnit();
    }
}

@ImplementsDecorator(IGlobalObserverManagerType)
export class GlobalObserverManager<A extends IBaseApp<A>, O extends IGlobalObserverMap=IGlobalObserverMap> extends DestructableEntity<A> implements IGlobalObserverManager<A, O>
{
    private readonly _visibilityObserver:IntersectionObserver = new IntersectionObserver((entries) => { this.#onIntersectionObserverCallback(entries); }, {root:null});
    private readonly _resizeObserver:ResizeObserver = new ResizeObserver((entries) => { this.#onResizeObserverCallback(entries); });
    private readonly _mutationObserver:MutationObserver = new MutationObserver((mutations) => { this.#onMutationObserverCallback(mutations); });
    
    private readonly _subscribers:Map<keyof O, Map<Element, {visible:boolean | undefined, destructor:IDestructor<A>, handler:O[keyof O], destructable:GlobalObserverDestructableEntity<A, O>}>> = new Map();

    constructor(app:A, destructor:IDestructor<A>) 
    {
        super(app, destructor);
    }

    #onIntersectionObserverCallback(entries:Array<IntersectionObserverEntry>)
    {
        const isCSSVisible = (style:CSSStyleDeclaration):boolean => style.display !== 'none' && style.visibility !== 'hidden';

        const handleIntersectionEntry = (entry:IntersectionObserverEntry):boolean =>
        {
            const subscriptions = this._subscribers.get(GlobalEntry.Intersection);
            if (subscriptions === undefined) return false;
            
            const value = subscriptions.get(entry.target);
            if (value === undefined) return false;

            const func = value.handler as Function;

            if (value.destructable.dnited === true) this._app.throw('callback called after dnit', [GlobalEntry.Intersection]); //this should not be possible, but just in case...
            func(entry);

            return true;
        }

        const handleVisibilityEntry = (entry:IntersectionObserverEntry):boolean =>
        {
            const subscriptions = this._subscribers.get(GlobalEntry.Visibility);
            if (subscriptions === undefined) return false;
            
            const value = subscriptions.get(entry.target);
            if (value === undefined) return false;

            const computedStyle = window.getComputedStyle(entry.target);
            const cssVisible = isCSSVisible(computedStyle);
            const inBounds = entry.isIntersecting;

            const visible = inBounds && cssVisible;

            if (value.visible === visible) return true;
            value.visible = visible;

            const func = value.handler as Function;
            
            if (value.destructable.dnited === true) this._app.throw('callback called after dnit', [GlobalEntry.Visibility]); //this should not be possible, but just in case...
            func(entry, computedStyle, visible);

            return true;
        }

        for (const entry of entries)
        {
            const target = entry.target;
            if (target.component === undefined) continue;
            
            const handledIntersection = handleIntersectionEntry(entry);
            const handledVisibility = handleVisibilityEntry(entry);

            if (handledIntersection === false && handledVisibility === false) this._app.consoleUtil.warn(GlobalObserverManager, 'callback received an entry for an element that has no subscriber', GlobalEntry.Visibility, target);
        }
    }

    #onResizeObserverCallback(entries:Array<ResizeObserverEntry>)
    {
        for (const entry of entries)
        {
            const target = entry.target;
            if (target.component === undefined) continue;

            const subscriptions = this._subscribers.get(GlobalEntry.Resize);
            if (subscriptions === undefined) continue;

            const value = subscriptions.get(target);
            if (value === undefined) continue;
            
            const func = value.handler as Function;

            if (value.destructable.dnited === true) this._app.throw('callback called after dnit', [GlobalEntry.Resize]); //this should not be possible, but just in case...
            func(entry);
        }
    }

    #onMutationObserverCallback(_mutations:Array<MutationRecord>)
    {
        this._app.throw('unimplemented', []);
    }

    public subscribe(destructor:IDestructor<A>, element:Element, entryType:keyof O, handler:O[keyof O]):void
    {
        let subscriptions = this._subscribers.get(entryType);
        if (subscriptions === undefined) this._subscribers.set(entryType, subscriptions = new Map());

        if (subscriptions.has(element) === true) this._app.throw('cannot subscribe to an entry more than once simultaneously', [element]);

        const destructable = new GlobalObserverDestructableEntity(this._app, destructor, this, entryType, element);
        subscriptions.set(element, {visible:undefined, destructor, handler, destructable});

        switch (entryType)
        {
            case GlobalEntry.Visibility:
                this._visibilityObserver.observe(element);
                break;
            case GlobalEntry.Resize:
                this._resizeObserver.observe(element);
                break;
            default:
                this._app.throw('unknown entry type', [entryType]);
        }
    }

    public unsubscribe(element:Element, entryType:keyof O):void 
    {
        const subscriptions = this._subscribers.get(entryType);
        if (subscriptions === undefined || subscriptions.has(element) === false) return;

        for (const [eachElement, value] of subscriptions)
        {
            if (element !== eachElement) continue;
            
            value.destructable.dnit(false);
        }
        
        subscriptions.delete(element);

        switch (entryType)
        {
            case GlobalEntry.Visibility:
                this._visibilityObserver.unobserve(element);
                break;
            case GlobalEntry.Resize:
                this._resizeObserver.unobserve(element);
                break;
            default:
                this._app.throw('unknown entry type', [entryType]);
        }
    }

    subscribed(element:Element, entryType:keyof O):boolean
    {
        const subscriptions = this._subscribers.get(entryType);
        if (subscriptions === undefined) return false;

        return subscriptions.has(element);
    }
}