/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { uid } from "../../../../../shared/src/library/utils/UIDUtil";
import type { IError } from "../../../../../shared/src/library/error/IError";

export const IInstanceManagerType = Symbol("IInstanceManager");

export interface IInstanceManager<A extends IBaseApp<A>>
{
    create(path:string[], args:any[]):uid | IError;
    remove(uid:uid):true | IError;
    
    callOn(uid:uid, path:string[], ...args:any[]):Promise<unknown | IError>;
    
    get(uid:uid):any | undefined;
}