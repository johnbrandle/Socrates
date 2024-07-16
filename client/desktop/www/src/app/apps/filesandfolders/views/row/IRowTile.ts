/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../../../../../library/IBaseApp";
import type { IStorageTile } from "../../../../../library/components/board/IStorageTile";
import type { IRowTileData } from "./IRowTileData";

export const IRowTileType = Symbol("IRowTile");

export interface IRowTile<A extends IBaseApp<A>, D extends IRowTileData> extends IStorageTile<A, D>
{
}