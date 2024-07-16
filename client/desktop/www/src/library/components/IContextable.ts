/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IComponent } from "./IComponent";
import type { IContextMenuData } from "../managers/IContextMenuManager";

export const IContextableType = Symbol("IContextable");

export interface IContextable extends IComponent
{
    onContextMenu:(event:MouseEvent) => IContextMenuData | undefined;
}