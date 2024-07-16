/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IStorageTileData } from "../../../../../library/components/board/IStorageTileData";

export const ITabTileDataType = Symbol("ITabTileData");

export interface ITabTileData extends IStorageTileData
{
}