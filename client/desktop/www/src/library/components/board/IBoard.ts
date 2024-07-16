/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { ITileData } from "./ITileData";
import type { ITileable } from "./ITileable";
import type { ITile } from "./ITile";
import type { IBaseApp } from "../../IBaseApp";
import type { IDestructor } from "../../../../../../../shared/src/library/IDestructor";
import type { ICollection } from "../../../../../../../shared/src/library/collection/ICollection";

export const IBoardType = Symbol("IBoard");

export type TileConstructor<A extends IBaseApp<A>, D extends ITileData, T extends ITile<A, D>> = new (app:A, destructor:IDestructor<A>, element:HTMLElement, ...args:any[]) => T;

export interface IBoard<A extends IBaseApp<A>, D extends ITileData, T extends ITile<A, D>> extends ITileable<A, D, T>
{
    setDataProvider(dataProvider:ICollection<A, D> | undefined):Promise<void>;
    get dataProvider():ICollection<A, D> | undefined;
}