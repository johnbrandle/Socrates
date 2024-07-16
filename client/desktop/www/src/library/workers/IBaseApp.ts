/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp as ISharedBaseApp } from "../../../../../../shared/src/library/IBaseApp";

export const IBaseAppType = Symbol("IBaseApp");

export interface IBaseApp<A extends IBaseApp<A>> extends ISharedBaseApp<A>
{
}