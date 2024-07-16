/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IDraggable } from "../components/IDraggable";
import type { IDraggableTarget } from "../components/IDraggableTarget";

export const IDragAndDropManagerType = Symbol("IDragAndDropManager");

export const ISSUE_TEXT = `Due to a known issue in the Chromium browser, the drag-and-drop functionality that enables moving items from the browser to the desktop is currently not operational.

For details on this problem and to follow its progress, please refer to the Chromium bug report: https://bugs.chromium.org/p/chromium/issues/detail?id=741778 If you'd like to express interest in getting this issue resolved, you're encouraged to leave a comment on that page.

Alternatively, if you need immediate access to this feature, you can download our desktop app, which fully supports the drag-and-drop functionality.

P.S.: There's an additional potential fix to this problem, but unfortunately, it's not currently supported either... More information can be found at: https://github.com/whatwg/streams/issues/480`;

export interface IDragAndDropManager<A extends IBaseApp<A>>
{
    /**
     * Handles the start of a drag event for a draggable.
     * This is called by a draggable when it is dragged.
     * @param draggable The draggable being dragged.
     * @param event The drag event.
     */
    onDragStart(draggable:IDraggable, event:DragEvent):void;

    /**
     * Handles the event when a draggable item is dropped onto a target.
     * This is called by a drag target when a draggable is dropped onto it.
     * @param toDragTarget - The target that the item was dropped onto.
     * @param event - The DragEvent object containing information about the drag and drop operation.
     */
    onDragTargetDropped(toDragTarget:IDraggableTarget, event:DragEvent):Promise<void>

    /**
     * Handles the drag and drop functionality for draggables.
     * This is called by a draggable when it is dropped.
     * @param totile The tile that the user is dropping onto.
     * @param event The drag event.
     * @returns Promise that resolves when the drag and drop operation is complete.
     */

    onDraggableDropped(toDraggable:IDraggable, event:DragEvent):Promise<void>
    
    /**
     * Called when the user finishes dragging.
     * This is called by a draggable when dragging ends.
     * @param draggable The draggable that was being dragged.
     */
    onDragEnd(_draggable:IDraggable, event:DragEvent):Promise<void>;

    /**
     * Returns a boolean indicating whether an element is currently being dragged.
     * @returns {boolean} True if an element is being dragged, false otherwise.
     */
    get dragging():boolean;

    /**
     * Gets the current draggable object being managed by this DragAndDropManager instance.
     * @returns The current draggable object, or undefined if there is none.
     */
    get draggable():IDraggable | undefined;
}