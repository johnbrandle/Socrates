/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IBaseApp } from "../IBaseApp";
import { type IObservable } from "../IObservable";

export const IEntityType = Symbol("IEntity");

export interface IEntity<A extends IBaseApp<A>> extends IObservable<A>
{
    toString():string;
}