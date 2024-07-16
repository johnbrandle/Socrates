/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IBaseApp } from "./IBaseApp";
import type { IUIdentifiable } from "./IUIdentifiable";
import type { IWeakSignal } from "./signal/IWeakSIgnal";

export const IObservableType = Symbol("IObservable");

export interface IObservable<A extends IBaseApp<A>> extends IUIdentifiable
{
    onChangeSignal:IWeakSignal<[IObservable<A>, type:Symbol, changed:JsonObject | undefined]>;
    get className():string;
    get app():A;
}