/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { AbortController } from "../../../../../../../../shared/src/library/abort/AbortController";
import type { IAbortable } from "../../../../../../../../shared/src/library/abort/IAbortable";
import type { IBaseApp } from "../../../IBaseApp";
import { Data } from "../../../../../../../../shared/src/library/data/Data";
import type { IAbortController } from "../../../../../../../../shared/src/library/abort/IAbortController";
import { IFileStorageAdapterType, type IFileStorageAdapter } from "../../../../../../../../shared/src/library/file/storage/adapters/IFileStorageAdapter";
import { AbortableEntity } from "../../../../../../../../shared/src/library/entity/AbortableEntity";
import { FolderPath, type FilePath } from "../../../../../../../../shared/src/library/file/Path";
import { ImplementsDecorator } from "../../../../../../../../shared/src/library/decorators/ImplementsDecorator";
import type { IError } from "../../../../../../../../shared/src/library/error/IError";
import type { IAborted } from "../../../../../../../../shared/src/library/abort/IAborted";
import type { IDatable } from "../../../../../../../../shared/src/library/data/IDatable";

interface ParentFolderPathHandle 
{
    parentDirectoryHandle:FileSystemDirectoryHandle,
    parentFolderPath:FolderPath,
    fileOrFolderPath:FolderPath | FilePath,
}

interface FilePathHandle
{
    parentDirectoryHandle:FileSystemDirectoryHandle,
    parentFolderPath:FolderPath,
    fileHandle:FileSystemFileHandle
    filePath:FilePath,
}

interface FolderPathHandle
{
    parentDirectoryHandle:FileSystemDirectoryHandle | undefined,
    parentFolderPath:FolderPath | undefined,
    directoryHandle:FileSystemDirectoryHandle,
    folderPath:FolderPath,
}

@ImplementsDecorator(IFileStorageAdapterType)
export class OPFSFileStorageAdapter<A extends IBaseApp<A>> extends AbortableEntity<A> implements IFileStorageAdapter<A>
{
    private _rootDirectoryPath:FolderPath;
    private _rootDirectoryHandle!:FileSystemDirectoryHandle;

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

            let directory = _.value(await navigator.storage.getDirectory());   
            for (const part of this._rootDirectoryPath.parts) directory = _.value(await directory.getDirectoryHandle(part, {create:true}));

