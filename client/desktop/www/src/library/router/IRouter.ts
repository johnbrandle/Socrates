/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAborted } from "../../../../../../shared/src/library/abort/IAborted";
import type { IError } from "../../../../../../shared/src/library/error/IError";
import type { IViewer } from "../components/view/IViewer";
import type { IBaseApp } from "../IBaseApp";

export const IRouterType = Symbol("IRouter");

export interface IRouter<A extends IBaseApp<A>>
{    
    register(viewer:IViewer<any>):void;
    unregister(viewer:IViewer<any>):void;
    getIndex(viewer:IViewer<any>):number;
    goto(pathname:string, options?:{createHistoryEntry?:boolean, goto?:boolean}):Promise<boolean | IAborted | IError>;
    redirect(route:string):void;
}