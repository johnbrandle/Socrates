/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IDriveFileInfo, IDriveFolderInfo } from "../../../../../../../shared/src/library/file/drive/IDrive";
import type { ITileData } from "./ITileData";

export const IStandardFolderTileDataType = Symbol("IStandardFolderTileData");

export interface IStorageTileData extends ITileData
{
    info?:IDriveFileInfo | IDriveFolderInfo;
}