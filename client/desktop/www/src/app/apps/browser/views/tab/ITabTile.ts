/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../../../../../library/IBaseApp";
import type { IStorageTile } from "../../../../../library/components/board/IStorageTile";
import type { ITabTileData } from "./ITabTileData";

export const ITabTileType = Symbol("ITabTile");

export interface ITabTile<A extends IBaseApp<A>, D extends ITabTileData> extends IStorageTile<A, D>
{
}