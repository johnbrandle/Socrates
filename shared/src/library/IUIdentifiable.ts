/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { uid } from "./utils/UIDUtil";

export const IUIdentifiableType = Symbol("IUIdentifiable");

export interface IUIdentifiable 
{
    /**
     * @return	global unique id, used for identification globally.
     */
    get uid():uid;
}