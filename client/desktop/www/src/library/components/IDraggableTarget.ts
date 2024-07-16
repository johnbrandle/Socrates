/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IDraggable } from "./IDraggable";
import type { ISignal } from "../../../../../../shared/src/library/signal/ISignal";

export const IDraggableTargetType = Symbol("IDraggableTarget");

export interface IDraggableTarget
{
    createDragImage(draggable:IDraggable, event:DragEvent):void;
    setDragData(draggable:IDraggable, event:DragEvent):void;
    clearDragData():void;

    //draggable will be undefined if they dragged from outside the app
    //toDraggable will be undefined if they dropped on a target that is not a draggable, e.g., the dropzone vs a tile in the dropzone
    onDrop(draggable:IDraggable | undefined, toDraggable:IDraggable | undefined, event:DragEvent):void; 

    get onDropSignal():ISignal<[IDraggableTarget,  draggable:IDraggable | undefined, toDraggable:IDraggable | undefined, dragEvent:DragEvent]>; 
}