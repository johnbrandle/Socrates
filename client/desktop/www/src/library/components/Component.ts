/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from '../IBaseApp.ts';
import type { IComponent } from './IComponent.ts';
import { IComponentType, OnInitState } from './IComponent.ts';
import { INameableType } from '../../../../../../shared/src/library/INameable.ts';
import { GlobalEntry } from '../managers/GlobalObserverManager.ts';
import { ITransientableType } from './ITransientable.ts';
import { IIdentifiableType } from '../../../../../../shared/src/library/IIdentifiable.ts';
import { GlobalEvent } from '../managers/GlobalListenerManager.ts';
import { DestructableEntity } from '../../../../../../shared/src/library/entity/DestructableEntity.ts';
import type { IDestructor } from '../../../../../../shared/src/library/IDestructor.ts';
import type { uid } from '../utils/UIDUtil.ts';
import { ImplementsDecorator } from '../../../../../../shared/src/library/decorators/ImplementsDecorator.ts';

export enum NitState
{
    Dnited = -1,
    Nited = 0,
    Pniting = 1,
    Pnited = 2,
    Initing = 3,
    Inited = 4,
    Fniting = 5,
    Fnited = 6,
    Readying = 7,
    Ready = 8,
}

export enum DnitedState
{
    default = 0,
    partial = 1,
    full = 2
}

@ImplementsDecorator(IComponentType, IIdentifiableType, INameableType, ITransientableType)
export abstract class Component<A extends IBaseApp<A>> extends DestructableEntity<A> implements IComponent<A>
{
    protected readonly _element:HTMLElement; //root html element of the component
    #_html:string; //html string of the component

    #_nitState = NitState.Nited;
    #_dnitedState = DnitedState.default;

    #_scrollRect:{x:number, y:number, width:number, height:number} | undefined;
    #_scrollRectXOffset = 0;
    #_scrollRectYOffset = 0;

