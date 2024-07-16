/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../../../../../library/IBaseApp";
import type { IStorageTile } from "../../../../../library/components/board/IStorageTile";
import type { IGridTileData } from "./IGridTileData";

export const IGridTileType = Symbol("IGridTile");

export interface IGridTile<A extends IBaseApp, D extends IGridTileData> extends IStorageTile<A, D>
{
}