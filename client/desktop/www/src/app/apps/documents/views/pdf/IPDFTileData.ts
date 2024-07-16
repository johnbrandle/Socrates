/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { ITileData } from "../../../../../library/components/board/ITileData";

export const IPDFTileDataType = Symbol("IPDFTileData");

export interface IPDFTileData extends ITileData
{
}