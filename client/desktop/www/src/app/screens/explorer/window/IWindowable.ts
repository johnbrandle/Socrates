/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from "../../../IApp";
import type { WindowManager } from "../WindowManager";

export const IWindowableType = Symbol("IWindowable");

export interface IWindowable<A extends IApp<A>>
{
    get windowContainer():HTMLElement;
    getBounds():{left:number, top:number, right:number, bottom:number};
    get windowManager():WindowManager<A>;
}