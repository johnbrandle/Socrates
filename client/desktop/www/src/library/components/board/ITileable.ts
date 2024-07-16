/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IDraggableTarget } from "../IDraggableTarget";
import type { IBaseApp } from "../../IBaseApp";
import type { ITileData } from "./ITileData";
import type { ITile } from "./ITile";
import type { TileConstructor } from "./IBoard";

export const ITileableType = Symbol("ITileable");

export interface ITileable<A extends IBaseApp<A>, D extends ITileData, T extends ITile<A, D>> extends IDraggableTarget
{
    getTile:(data:D, getFromPool:(tileConstructor:TileConstructor<A, D, T>) => InstanceType<TileConstructor<A, D, T>> | undefined) => [InstanceType<TileConstructor<A, D, T>>, Promise<void>];
    onTileRenewed:(tile:InstanceType<TileConstructor<A, D, T>>) => void; //function to renew a tile
    onTileReturned:(tile:InstanceType<TileConstructor<A, D, T>>) => void; //function to dispose of a tile

    get selected():Array<D>;
    set selected(val:Array<D>);
}