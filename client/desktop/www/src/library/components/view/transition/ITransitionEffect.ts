/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IViewer } from "../IViewer";
import type { IView } from "../IView";
import type { IDestructable } from "../../../../../../../../shared/src/library/IDestructable";
import type { IBaseApp } from "../../../IBaseApp";

export const ITransitionEffectType = Symbol("ITransitionEffect");

export interface ITransitionEffect<A extends IBaseApp<A>> extends IDestructable<A>
{
    before(viewer:IViewer<any>, fromView:IView<any>, toView:IView<any>):Promise<void>;
    during(percent:number):void;
    after():Promise<void>;
    get easing():((t:number, b:number, c:number, d:number, params?:any) => number) | undefined;
}