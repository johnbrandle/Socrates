/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { type IAbortable } from "../abort/IAbortable";
import { IBaseApp } from "../IBaseApp";
import type { IEntity } from "./IEntity";

export const IAbortableEntityType = Symbol("IAbortableEntity");

export interface IAbortableEntity<A extends IBaseApp<A>, R=any> extends IEntity<A>, IAbortable<R>
{
}