/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 */

import type { IBaseApp } from "../IBaseApp.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import type { IDraggable } from "../components/IDraggable.ts";
import type { IDraggableTarget } from "../components/IDraggableTarget.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";
import { GlobalEvent } from "./GlobalListenerManager.ts";
import type { IDragAndDropManager } from "./IDragAndDropManager.ts";
import { IDragAndDropManagerType } from "./IDragAndDropManager.ts";
import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator.ts";

@ImplementsDecorator(IDragAndDropManagerType)
export class DragAndDropManager<A extends IBaseApp<A>> extends DestructableEntity<A> implements IDragAndDropManager<A>
{
    private _draggable:IDraggable | undefined; //the draggable being dragged (if any)

    private _toDragTarget:IDraggableTarget | undefined; //the draggable that was dragged to (if any)
    private _toDraggable:IDraggable | undefined; //the draggable that was dragged to (if any)

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);

        app.globalListenerManager.subscribe(this, GlobalEvent.DragOver_Capture, (event:DragEvent) => event.preventDefault());
        app.globalListenerManager.subscribe(this, GlobalEvent.Drop_Capture, (event:DragEvent) => event.preventDefault());
    }

    onDragStart(draggable:IDraggable, event:DragEvent):void
    {
        if (this._draggable !== undefined) draggable.dragTarget.clearDragData(); //clear the previous drag data
        event.dataTransfer?.setData('framework', 'internal-drag');

        this._draggable = draggable;
        this._toDragTarget = undefined;
        this._toDraggable = undefined;

        draggable.dragTarget.createDragImage(draggable, event);
        draggable.dragTarget.setDragData(draggable, event);
    }
    
    public async onDragTargetDropped(toDragTarget:IDraggableTarget, event:DragEvent):Promise<void>
    {
        this._toDragTarget = toDragTarget;

        this.#handleExternalDrop(event); //if they dragged from outside the app, onDragStart and onDragEnd will not be called. we need to handle it here
    }

    public async onDraggableDropped(toDraggable:IDraggable, event:DragEvent):Promise<void>
    {
        this._toDragTarget = toDraggable.dragTarget;
        this._toDraggable = toDraggable;

        this.#handleExternalDrop(event); //if they dragged from outside the app, onDragStart and onDragEnd will not be called. we need to handle it here
    }

    #handleExternalDrop(event:DragEvent):void
    {
        const isExternalDrop = event.dataTransfer?.getData('framework') !== 'internal-drag';
        if (isExternalDrop !== true) return;

        if (this._toDragTarget === undefined) return; //they didn't drop it on anything targetable, so nothing to do

        this._toDragTarget.onDrop(undefined, this._toDraggable, event); //draggable will always be undefined for externally originated drops

        this._toDraggable = undefined;
        this._toDragTarget = undefined;
    }
    
    public async onDragEnd(_draggable:IDraggable, event:DragEvent):Promise<void>
    {
        if (this._toDragTarget === undefined) return; //they didn't drop it on anything targetable, so nothing to do

        this._toDragTarget.onDrop(this._draggable, this._toDraggable, event);

        this._draggable?.dragTarget.clearDragData();

        this._draggable = undefined;
        this._toDraggable = undefined;
        this._toDragTarget = undefined;
    }

    public get dragging():boolean
    {
        return this._draggable !== undefined;
    }

    public get draggable():IDraggable | undefined
    {
        return this._draggable;
    }
}