            this._rootDirectoryHandle = directory;

            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to initialize', arguments, {names:[this.constructor, this.init]});
        }
    }

    public async exists(fileOrFolderPath:FolderPath | FilePath):Promise<false | 'file' | 'folder' | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const handle = _.value(await this.#resolve(fileOrFolderPath, {warn:false}));
            if (handle === undefined) return false;
            
            try 
            {
                try
                {
                    //check for the file 
                    _.check(await handle.parentDirectoryHandle.getFileHandle(handle.fileOrFolderPath.name));
     
                    return 'file';
                } 
                catch 
                {
                    //check for the directory
                    _.check(await handle.parentDirectoryHandle.getDirectoryHandle(handle.fileOrFolderPath.name));
    
                    return 'folder';
                }
            }
            catch (error) 
            {
                return false; //if fails, the file/directory does not exist
            }
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to check existence', arguments, {names:[this.constructor, this.exists]});
        }
    }
    
    public async createFolder(folderPath:FolderPath):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const handle = _.value(await this.#resolve(folderPath));

            //create the folder
            _.check(await handle.parentDirectoryHandle.getDirectoryHandle(handle.fileOrFolderPath.name, {create:true}));
            
            return true;
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

            const handle = _.value(await this.#resolve(filePath));

            //create the file
            _.check(await handle.parentDirectoryHandle.getFileHandle(handle.fileOrFolderPath.name, {create:true}));
            
            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to create file', arguments, {names:[this.constructor, this.createFile]});
        }
    }

    public async hasFileData(path:FilePath):Promise<boolean | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const handle = _.value(await this.#resolve(path, {type:'file', warn:false}));
            if (handle === undefined) return false;

            const file = _.value(await handle.fileHandle.getFile());

            return file.size > 0;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to check for file data', arguments, {names:[this.constructor, this.hasFileData]});
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

                const handle = _.value(await this.#resolve(filePath, {type:'file'}));

                const file = _.value(await handle.fileHandle.getFile());

                return file.stream();
            }
            catch (error)
            {
                return app.warn(error, 'Failed to get file data', arguments, {names:[this.constructor, this.getFileData]});
            }   
        });
    }

    public async setFileData(filePath:FilePath, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        let writable:FileSystemWritableFileStream | undefined;

        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            const handle = _.value(await this.#resolve(filePath, {type:'file'}));

            const stream = _.value(await data.get());
            
            writable = _.value(await handle.fileHandle.createWritable());

            _.check(await stream.pipeTo(writable, {signal:abortController.signal, preventClose:true}));
            
            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to set file data', arguments, {names:[this.constructor, this.setFileData]});
        }
        finally
        {
            try { await writable?.close(); } catch(error) {}
        }
    }

    public async renameFolder(_folderPath:FolderPath, _name:string):Promise<true | IAborted | IError>
    {
        this._app.throw('Not implemented', [], {correctable:true});
    }
    
    public async renameFile(_filePath:FilePath, _name:string):Promise<true | IAborted | IError>
    {
        this._app.throw('Not implemented', [], {correctable:true});
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

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            const handle = _.value(await this.#resolve(folderPath, {warn:true, type:'folder'}));

            for await (const fileOrFolderPath of this.#listFolder(handle, abortController)) yield _.result(fileOrFolderPath);
        }
        catch (error)
        {
            yield this._app.warn(error, 'Failed to list folder', arguments, {names:[this.constructor, this.listFolder]});
        }
    }

    async *#listFolder(handle:FolderPathHandle, abortController:IAbortController<A>):AsyncGenerator<FolderPath | FilePath | IAborted | IError>
    {
        try
        {
            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            //@ts-ignore
            for await (const [name, entry] of handle.directoryHandle.entries() as AsyncGenerator<[string, FileSystemHandle]>)
            {
                if (entry.kind === 'directory') _.check(yield _.result(handle.folderPath.getSubFolder(name)));
                else if (entry.kind === 'file') _.check(yield _.result(handle.folderPath.getSubFile(name)));
            }
        }
        catch (error)
        {
            yield this._app.warn(error, 'Failed to list folder', arguments, {names:[this.constructor, this.#listFolder]});
        }
    }

    public async deleteFolder(folderPath:FolderPath, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, this);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            const handle = _.value(await this.#resolve(folderPath, {type:'folder', warn:false}));
            if (handle === undefined) return true; //if the folder doesn't exist, return true

            //check if the folder exists
            const exists = _.value(await this.exists(folderPath));
            if (exists !== 'folder' && options?.isOkayIfNotExists !== true) return this._app.throw('Folder does not exist', [folderPath.toString()]);

            //verify the folder does not have anything in it
            for await (const fileOrFolderPath of this.#listFolder(handle, abortController)) 
            {
                _.check(fileOrFolderPath);

                this._app.throw('Folder is not empty', [handle.folderPath.toString()]);
            }
            if (handle.parentDirectoryHandle === undefined) return true; //if the folder is the root folder, return true

            _.check(await handle.parentDirectoryHandle.removeEntry(handle.folderPath.name).catch(error => 
            {
                //if (error instanceof Error && error.name === 'NotFoundError') return; //if the folder doesn't exist, return

                throw error;
            }));

            return true;
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

            const handle = _.value(await this.#resolve(filePath, {type:'file', warn:false}));
            if (handle === undefined) return true;

            //check if the file exists
            const exists = _.value(await this.exists(filePath));
            if (exists !== 'file' && options?.isOkayIfNotExists !== true) return this._app.throw('File does not exist', [filePath.toString()]);

            //delete the file
            _.check(await handle.parentDirectoryHandle.removeEntry(handle.filePath.name).catch(error =>
            {
                //if (error instanceof Error && error.name === 'NotFoundError') return; //if the file doesn't exist, return

                throw error;
            }));

            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to delete file', arguments, {names:[this.constructor, this.deleteFile]});
        }
    }

    async #resolve(fileOrFolderPath:FolderPath | FilePath, options?:{warn?:true, type?:'parent'}):Promise<ParentFolderPathHandle | IError>;
    async #resolve(filePath:FilePath, options?:{warn?:true, type:'file'}):Promise<FilePathHandle | IError>;
    async #resolve(folderPath:FolderPath, options?:{warn?:true, type:'folder'}):Promise<FolderPathHandle | IError>;
    async #resolve(fileOrFolderPath:FolderPath | FilePath, options:{warn:false, type?:'parent'}):Promise<ParentFolderPathHandle | undefined>;
    async #resolve(filePath:FilePath, options:{warn:false, type:'file'}):Promise<FilePathHandle | undefined>;
    async #resolve(folderPath:FolderPath, options:{warn:false, type:'folder'}):Promise<FolderPathHandle | undefined>;
    async #resolve(fileOrFolderPath:FolderPath | FilePath, options?:{warn?:boolean, type?:'parent'|'folder'|'file'}):Promise<ParentFolderPathHandle | FolderPathHandle | FilePathHandle | IError | undefined>
    {
        try
        {
            //get the parent directory handle
            let parentDirectoryHandle = this._rootDirectoryHandle;
            for (const part of fileOrFolderPath.ancestorParts) parentDirectoryHandle = await parentDirectoryHandle.getDirectoryHandle(part, {create:false});

            if (options?.type === 'folder')
            {
                if (fileOrFolderPath.parent === undefined) return {parentDirectoryHandle:undefined, parentFolderPath:undefined, directoryHandle:parentDirectoryHandle, folderPath:fileOrFolderPath as FolderPath};
                
                const directoryHandle = await parentDirectoryHandle.getDirectoryHandle(fileOrFolderPath.name, {create:false});
                
                return {parentDirectoryHandle, parentFolderPath:fileOrFolderPath.parent, directoryHandle, folderPath:fileOrFolderPath as FolderPath};
            }

            if (options?.type === 'file')
            {
                const fileHandle = await parentDirectoryHandle.getFileHandle(fileOrFolderPath.name, {create:false});

                return {parentDirectoryHandle, parentFolderPath:fileOrFolderPath.parent!, fileHandle, filePath:fileOrFolderPath as FilePath};
            }

            return {parentDirectoryHandle, parentFolderPath:fileOrFolderPath.parent ?? new FolderPath('/'), fileOrFolderPath};
        }
        catch (error)
        {
            if (options?.warn !== false) return this._app.warn(error, 'Failed to resolve', arguments, {errorOnly:true, names:[this.constructor, this.#resolve]});
            
            return undefined;
        }
    }
}