/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../../../../../library/IBaseApp";
import type { ITile } from "../../../../../library/components/board/ITile";
import type { IPDFTileData } from "./IPDFTileData";

export const IPDFTileType = Symbol("IPDFTile");

export interface IPDFTile<A extends IBaseApp<A>, D extends IPDFTileData> extends ITile<A, D>
{
}