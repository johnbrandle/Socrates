/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { IContextable } from "../components/IContextable";

export interface IContextMenuData
{
    items:Array<IContextMenuItemData>;
}

export interface IContextMenuItemData
{
    label?:string;
    action?:() => void;
    items?:Array<IContextMenuItemData>;
}

export const IContextMenuManagerType = Symbol("IContextMenuManager");

export interface IContextMenuManager<A extends IBaseApp<A>>
{
    disableContextMenu():void;
    add(contextable:IContextable):void;
    remove(contextable:IContextable):void;
}