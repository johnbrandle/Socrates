/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IStorageTile } from "../../../../../library/components/board/IStorageTile";
import type { IApp } from "../../../../IApp";
import type { ITreeTileData } from "./ITreeTileData";

export const ITreeTileType = Symbol("ITreeTile");

export interface ITreeTile<A extends IApp<A>, D extends ITreeTileData> extends IStorageTile<A, D>
{
}