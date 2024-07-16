/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Paths } from "../../../../../../shared/src/app/Paths";
import { AbortController } from "../../../../../../../../shared/src/library/abort/AbortController";
import type { IAbortController } from "../../../../../../../../shared/src/library/abort/IAbortController";
import type { IAbortable } from "../../../../../../../../shared/src/library/abort/IAbortable";
import { Data } from "../../../../../../../../shared/src/library/data/Data";
import { AbortableEntity } from "../../../../../../../../shared/src/library/entity/AbortableEntity";
import { IFileStorageAdapterType, type IFileStorageAdapter } from "../../../../../../../../shared/src/library/file/storage/adapters/IFileStorageAdapter";
import { RemoteFileSystem } from "../../../bridge/classes/FileSystem";
import type { IApp } from "../../../IApp";
import { ImplementsDecorator } from "../../../../../../../../shared/src/library/decorators/ImplementsDecorator";
import type { filepath, FilePath, folderpath, FolderPath } from "../../../../../../../../shared/src/library/file/Path";
import type { IError } from "../../../../../../../../shared/src/library/error/IError";
import { type IAborted } from "../../../../../../../../shared/src/library/abort/IAborted";
import type { IDatable } from "../../../../../../../../shared/src/library/data/IDatable";

@ImplementsDecorator(IFileStorageAdapterType)
export class BridgeFileStorageAdapter<A extends IApp<A>> extends AbortableEntity<A> implements IFileStorageAdapter<A>
{
    private _rootDirectoryPath:FolderPath;

    private _fileSystem!:RemoteFileSystem<A>;

    constructor(app:A, rootDirectoryPath:FolderPath) 
    {
        super(app);

        this._rootDirectoryPath = rootDirectoryPath;
    }