    readonly #_observerState = {show:true, hide:true, resize:true};
    readonly #_listenerState = {visible:false};

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, html?:string, uid?:uid) 
    {
        super(app, destructor, uid);

        this._element = element;
        this.#_html = html ?? '';

        element.component = this; //set self reference to element

        let currentClass = this.constructor;
        while (currentClass !== Object) //add the css classes for all parent classes that extend Component 
        {
            const className = app.componentUtil.getPath(currentClass as new (...args: any[]) => IComponent<A>);

            element.classList.add(className.replaceAll('/', '-'));
            currentClass = Object.getPrototypeOf(currentClass);

            if (Component.prototype.isPrototypeOf(currentClass.prototype) !== true) break;
        }
    }

    /**
     * @forceSuperTransformer_forceSuperCall
     */
    public pnit(...args:any):void
    {
        this.#_dnitedState = DnitedState.default;

        const html = this.#_html;
        if (this.isTransient !== true) this.#_html = ''; //clear if this is not transient (no need to keep it in memory)

        const documentFragment = this._app.domUtil.createDocumentFragment(html, this.preprocessHTML.bind(this)); //createDocumentFragment will call preprocessHTML before adding the children to the fragment
        this._element.append(documentFragment);
    }

    /**
     * Called by pnit. Override this method to modify the HTML before components within it are created.
     * 
     * @forceSuperTransformer_forceSuperCall
     */
    protected preprocessHTML(element:HTMLElement):HTMLElement { return element; }

    /**
     * @forceSuperTransformer_forceSuperCall
     */
    public async init(...args:any):Promise<void> 
    {
        if (args.length === 2 && args[0] === this) this.warn('init called with a component argument. you must override this method and manually init child component.', args[0]);
    }

    /**
     * @forceSuperTransformer_forceSuperCall
     */
    public async fnit(...args:any):Promise<void>
    {
        if (args.length === 2 && args[0] === this) this.warn('fnit called with a component argument. you must override this method and manually fnit child component.', args[0]);
    }

    /**
     * @forceSuperTransformer_forceSuperCall
     */
    public async ready():Promise<void> 
    {
        this.__initializationState = NitState.Ready;

        const app = this._app;
        const globalObserverManager = app.globalObserverManager;
        if (this.onShow !== Component.prototype.onShow || this.onHide !== Component.prototype.onHide) globalObserverManager.subscribe(this, this._element, GlobalEntry.Visibility, (entry:IntersectionObserverEntry, style:CSSStyleDeclaration, visible:boolean):void =>
        {
            if (visible === true) 
            {
                const initial = this.#_observerState.show;
                if (initial === true) this.#_observerState.show = false;
                this.onShow(initial, entry, style);
                return;
            }
    
            const initial = this.#_observerState.hide;
            if (initial === true) this.#_observerState.hide = false;
            this.onHide(initial, entry, style);
        });
        if (this.onResize !== Component.prototype.onResize) globalObserverManager.subscribe(this, this._element, GlobalEntry.Resize, (entry:ResizeObserverEntry):void =>
        {
            const initial = this.#_observerState.resize;
            if (initial === true) this.#_observerState.resize = false;
            this.onResize(initial, entry);
        });

        const globalListenerManager = app.globalListenerManager;
        if (this.onVisible !== Component.prototype.onVisible) globalListenerManager.subscribe(this, GlobalEvent.VisibilityChange, this.#onVisibilityChangeListened);
    }

    /**
     * @forceSuperTransformer_forceSuperCall
     */
    public __onReadyComplete():void 
    {
        if (this.onVisible !== Component.prototype.onVisible) this.#onVisibilityChangeListened(); //call this method once to set the initial state
    }

    #onVisibilityChangeListened = (event?:Event):void =>
    {
        const visibility = document.visibilityState === 'visible';
        if (visibility === this.#_listenerState.visible) return;
        
        this.#_listenerState.visible = visibility;

        this.onVisible(visibility);
    }

    /**
     * @forceSuperTransformer_forceSuperCall
     */
    public async dnit(partial:boolean=false):Promise<boolean>
    {
        const app = this._app;

        try
        {
            const previousDnitedState = this.#_dnitedState;

            //if nitState is set to Dnited and previous dnited state is set to full, we should already be dnited. return false (nothing to do)
            if (partial === true && this.isTransient !== true) app.throw('only transient components can be partially dnited', [], {correctable:true});
            if (this.#_nitState === NitState.Dnited && previousDnitedState === DnitedState.full) return false; 
            if (previousDnitedState === DnitedState.full && partial === true) app.throw('cannot call dnit partial after full dnit', [], {correctable:true});
            if (previousDnitedState === DnitedState.partial && partial === true) app.throw('cannot partially dnit twice', [], {correctable:true});

            const element = this._element;

            //if nitState is greater or equal to nited (default state) and less than fnited, then we have a component that has been created, but 
            //has not yet gone through the initialization process. all components must go through this process before we can dnit them. why?
            //because if we do not do that, dnit logic will need to be more complicated. as it is now, dnit assumes that pnit, init, and fnit have all been called,
            //and possibly the ready method as well. the component factory should check if a component's dnit method was called while it was being initialized, and if so,
            //call dnit after initialzation is complete. if we did not do it like this, we would need a fair amount of conditional logic in dnit, which could be prone to error.
            //so, return false here, and expect that the component factory will call this method again after initialization is complete.
            if (this.#_nitState >= NitState.Nited && this.#_nitState < NitState.Fnited) 
            {
                this.#_dnitedState = DnitedState.full; //let the component factory know that this component has been dnited
                return false;
            }

            //call dnit on all sub components (if this is a partial dnit) //why? because super.dnit will not be called when partial is true, and we need to dnit all sub components (given that partial is used for transient components, which need to remove and dnit all children) 
            if (partial === true)
            {
                //ensure's dnit is called on all sub components
                const promises:Promise<boolean>[] = [];
                this._app.componentUtil.propagate(element, (component:IComponent<A>) => 
                {
                    promises.push(component.dnit(false));

                    return true; //component will dnit itself, so return true to stop redundant propagation
                }, false, false, false);

                await Promise.all(promises);

                element.innerHTML = ''; //clear the inner html since this is a transient component
            }
            else
            {
                if (await super.dnit() !== true) return false;

                //clear the component reference on the element (we WILL encounter garbage collection issues if we don't do this --verified to be an issue in chromium)
                element.component = undefined!; 
            }

            this.__elements = undefined; //clear the elements object

            this.__initializationState = NitState.Dnited;
            this.#_dnitedState = partial === true ? DnitedState.partial : DnitedState.full;
        
            return true;
        }
        catch (error)
        {
            return app.rethrow(error, 'dnit failed', arguments, {correctable:true});
        }
    }

    protected async onShow(_initial:boolean, _entry:IntersectionObserverEntry, _style:CSSStyleDeclaration):Promise<void> {}
    protected async onHide(_initial:boolean, _entry:IntersectionObserverEntry, _style:CSSStyleDeclaration):Promise<void> {}
    protected async onResize(_initial:boolean, _entry:ResizeObserverEntry):Promise<void> {}

    protected async onVisible(_visible:boolean):Promise<void> {}

    public set scrollRect(rectangle:{x:number, y:number, width:number, height:number} | undefined)
    {
        const style = this._element.style;
        if (rectangle === undefined)
        {
            style.removeProperty('clip-path');
        
            this.#_scrollRect = rectangle;
            this.#_scrollRectXOffset = 0;
            this.#_scrollRectYOffset = 0;
            return;
        }

        if (isNaN(rectangle.x) === true || isNaN(rectangle.y) === true || isNaN(rectangle.width) === true || isNaN(rectangle.height) === true) this._app.throw('scrollRect values must be numbers', [], {correctable:true});

        const [x, y] = [rectangle.x >> 0, rectangle.y >> 0];
        const [width, height] = [(rectangle.x + rectangle.width) >> 0, (rectangle.y + rectangle.height) >> 0];
        
        style.clipPath = `polygon(${x}px ${y}px, ${width}px ${y}px, ${width}px ${height}px, ${x}px ${height}px)`;
        
        this.#_scrollRect = rectangle; 
        this.#_scrollRectXOffset = -rectangle.x >> 0;
        this.#_scrollRectYOffset = -rectangle.y >> 0;
    }
    
    protected find<T>(name:string, element?:Element, optional?:boolean):Array<T>
    {
        element = element ?? this._element;
     
        const found = this._app.componentUtil.find<T>(name, element);
        if (found.length > 0 || optional === true) return found;

        this.warn('element(s) not found', name, this, element);
        
        return found;
    }

    protected get<T>(name:string, element?:Element, optional?:false | undefined):T;
    protected get<T>(name:string, element?:Element, optional?:true):T | undefined
    protected get<T>(name:string, element?:Element, optional?:boolean)
    {
        element = element ?? this._element;

        const found = this._app.componentUtil.get<T>(name, element);
        if (found !== undefined || optional === true) return found;
        
        this.warn('element(s) not found', name, this, element);
        
        return undefined;
    }

    protected set(object:Record<string, any>, element?:Element):void
    {
        element = element ?? this._element;

        const find = this._app.componentUtil.find;
        for (const key in object) 
        {
            const result = find(key, element);

            if (result.length === 0) this.warn('element(s) not found', key, this, element);

            object[key] = result.length > 1 ? result : result[0];
        }
    }

    public get element():HTMLElement { return this._element; }
    public get fullyQualifiedName():string { return this._app.componentUtil.getPath(this.constructor as new (...args: any[]) => IComponent<A>); }
    
    protected set id(id:string) { this._element.setAttribute('id', id); }
    public get id():string { return this._element.getAttribute('id') ?? ''; }

    protected set name(name:string) { this._element.setAttribute('name', name); }
    public get name():string { return this._element.getAttribute('name') ?? ''; }
    
    public get initialized():boolean { return this.#_nitState >= NitState.Fnited; } //consider the component initialized if the state is greater than or equal to Fnited
    public get transparent():boolean { return false; }
    public get isTransient():boolean { return false; }

    public get requiresManualInitialization():boolean { return this._element.getAttribute(this._app.componentUtil.initAttributeName) === this._app.componentUtil.initAttributeManualValue; }
    public isInitializerForComponent(_component:IComponent<A>):boolean { return false; }

    public override get dnited():boolean { return this.#_dnitedState === DnitedState.full; }

    public get __initializationState():NitState { return this.#_nitState; }
    public set __initializationState(state:NitState) 
    { 
        if (this.#_nitState === state) this._app.throw('initialization state already set to', [state], {correctable:true});

        const fromState = this.#_nitState;

        this.#_nitState = state; 

        this.onChangeSignal.dispatch(this, OnInitState, {from:fromState, to:state});
    }

    public get html():string 
    {
        if (this.isTransient !== true) this._app.throw('html can only be accessed on transient components', [], {correctable:true});

        return this.#_html; 
    }

    #_debug:{show:() => void, hide:() => void, readonly showing:boolean, info:(id:string, value:string) => void;} | undefined;
    public get debug():{show:() => void, hide:() => void, readonly showing:boolean, info:(id:string, value:string) => void;} | undefined
    {
        if (this._app.debugUtil.isDebug !== true) return undefined;

        if (this.#_debug !== undefined) return this.#_debug;

        const debug = 
        {
            info:(id:string, value:string) => this.app.info.update(this, id, value),
            show:() => this.app.info.show(this),
            hide:() => this.app.info.hide(this),
            showing:false,
        };

        return this.#_debug = debug;
    }

    protected __elements?:any | undefined;
    protected get _elements():Object { return this.__elements ?? (this.__elements = {}); }

    public get scrollRectXOffset():number { return this.#_scrollRectXOffset; }
    public get scrollRectYOffset():number { return this.#_scrollRectYOffset; }
    public get scrollRect():{x:number, y:number, width:number, height:number} | undefined { return this.#_scrollRect; }
}