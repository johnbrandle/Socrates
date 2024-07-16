/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Turner } from "../basic/Turner";
import { IBaseApp } from "../IBaseApp";
import { type IDestructable } from "../IDestructable";
import type { IAbortableEntity } from "./IAbortableEntity";

export const IDestructableEntityType = Symbol("IDestructableEntity");

export interface IDestructableEntity<A extends IBaseApp<A>> extends IAbortableEntity<A>, IDestructable<A>
{
    get __turner():Turner<A>;
}