    public async init():Promise<true | IAborted | IError>
    {       
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            this._fileSystem = new RemoteFileSystem(this._app, Paths.data);

            return _.value(await this._fileSystem.createFolder(this.#resolve(this._rootDirectoryPath)));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to initialize', [this._rootDirectoryPath], {names:[this.constructor, this.init]});
        }
    }

    public async exists(fileOrFolderPath:FolderPath | FilePath):Promise<false | 'file' | 'folder' | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const resolvedFileOrFolderPath = this.#resolve(fileOrFolderPath as any);

            return _.value(await this._fileSystem.exists(resolvedFileOrFolderPath));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to check if exists', arguments, {names:[this.constructor, this.exists]});
        }
    }

    public async createFolder(folderPath:FolderPath):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const resolvedFolderPath = this.#resolve(folderPath);

            //create the folder
            return _.value(await this._fileSystem.createFolder(resolvedFolderPath));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to create folder', arguments, {names:[this.constructor, this.createFolder]});
        }
    }

    public async createFile(filePath:FilePath):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const resolvedFilePath = this.#resolve(filePath);

            //create the file
            return _.value(await this._fileSystem.createFile(resolvedFilePath));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to create file', arguments, {names:[this.constructor, this.createFile]});
        }
    }

    public async hasFileData(filePath:FilePath):Promise<boolean | IAborted | IError>
    {
        try
        {   const _ = this.abortableHelper.throwIfAborted();

            const resolvedFilePath = this.#resolve(filePath);

            return _.value(await this._fileSystem.hasFileData(resolvedFilePath));

        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to check if file has data', arguments, {names:[this.constructor, this.hasFileData]});
        }
    }
    
    public async getFileData(filePath:FilePath, abortable:IAbortable):Promise<IDatable<ReadableStream<Uint8Array>>>
    {
        const app = this._app;

        return new Data(app, async () => 
        {
            try
            {
                const abortController = new AbortController(app, [this, abortable]);

                const _ = this.createAbortableHelper(abortController).throwIfAborted();

                const resolvedFilePath = this.#resolve(filePath);

                const data = _.value(await this._fileSystem.getFileData(resolvedFilePath, abortController));

                return _.value(await data.get()) as ReadableStream<Uint8Array>;
            }
            catch (error)
            {
                return app.warn(error, 'Failed to get file data', arguments, {names:[this.constructor, this.getFileData]});
            }
        });
    }

    public async setFileData(filePath:FilePath, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            const resolvedFilePath = this.#resolve(filePath);

            return _.value(await this._fileSystem.setFileData(resolvedFilePath, data as any, abortController));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to set file data', arguments, {names:[this.constructor, this.setFileData]});
        }
    }

    public async renameFolder(folderPath:FolderPath, name:string):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const resolvedFolderPath = this.#resolve(folderPath);

            return _.value(await this._fileSystem.renameFolder(resolvedFolderPath, name));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to rename folder', arguments, {names:[this.constructor, this.renameFolder]});
        }
    }
    
    public async renameFile(filePath:FilePath, name:string):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const resolvedFilePath = this.#resolve(filePath);

            return _.value(await this._fileSystem.renameFile(resolvedFilePath, name));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to rename file', arguments, {names:[this.constructor, this.renameFile]});
        }
    }

    public get hasNativeSupportForRenaming():boolean
    {
        return false;
    }

    public async *listFolder(folderPath:FolderPath, abortable:IAbortable):AsyncGenerator<FolderPath | FilePath | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            for await (const fileOrFolderPath of this.#listFolder(folderPath, abortController)) yield this._app.extractOrRethrow(fileOrFolderPath);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to list folder', arguments, {names:[this.constructor, this.listFolder]});
        }
    }

    async *#listFolder(folderPath:FolderPath, abortController:IAbortController<A>):AsyncGenerator<FolderPath | FilePath | IAborted | IError>
    {
        try
        {
            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            const resolvedFolderPath = this.#resolve(folderPath);

            for await (const next of _.value(await this._fileSystem.listFolder(resolvedFolderPath, abortController))) 
            {
                const {name, type} = _.value(next);

                if (type === 'file') yield folderPath.getSubFile(name);
                else yield folderPath.getSubFolder(name);
            }
            _.check(); //check again after the for await loop
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to list folder', arguments, {names:[this.constructor, this.#listFolder]});
        }
    }

    public async deleteFolder(folderPath:FolderPath, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, this);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            const resolvedFolderPath = this.#resolve(folderPath);

            //check if the folder exists
            const exists = _.value(await this._fileSystem.exists(resolvedFolderPath));
            if (exists === false) return options?.isOkayIfNotExists ? true : this._app.throw('Folder does not exist', []);

            //verify the folder does not have anything in it
            for await (let fileOrFolderPath of this.#listFolder(folderPath, abortController)) 
            {
                _.check(fileOrFolderPath);

                this._app.throw('Folder is not empty', []);
            }
            _.check(); //check again after the for await loop

            if (folderPath.equals(this._rootDirectoryPath)) return true; //do not delete the root directory

            //delete the folder
            return _.value(await this._fileSystem.deleteFolder(resolvedFolderPath, options));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to delete folder', arguments, {names:[this.constructor, this.deleteFolder]});
        }
    }

    public async deleteFile(filePath:FilePath, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const resolvedFilePath = this.#resolve(filePath);

            //delete the file
            return _.value(await this._fileSystem.deleteFile(resolvedFilePath, options));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to delete file', arguments, {names:[this.constructor, this.deleteFile]});
        }
    }

    #resolve(folderPath:FolderPath):folderpath;
    #resolve(filePath:FilePath):filepath;
    #resolve(fileorFolderPath:FilePath | FolderPath)
    {
        if (fileorFolderPath.equals(this._rootDirectoryPath)) return this._rootDirectoryPath.toString();

        if (fileorFolderPath.type === 'folder') return this._rootDirectoryPath.getSubFolder(fileorFolderPath).toString();

        return this._rootDirectoryPath.getSubFile(fileorFolderPath).toString();
    }
}