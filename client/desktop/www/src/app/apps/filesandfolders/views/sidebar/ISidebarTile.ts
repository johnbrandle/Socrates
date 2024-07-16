/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../../../../../library/IBaseApp";
import type { IStorageTile } from "../../../../../library/components/board/IStorageTile";
import type { ISidebarTileData } from "./ISidebarTileData";

export const ISidebarTileType = Symbol("ISidebarTile");

export interface ISidebarTile<A extends IBaseApp<A>, D extends ISidebarTileData> extends IStorageTile<A, D>
{
}