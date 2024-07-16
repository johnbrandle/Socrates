/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IComponent } from "./IComponent";
import type { IDraggableTarget } from "./IDraggableTarget";

export const IDraggableType = Symbol("IDraggable");

export interface IDraggable extends IComponent
{
    get dragTarget():IDraggableTarget;

    get dragging():boolean;
}