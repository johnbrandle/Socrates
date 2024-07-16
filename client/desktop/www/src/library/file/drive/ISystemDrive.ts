/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../../IBaseApp";
import type { IDrive } from "../../../../../../../shared/src/library/file/drive/IDrive";
import type { IDriveFolder } from "../../../../../../../shared/src/library/file/drive/IDriveFolder";
import type { FolderPath } from "../../../../../../../shared/src/library/file/Path";

export const ISystemDriveType = Symbol("ISystemDrive");

export interface ISystemDrive<A extends IBaseApp<A>> extends IDrive<A>
{
    get trashFolderPath():FolderPath;
    get homeFolderPath():FolderPath;
    get desktopFolderPath():FolderPath;
    get appsFolderPath():FolderPath;
    get systemFolderPath():FolderPath;
    get tempFolderPath():FolderPath;
    get appDataFolderPath():FolderPath;
    get userInfoFolderPath():FolderPath;

    get trashFolder():IDriveFolder<A>;
    get homeFolder():IDriveFolder<A>;
    get desktopFolder():IDriveFolder<A>;
    get appsFolder():IDriveFolder<A>;
    get systemFolder():IDriveFolder<A>;
    get tempFolder():IDriveFolder<A>;
    get appDataFolder():IDriveFolder<A>;
    get userInfoFolder():IDriveFolder<A>;
}