/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IContextable } from "../components/IContextable";
import { GlobalEvent } from "./GlobalListenerManager";
import { IContextMenuManagerType, type IContextMenuData } from "./IContextMenuManager";
import type { IContextMenuManager } from "./IContextMenuManager";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor";
import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator";

//We use the destructor passed into add as the destructor for this, so that when the add destructor is destructed, so will this be destructed, and thus the add object will be removed automatically
class ContextMenuDestructableEntity<A extends IBaseApp<A>> extends DestructableEntity<A>
{
    private _contextMenuManager:ContextMenuManager<A>;
    private _contextables:Map<HTMLElement, {element:HTMLElement, destructable:ContextMenuDestructableEntity<any>}>;
    private _element:HTMLElement;

    constructor(app:A, destructor:IDestructor<A>, globalListenerManager:ContextMenuManager<A>, element:HTMLElement, contextables:Map<HTMLElement, {element:HTMLElement, destructable:ContextMenuDestructableEntity<any>}>)
    {
        super(app, destructor);

        this._contextMenuManager = globalListenerManager;
        this._contextables = contextables;
        this._element = element;
    }

    public override async dnit():Promise<boolean>
    {
        const destructor = this.destructor;
        if (destructor === undefined) return super.dnit(); //destructor will be undefined if this has already been dnited

        this._contextables.delete(this._element);
        this._contextMenuManager = undefined!;
        this._contextables = undefined!;
        this._element = undefined!;

        return super.dnit();
    }
}

@ImplementsDecorator(IContextMenuManagerType)
export abstract class ContextMenuManager<A extends IBaseApp<A>> extends DestructableEntity<A> implements IContextMenuManager<A>
{
    protected _element:HTMLElement;

    private _contextables = new Map<HTMLElement, {element:HTMLElement, destructable:ContextMenuDestructableEntity<any>}>();

    protected _contextMenuData:IContextMenuData | undefined;

    private _contextMenuDisabled = false;
    private _contextMenuShowing = false;
    private _contextMenuLastLocation = {x:0, y:0};

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor);

        this._element = element;

        const globalListenerManager = this._app.globalListenerManager;

        //show context menu on right click
        globalListenerManager.subscribe(this, GlobalEvent.ContextMenu_Capture, this.onContextMenuListened);

        //hide context menu on click, drag, or window blur
        globalListenerManager.subscribe(this, GlobalEvent.Click, (event:MouseEvent) => this.onClickListened(event));
        globalListenerManager.subscribe(this, GlobalEvent.DragStart, this.onDragStartListened);
        globalListenerManager.subscribe(this, GlobalEvent.Blur, this.onBlurListened);
    }

    public onContextMenuListened = (event:MouseEvent) =>
    {
        this._contextMenuData = undefined;
        if (this._contextMenuDisabled) return;

        const getContextableElement = (target:HTMLElement | undefined):HTMLElement | undefined =>
        {
            while (target !== undefined)
            {
                if (this._contextables.has(target)) return target;
                target = target.parentElement ?? undefined;
            }

            return target;
        }

        let target = getContextableElement(event.target as HTMLElement ?? undefined);

        if (target !== undefined || this._contextMenuShowing === true)
        {
            event.preventDefault();
            event.stopPropagation();
        }
        
        if (this._contextMenuShowing)
        {
            this.hideContextMenu();
         
            //check if the context menu was clicked close to the last location
            const dx = Math.abs(event.clientX - this._contextMenuLastLocation.x);
            const dy = Math.abs(event.clientY - this._contextMenuLastLocation.y);

            if (dx < 5 && dy < 5) return; //if they are close, don't show the context menu again
        }

        if (target === undefined) return;

        this._contextMenuLastLocation = {x:event.clientX, y:event.clientY};

        //undefined data is allowed, so long as at least one contextable returns data
        //so, say you have a bunch of tiles inside a container, both are contextable
        //if you right click on the tile (outside of the icon area), it will return undefined. 
        //however, the parent contextable container will return data, so the context menu will still show and no warning will be logged

        let data:IContextMenuData | undefined;
        while (target !== undefined)
        {
            data = (target.component as IContextable).onContextMenu(event);
            if (data !== undefined) break;
            target = getContextableElement(target.parentElement ?? undefined);
        }

        if (data === undefined) 
        {
            this.warn('context menu data not found for target:', target);
            return;
        }

        this._contextMenuData = data;
        this.showContextMenu(event, data);
    }

    public onClickListened(event:MouseEvent) 
    { 
        const contextMenuData = this._contextMenuData;
    
        if (this._contextMenuShowing === false) return;
        if (contextMenuData === undefined || !(event.target instanceof HTMLElement)) return this.hideContextMenu();
        if (!this._element.contains(event.target)) return this.hideContextMenu();

        this.onContextMenuClicked(event, contextMenuData);
        this.hideContextMenu();
    };

    protected abstract onContextMenuClicked(event:MouseEvent, data:IContextMenuData):void;

    public onDragStartListened = (event:DragEvent) => this.hideContextMenu();
    public onBlurListened = (event:Event) => this.hideContextMenu();

    protected showContextMenu(event:MouseEvent, data:IContextMenuData):void
    {
        this._contextMenuShowing = true;
    }

    protected hideContextMenu():void 
    {
        this._contextMenuData = undefined;
        this._contextMenuShowing = false;
    }

    /**
     * Disables the context menu, so that the default browser context menu is shown instead. (useful for debugging)
     */
    public disableContextMenu():void
    {
        this._contextMenuDisabled = true;
    }

    public add(contextable:IContextable):void
    {
        const element = contextable.element;
        const destructable = new ContextMenuDestructableEntity<A>(this._app, contextable, this, element, this._contextables);

        this._contextables.set(element, {element, destructable});
    }

    public remove(contextable:IContextable):void
    {
        const obj = this._contextables.get(contextable.element);
        if (obj === undefined) return;

        obj.destructable.dnit();
    }
}