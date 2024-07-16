/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { ISystemDriveType, type ISystemDrive } from "./ISystemDrive";
import { Drive } from "./Drive";
import type { IBaseApp } from "../../IBaseApp";
import type { IFileStorage } from "../../../../../../../shared/src/library/file/storage/IFileStorage";
import type { IDrive, IDriveFolderMetadata } from "../../../../../../../shared/src/library/file/drive/IDrive";
import type { IDriveFolder } from "../../../../../../../shared/src/library/file/drive/IDriveFolder";
import type { IDriveFile } from "../../../../../../../shared/src/library/file/drive/IDriveFile";
import { ImplementsDecorator } from "../../../../../../../shared/src/library/decorators/ImplementsDecorator";
import type { FilePath, FolderPath } from "../../../../../../../shared/src/library/file/Path";
import type { IError } from "../../../../../../../shared/src/library/error/IError";
import type { IAborted } from "../../../../../../../shared/src/library/abort/IAborted";
import type { uid } from "../../utils/UIDUtil";

enum CoreFolderName
{
    Home = 'home',
    Desktop = 'desktop',
    Apps = 'apps',
    System = 'system',
    Temp = 'temp',
    AppData = 'appdata',
    UserInfo = 'userinfo',
    Trash = 'trash',
}

@ImplementsDecorator(ISystemDriveType)
export class SystemDrive<A extends IBaseApp<A>> extends Drive<A> implements ISystemDrive<A>
{
    constructor(app:A, uid:uid, createStorageAdapter:(app:A, drive:IDrive<A>) => Promise<IFileStorage<A> | IAborted | IError>, createFolder:(drive:IDrive<A>, path:FolderPath) => IDriveFolder<A>, createFile:(drive:IDrive<A>, path:FilePath) => IDriveFile<A>) 
    {
        super(app, uid, createStorageAdapter, createFolder, createFile);
    }

    public async init():Promise<true | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            _.check(await super.init());

            const metadata:IDriveFolderMetadata = {immutable:true, hidden:false, compressed:false, app:false, extra:{}};

            const rootFolderPath = this.rootFolderPath;

            //create home folder if not exists
            let name = CoreFolderName.Home;
            let folderPath = rootFolderPath.getSubFolder(name);
            _.check(await this.createFolderIfNotExists(folderPath, metadata));
            const homeFolderPath = this._coreFolderPaths[name] = folderPath;

                //create desktop folder if not exists
                name = CoreFolderName.Desktop;
                folderPath = homeFolderPath.getSubFolder(name);
                _.check(await this.createFolderIfNotExists(folderPath, metadata));
                this._coreFolderPaths[name] = folderPath;

            //create apps folder if not exists
            name = CoreFolderName.Apps;
            folderPath = rootFolderPath.getSubFolder(name);
            _.check(await this.createFolderIfNotExists(folderPath, metadata));
            this._coreFolderPaths[name] = folderPath;

            //create system folder if not exists
            name = CoreFolderName.System;
            folderPath = rootFolderPath.getSubFolder(name);
            _.check(await this.createFolderIfNotExists(folderPath, metadata));
            const sytemFolderPath = this._coreFolderPaths[name] = folderPath;

                //create temp folder if not exists
                name = CoreFolderName.Temp;
                folderPath = sytemFolderPath.getSubFolder(name);
                _.check(await this.createFolderIfNotExists(folderPath, metadata));
                this._coreFolderPaths[name] = folderPath;

                //create appdata folder if not exists
                name = CoreFolderName.AppData;
                folderPath = sytemFolderPath.getSubFolder(name);
                _.check(await this.createFolderIfNotExists(folderPath, metadata));
                this._coreFolderPaths[name] = folderPath;

                //create userinfo folder if not exists
                name = CoreFolderName.UserInfo;
                folderPath = sytemFolderPath.getSubFolder(name);
                _.check(await this.createFolderIfNotExists(folderPath, metadata));
                this._coreFolderPaths[name] = folderPath;

            //create trash folder if not exists
            name = CoreFolderName.Trash;
            folderPath = rootFolderPath.getSubFolder(name);
            _.check(await this.createFolderIfNotExists(folderPath, metadata));
            this._coreFolderPaths[name] = folderPath;

            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to initialize', arguments, {errorOnly:true, names:[SystemDrive, this.init]});
        }
    }

    public get trashFolderPath():FolderPath { return this._coreFolderPaths[CoreFolderName.Trash]; }
    public get homeFolderPath():FolderPath { return this._coreFolderPaths[CoreFolderName.Home]; }
    public get desktopFolderPath():FolderPath { return this._coreFolderPaths[CoreFolderName.Desktop]; }
    public get appsFolderPath():FolderPath { return this._coreFolderPaths[CoreFolderName.Apps]; }
    public get systemFolderPath():FolderPath { return this._coreFolderPaths[CoreFolderName.System]; }
    public get tempFolderPath():FolderPath { return this._coreFolderPaths[CoreFolderName.Temp]; }
    public get appDataFolderPath():FolderPath { return this._coreFolderPaths[CoreFolderName.AppData]; }
    public get userInfoFolderPath():FolderPath { return this._coreFolderPaths[CoreFolderName.UserInfo]; }

    public get trashFolder():IDriveFolder<A> { return this.getFolder(this._coreFolderPaths[CoreFolderName.Trash]); }
    public get homeFolder():IDriveFolder<A> { return this.getFolder(this._coreFolderPaths[CoreFolderName.Home]); }
    public get desktopFolder():IDriveFolder<A> { return this.getFolder(this._coreFolderPaths[CoreFolderName.Desktop]); }
    public get appsFolder():IDriveFolder<A> { return this.getFolder(this._coreFolderPaths[CoreFolderName.Apps]); }
    public get systemFolder():IDriveFolder<A> { return this.getFolder(this._coreFolderPaths[CoreFolderName.System]); }
    public get tempFolder():IDriveFolder<A> { return this.getFolder(this._coreFolderPaths[CoreFolderName.Temp]); }
    public get appDataFolder():IDriveFolder<A> { return this.getFolder(this._coreFolderPaths[CoreFolderName.AppData]); }
    public get userInfoFolder():IDriveFolder<A> { return this.getFolder(this._coreFolderPaths[CoreFolderName.UserInfo]); }
}