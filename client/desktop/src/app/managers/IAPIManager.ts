/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IError } from "../../../../../shared/src/library/error/IError";
import type { uid } from "../../../../../shared/src/library/utils/UIDUtil";
import type { AppAPI } from "../api/AppAPI";
import type { IApp } from "../IApp";

export const IAPIManagerType = Symbol("IAPIManager");

export interface IAPIManager<A extends IApp<A>>
{
    get api():AppAPI;
    handleRequest(key:uid, path:string[], data:ReadableStream<Uint8Array> | undefined):Promise<Response | IError>;
}