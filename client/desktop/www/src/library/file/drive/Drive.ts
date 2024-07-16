/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../../IBaseApp";
import { AncillaryDataType, DataFormat, FileType, IDriveType, type IDrive, type IDriveFileInfo, type IDriveFileMetadata, type IDriveFolderInfo, type IDriveFolderMetadata } from "../../../../../../../shared/src/library/file/drive/IDrive";
import { type IAbortable } from "../../../../../../../shared/src/library/abort/IAbortable";
import type { IFileStorage } from "../../../../../../../shared/src/library/file/storage/IFileStorage";
import type { IDriveFolder } from "../../../../../../../shared/src/library/file/drive/IDriveFolder";
import type { IDriveFile } from "../../../../../../../shared/src/library/file/drive/IDriveFile";
import { WeakValueMap } from "../../../../../../../shared/src/library/weak/WeakValueMap";
import { IDatableType, type IDatable } from "../../../../../../../shared/src/library/data/IDatable";
import { Data } from "../../../../../../../shared/src/library/data/Data";
import { AbortableEntity } from "../../../../../../../shared/src/library/entity/AbortableEntity";
import { ImplementsDecorator } from "../../../../../../../shared/src/library/decorators/ImplementsDecorator";
import { FilePath, FolderPath, Path, type filepath, type folderpath, type path } from "../../../../../../../shared/src/library/file/Path";
import { type json } from "../../../../../../../shared/src/library/utils/JSONUtil";
import type { IError } from "../../../../../../../shared/src/library/error/IError";
import type { IAborted } from "../../../../../../../shared/src/library/abort/IAborted";
import { AbortController } from "../../../../../../../shared/src/library/abort/AbortController";
import type { AbortableHelper } from "../../../../../../../shared/src/library/helpers/AbortableHelper";
import type { uid } from "../../utils/UIDUtil";

enum CoreFolderName
{
    Root = '',
}

@ImplementsDecorator(IDriveType)
export abstract class Drive<A extends IBaseApp<A>> extends AbortableEntity<A> implements IDrive<A>
{
    #_storageAdapter!:IFileStorage<A>;

    protected _coreFolderPaths = {} as Record<string, FolderPath>;

    #_cache = new WeakValueMap<string, IDriveFolder<A> | IDriveFile<A>>(true);
    #_createStorageAdapter:(app:A, drive:IDrive<A>) => Promise<IFileStorage<A> | IAborted | IError>;
    #_createFolder:(drive:IDrive<A>, path:FolderPath) => IDriveFolder<A>;
    #_createFile:(drive:IDrive<A>, path:FilePath) => IDriveFile<A>;

    constructor(app:A, uid:uid, createStorageAdapter:(app:A, drive:IDrive<A>) => Promise<IFileStorage<A> | IAborted | IError>, createFolder:(drive:IDrive<A>, path:FolderPath) => IDriveFolder<A>, createFile:(drive:IDrive<A>, path:FilePath) => IDriveFile<A>)
    {
        super(app, uid);

        this.#_createStorageAdapter = createStorageAdapter;
        this.#_createFolder = createFolder;
        this.#_createFile = createFile;
    }

    private _initialized = false;
    public async init():Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            if (this._initialized === true) this._app.throw('drive has already been initialized', []);
            this._initialized = true;

            this.#_storageAdapter = _.value(await this.#_createStorageAdapter(this._app, this));

            this._coreFolderPaths[CoreFolderName.Root] = new FolderPath('/');
            
            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to initialize drive', arguments, {names:[Drive, this.init]});
        }
    }

    public async exists(path:FilePath | FolderPath):Promise<false | 'file' | 'folder' | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            return _.value(await this.#_storageAdapter.exists(path));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to check if path exists', arguments, {names:[Drive, this.exists]});
        }
    }
    public async existsFolder(path:FolderPath):Promise<boolean | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            return _.value(await this.#_storageAdapter.existsFolder(path));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to check if folder exists', arguments, {names:[Drive, this.existsFolder]});
        }
    }
    public async existsFile(path:FilePath):Promise<boolean | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            return _.value(await this.#_storageAdapter.existsFile(path));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to check if file exists', arguments, {names:[Drive, this.existsFile]});
        }
    }
    
    public async createFolder<T extends IDriveFolderMetadata>(path:FolderPath, metadata:T):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            //try to create folder
            _.check(await this.#_storageAdapter.createFolder(path, {metadata}));

            //notify parent folder of new child
            return this.#notifyParentChildWasAdded(path);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to create folder', arguments, {names:[Drive, this.createFolder]});
        }
    }
    public async createFolderIfNotExists<T extends IDriveFolderMetadata>(path:FolderPath, metadata:T):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            //if folder exists, return true
            if (_.value(await this.existsFolder(path)) === true) return true;

            //try to create folder
            return _.value(await this.createFolder(path, metadata));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to create folder if it does not exist', arguments, {names:[Drive, this.createFolderIfNotExists]});
        }
    }
    public async createFile<T extends IDriveFileMetadata>(path:FilePath, metadata:T):Promise<true | IAborted | IError>;
    public async createFile<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable):Promise<true | IAborted | IError>;
    public async createFile<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:ReadableStream<Uint8Array>, abortable:IAbortable):Promise<true | IAborted | IError>;
    public async createFile<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:Uint8Array, abortable:IAbortable):Promise<true | IAborted | IError>;
    public async createFile<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:JsonObject, abortable:IAbortable):Promise<true | IAborted | IError>;
    public async createFile<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:string, abortable:IAbortable):Promise<true | IAborted | IError>;
    public async createFile<T extends IDriveFileMetadata>(path:FilePath, metadata:T, obj?:IDatable<ReadableStream<Uint8Array>> | ReadableStream<Uint8Array> | Uint8Array | JsonObject | string, abortable?:IAbortable):Promise<true | IAborted | IError>
    {
        const app = this._app;

        try
        {
            const abortController = new AbortController(app, abortable === undefined ? this : [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            //try to create file
            _.check(await this.#_storageAdapter.createFile(path, {metadata}));

            //if data is not provided, notify parent and return true
            if (obj === undefined) return this.#notifyParentChildWasAdded(path);

            //make sure data is in the correct type. if not, convert it.
            let data:IDatable<ReadableStream<Uint8Array>> | undefined;
            if (app.typeUtil.is<IDatable<ReadableStream<Uint8Array>>>(obj, IDatableType) === true) data = obj;
            else if (app.typeUtil.is<ReadableStream<Uint8Array>>(obj, ReadableStream) === true) data = new Data(app, async () => obj);
            else if (app.typeUtil.is<Uint8Array>(obj, Uint8Array) === true) data = new Data(app, async () => app.streamUtil.fromUint8Array(obj));
            else if (app.typeUtil.isString(obj) === true) data = new Data(app, async () => this._app.streamUtil.fromUint8Array(app.textUtil.toUint8Array(obj)));
            else data = new Data(app, async () => app.streamUtil.fromUint8Array(app.textUtil.toUint8Array(app.jsonUtil.stringify(obj))));

            //try to set file data
            _.check(await this.#_storageAdapter.setFileData(path, data, abortController));

            //even if we failed to set the file data, still notify parent
            return this.#notifyParentChildWasAdded(path);
        }
        catch (error)
        {
            return app.warn(error, 'Failed to create file', arguments, {names:[Drive, this.createFile]});
        }
    }
    public async createFileIfNotExists<T extends IDriveFileMetadata>(path:FilePath, metadata:T):Promise<true | IAborted | IError>;
    public async createFileIfNotExists<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<true | IAborted | IError>;
    public async createFileIfNotExists<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:ReadableStream<Uint8Array>, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<true | IAborted | IError>;
    public async createFileIfNotExists<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:Uint8Array, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<true | IAborted | IError>;
    public async createFileIfNotExists<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:JsonObject, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<true | IAborted | IError>;
    public async createFileIfNotExists<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:string, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<true | IAborted | IError>;
    public async createFileIfNotExists<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data?:IDatable<ReadableStream<Uint8Array>> | ReadableStream<Uint8Array> | Uint8Array | JsonObject | string, abortable?:IAbortable, options?:{overwrite?:boolean}):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, abortable !== undefined ? [this, abortable] : this);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            if (_.value(await this.existsFile(path)) === true) 
            {
                if (options?.overwrite !== true) return true;
                
                _.check(await this.deleteFile(path, abortController, {isOkayIfNotExists:true}));
            }

            if (data === undefined) return _.value(await this.createFile(path, metadata));
            
            return _.value(await this.createFile(path, metadata, data as any, abortController));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to create file if it does not exist', arguments, {names:[Drive, this.createFileIfNotExists]});
        }
    }
    
    public async copyFolder(fromPath:FolderPath, toPath:FolderPath, abortable:IAbortable, options?:{recursive?:boolean}):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            _.check(await this.#_storageAdapter.copyFolder(fromPath, toPath, abortController));

            //notify parent folder of new child
            return this.#notifyParentChildWasAdded(toPath);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to copy folder', arguments, {names:[Drive, this.copyFolder]});
        }
    }
    public async copyFile(fromFilePath:FilePath, toFilePath:FilePath, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            _.check(await this.#_storageAdapter.copyFile(fromFilePath, toFilePath, abortController));
            
            //notify parent folder of new child
            return this.#notifyParentChildWasAdded(toFilePath);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to copy file', arguments, {names:[Drive, this.copyFile]});
        }
    }
    
    public async moveFolder(fromPath:FolderPath, toPath:FolderPath, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            _.check(await this.#_storageAdapter.moveFolder(fromPath, toPath, abortController));

            //if from and to paths have the same parent, notify parent folder of child rename instead of remove and add
            if (fromPath.parent?.toString() === toPath.parent?.toString()) return this.#notifyParentChildWasRenamed(fromPath, toPath);

            //notify parent folder child was removed
            this.#notifyParentChildWasRemoved(fromPath);

            //notify parent folder of new child
            return this.#notifyParentChildWasAdded(toPath);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to move folder', arguments, {names:[Drive, this.moveFolder]});
        }
    }
    public async moveFile(fromPath:FilePath, toPath:FilePath, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            _.check(await this.#_storageAdapter.moveFile(fromPath, toPath, abortController));

            //if from and to paths have the same parent, notify parent folder of child rename instead of remove and add
            if (fromPath.parent?.toString() === toPath.parent?.toString()) return this.#notifyParentChildWasRenamed(fromPath, toPath);

            //notify parent folder child was removed
            this.#notifyParentChildWasRemoved(fromPath);

            //notify parent folder of new child
            return this.#notifyParentChildWasAdded(toPath);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to move file', arguments, {names:[Drive, this.moveFile]});
        }
    }

    public async hasFileData(path:FilePath):Promise<boolean | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            return _.value(await this.#_storageAdapter.hasFileData(path));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to check if file has data', arguments, {names:[Drive, this.hasFileData]});
        }
    }
    
    public async getFileData(path:FilePath, abortable:IAbortable, format:DataFormat.Data):Promise<IDatable<ReadableStream> | IAborted | IError>;
    public async getFileData(path:FilePath, abortable:IAbortable, format:DataFormat.ReadableStream):Promise<ReadableStream<Uint8Array> | IAborted | IError>;
    public async getFileData(path:FilePath, abortable:IAbortable, format:DataFormat.Uint8Array):Promise<Uint8Array | IAborted | IError>;
    public async getFileData<T extends JsonObject>(path:FilePath, abortable:IAbortable, format:DataFormat.JsonObject):Promise<T | IAborted | IError>;
    public async getFileData(path:FilePath, abortable:IAbortable, format:DataFormat.string):Promise<string | IAborted | IError>;
    public async getFileData(path:FilePath, abortable:IAbortable, format:DataFormat):Promise<IDatable<ReadableStream<Uint8Array>> | ReadableStream<Uint8Array> | Uint8Array | JsonObject | string | IAborted | IError>
    {
        const app = this._app;

        try
        {
            const abortController = new AbortController(app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            //check if file exists before trying to get file data
            const exists = _.value(await this.#_storageAdapter.existsFile(path));
            if (exists !== true) return app.throw(`File does not exist, {}`, [path]);

            const data = _.value(await this.#_storageAdapter.getFileData(path, abortController));

            switch (format)
            {
                case DataFormat.Data:
                    return data;
                case DataFormat.ReadableStream:
                    return _.value(await data.get());  
                case DataFormat.Uint8Array:
                {
                    const stream = _.value(await data.get());
                    return app.streamUtil.toUint8Array(stream);
                }
                case DataFormat.JsonObject:
                {
                    const stream = _.value(await data.get());

                    const uint8Array = _.value(await app.streamUtil.toUint8Array(stream));
                    const string = app.textUtil.fromUint8Array<json>(uint8Array);
                    return app.jsonUtil.parse(string);
                }   
                case DataFormat.string:
                {
                    const stream = _.value(await data.get());

                    const uint8Array = _.value(await app.streamUtil.toUint8Array(stream));
                    return app.textUtil.fromUint8Array(uint8Array);
                }
                default:
                    return app.throw('Invalid format given, {}', [], {correctable:true});
            }
        }
        catch (error)
        {
            return app.warn(error, 'Failed to get file data', arguments, {names:[Drive, this.getFileData]});
        } 
    }
    
    public async setFileData(path:FilePath, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable):Promise<true | IAborted | IError>;
    public async setFileData(path:FilePath, data:ReadableStream<Uint8Array>, abortable:IAbortable):Promise<true | IAborted | IError>;
    public async setFileData(path:FilePath, data:Uint8Array, abortable:IAbortable):Promise<true | IAborted | IError>;
    public async setFileData(path:FilePath, data:JsonObject, abortable:IAbortable):Promise<true | IAborted | IError>;
    public async setFileData(path:FilePath, data:string, abortable:IAbortable):Promise<true | IAborted | IError>;
    public async setFileData(path:FilePath, obj:IDatable<ReadableStream<Uint8Array>> | ReadableStream<Uint8Array> | Uint8Array | JsonObject | string, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        const app = this._app;

        try
        {
            const abortController = new AbortController(app, [this, abortable]);

            const _ = abortController.abortableHelper.throwIfAborted();

            const info = _.value(await this.getFileInfo(path));

            let data:IDatable<ReadableStream<Uint8Array>> | undefined;
            if (app.typeUtil.is<IDatable<ReadableStream<Uint8Array>>>(obj, IDatableType) === true) data = obj;
            else if (app.typeUtil.is<ReadableStream<Uint8Array>>(obj, ReadableStream) === true) data = new Data(app, async () => obj);
            else if (app.typeUtil.is<Uint8Array>(obj, Uint8Array) === true) data = new Data(app, async () => app.streamUtil.fromUint8Array(obj));
            else if (app.typeUtil.isString(obj) === true) data = new Data(app, async () => app.streamUtil.fromUint8Array(app.textUtil.toUint8Array(obj)));
            else data = new Data(app, async () => app.streamUtil.fromUint8Array(app.textUtil.toUint8Array(app.jsonUtil.stringify(obj))));

            _.check(await this.#_storageAdapter.setFileData(path, data, abortController));

            //clear ancillary data if this is not an ancillary file
            if (info.metadata.type !== FileType.Ancillary)
            {
                _.check(await this.setAncillaryFileData(path, undefined, AncillaryDataType.transcoded, abortController));
                _.check(await this.setAncillaryFileData(path, undefined, AncillaryDataType.screenshot, abortController));
                _.check(await this.setAncillaryFileData(path, undefined, AncillaryDataType.thumbnail, abortController));

                //clear cache
                this.getFile(path).__clearAncillaryCache();
            }

            //notify parent folder of child modification
            return this.#notifyParentChildWasModified(path);
        }
        catch (error)
        {
            return app.warn(error, 'Failed to set file data', arguments, {names:[Drive, this.setFileData]});
        }
    }

    public async getAncillaryFileData(path:FilePath, type:AncillaryDataType, abortable:IAbortable, format:DataFormat.Data):Promise<IDatable<ReadableStream> | undefined | IAborted | IError>;
    public async getAncillaryFileData(path:FilePath, type:AncillaryDataType, abortable:IAbortable, format:DataFormat.ReadableStream):Promise<ReadableStream<Uint8Array> | undefined | IAborted | IError>;
    public async getAncillaryFileData(path:FilePath, type:AncillaryDataType, abortable:IAbortable, format:DataFormat.Uint8Array):Promise<Uint8Array | undefined | IAborted | IError>;
    public async getAncillaryFileData(path:FilePath, type:AncillaryDataType, abortable:IAbortable, format:DataFormat):Promise<IDatable<ReadableStream<Uint8Array>> | ReadableStream<Uint8Array> | Uint8Array | undefined | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = abortController.abortableHelper.throwIfAborted();

            path = _.value(await this.#getAncillaryFilePath(path, type, _));

            const exists = _.value(await this.existsFile(path));
            if (exists !== true) return undefined;

            return _.value(await this.getFileData(path, abortable, format as DataFormat.Data));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get ancillary file data', arguments, {names:[Drive, this.getAncillaryFileData]});
        } 
    }

    public async setAncillaryFileData(path:FilePath, data:IDatable<ReadableStream<Uint8Array>> | undefined, type:AncillaryDataType, abortable:IAbortable):Promise<true | IAborted | IError>;
    public async setAncillaryFileData(path:FilePath, data:ReadableStream<Uint8Array> | undefined, type:AncillaryDataType, abortable:IAbortable):Promise<true | IAborted | IError>;
    public async setAncillaryFileData(path:FilePath, data:Uint8Array | undefined, type:AncillaryDataType, abortable:IAbortable):Promise<true | IAborted | IError>;
    public async setAncillaryFileData(path:FilePath, obj:IDatable<ReadableStream<Uint8Array>> | ReadableStream<Uint8Array> | Uint8Array | undefined, type:AncillaryDataType, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        const app = this._app;

        try
        {
            const abortController = new AbortController(app, [this, abortable]);

            const _ = abortController.abortableHelper.throwIfAborted();

            path = _.value(await this.#getAncillaryFilePath(path, type, _));

            if (obj === undefined) return _.value(await this.deleteFile(path, abortController, {isOkayIfNotExists:true}));

            let data:IDatable<ReadableStream<Uint8Array>> | undefined;
            if (app.typeUtil.is<IDatable<ReadableStream<Uint8Array>>>(obj, IDatableType) === true) data = obj;
            else if (app.typeUtil.is<ReadableStream<Uint8Array>>(obj, ReadableStream) === true) data = new Data(app, async () => obj);
            else if (app.typeUtil.is<Uint8Array>(obj, Uint8Array) === true) data = new Data(app, async () => app.streamUtil.fromUint8Array(obj));
            else return app.throw('Invalid data type given, {}', [obj], {correctable:true});

            //create file and/or set file data
            _.check(await this.createFileIfNotExists(path, {type:FileType.Ancillary, immutable:false, hidden:true, compressed:false, app:false, extra:{}}, data, abortController, {overwrite:true}));

            //notify parent folder of child modification
            return this.#notifyParentChildWasModified(path);
        }
        catch (error)
        {
            return app.warn(error, 'Failed to set file data', arguments, {names:[Drive, this.setAncillaryFileData]});
        }
    }

    public async getFileInfo(path:FilePath):Promise<IDriveFileInfo | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            return _.value(await this.#_storageAdapter.getFileInfo<IDriveFileInfo>(path));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get file info', arguments, {names:[Drive, this.getFileInfo]});
        }
    }
    public async getFolderInfo(path:FolderPath):Promise<IDriveFolderInfo | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            return _.value(await this.#_storageAdapter.getFolderInfo<IDriveFolderInfo>(path));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get folder info', arguments, {names:[Drive, this.getFolderInfo]});
        }
    }

    public async setFileMetadata<T extends IDriveFileMetadata>(path:FilePath, metadata:T):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            _.check(await this.#_storageAdapter.setFileMetadata(path, metadata));

            //notify parent folder of child modification
            return this.#notifyParentChildWasModified(path);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to set file metadata', arguments, {names:[Drive, this.setFileMetadata]});
        }
    }
    public async setFolderMetadata<T extends IDriveFolderMetadata>(path:FolderPath, metadata:T):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            _.check(await this.#_storageAdapter.setFolderMetadata(path, metadata));

            //notify parent folder of child modification
            return this.#notifyParentChildWasModified(path);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to set folder metadata', arguments, {names:[Drive, this.setFolderMetadata]});
        }
    }

    public async rename(path:FolderPath | FilePath | folderpath | filepath, name:string, abortable:IAbortable):Promise<void | IAborted | IError>
    {
        if (this._app.typeUtil.isString(path) === true) path = Path.from(path);

        if (path.type === 'folder') return this.renameFolder(path, name, abortable);
        return this.renameFile(path, name, abortable);
    }

    public async renameFolder(path:FolderPath | folderpath, name:string, abortable:IAbortable):Promise<void | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            if (this._app.typeUtil.isString(path) === true) path = FolderPath.from(path);

            _.check(await this.#_storageAdapter.renameFolder(path, name, abortController));

            //create to path
            const toPath = new FolderPath(path, name);

            //notify parent folder child was renamed
            this.#notifyParentChildWasRenamed(path, toPath);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to rename folder', arguments, {names:[Drive, this.renameFolder]});
        }
    }

    public async renameFile(path:FilePath | filepath, name:string, abortable:IAbortable):Promise<void | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            if (this._app.typeUtil.isString(path) === true) path = FilePath.from(path);

            _.check(await this.#_storageAdapter.renameFile(path, name, abortController));

            //create to path
            const toPath = new FilePath(path, name);

            //notify parent folder child was renamed
            this.#notifyParentChildWasRenamed(path, toPath);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to rename file', arguments, {names:[Drive, this.renameFile]});
        }
    }
    
    public async deleteFile(path:FilePath, abortable:IAbortable, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            _.check(await this.#_storageAdapter.deleteFile(path, abortController, options));

            //notify parent folder child was removed
            return this.#notifyParentChildWasRemoved(path);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to delete file', arguments, {names:[Drive, this.deleteFile]});
        }
    }
    public async deleteFolder(path:FolderPath, abortable:IAbortable, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            _.check(await this.#_storageAdapter.deleteFolder(path, abortController, options));

            //notify parent folder child was removed
            return this.#notifyParentChildWasRemoved(path);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to delete folder', arguments, {names:[Drive, this.deleteFolder]});
        }
    }

    public async *listFolder(path:FolderPath, abortable:IAbortable):AsyncGenerator<IDriveFolderInfo | IDriveFileInfo | IAborted | IError>
    {
        const abortController = new AbortController(this._app, [this, abortable]);

        for await (const info of this.#_storageAdapter.listFolder<IDriveFolderInfo | IDriveFileInfo>(path, abortController)) yield info;
    }

    public async clear(abortable:IAbortable):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            //i don't believe it will be necessary to dispatch onChildRemovedSignal for every child removed (we technically could just be iterating through all of the cached folders and files and dispatching onChildRemovedSignal for each one, but that seems unnecessary at the moment)
            return _.value(await this.#_storageAdapter.clear(abortController));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to clear drive', arguments, {names:[Drive, this.clear]});
        }
    }

    async #getAncillaryFilePath(path:FilePath, type:AncillaryDataType, _:AbortableHelper<A>, info?:IDriveFileInfo):Promise<FilePath | IAborted | IError>
    {
        try
        {
            _.throwIfAborted();

            info = info ?? _.value(await this.getFileInfo(path));

            switch (type)
            {
                case AncillaryDataType.thumbnail:
                    return new FilePath(path, `THUMBNAIL_${info.data.uid}`);
                case AncillaryDataType.transcoded:
                    return new FilePath(path, `TRANSCODED_${info.data.uid}`);
                case AncillaryDataType.screenshot:
                    return new FilePath(path, `SCREENSHOT_${info.data.uid}`);
                default:
                    this._app.throw('Invalid ancillary data type given, {}', [type], {correctable:true});
            }
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get ancillary file path', arguments, {names:[Drive, this.#getAncillaryFilePath]});
        }
    }

    public get rootFolderPath():FolderPath { return this._coreFolderPaths[CoreFolderName.Root]; }

    public get rootFolder():IDriveFolder<A> { return this.getFolder(this.rootFolderPath); }

    public getFolder(path:FolderPath | folderpath):IDriveFolder<A>
    {        
        if (this._app.typeUtil.isString(path) === true) path = FolderPath.from(path);

        let folder = this.#_cache.get(path.toString());
        if (folder !== undefined) return folder as IDriveFolder<A>;

        folder = this.#_createFolder(this, path);
        this.#_cache.set(path.toString(), folder);

        return folder;
    }

    public getFile(path:FilePath | filepath):IDriveFile<A>
    {
        if (this._app.typeUtil.isString(path) === true) path = FilePath.from(path);

        let file = this.#_cache.get(path.toString());
        if (file !== undefined) return file as IDriveFile<A>;

        file = this.#_createFile(this, path);
        this.#_cache.set(path.toString(), file);

        return file;
    }

    public getFileOrFolder(path:folderpath):IDriveFolder<A>;
    public getFileOrFolder(path:filepath):IDriveFile<A>;
    public getFileOrFolder(path:path)
    {
        return path[path.length - 1] === '/' ? this.getFolder(path as folderpath) : this.getFile(path as filepath);
    }

    public __getCachedFolder(path:FolderPath):IDriveFolder<A> | undefined { return this.#_cache.get(path.toString()) as IDriveFolder<A>; }
    public __getCachedFile(path:FilePath):IDriveFile<A> | undefined { return this.#_cache.get(path.toString()) as IDriveFile<A>; }
    
    protected assertIsInitialized():void | never { if (!this._initialized) this._app.throw('drive has not been initialized', []); }

    #getParentDriveFolder = (path:Path):IDriveFolder<A> | undefined =>
    {
        //check if this path has a parent. if not, return undefined
        const parent = path.parent;
        if (parent === undefined) return undefined;
        
        //get parent folder if it is cached
        const parentDriveFolder = this.#_cache.get(parent.toString()) as IDriveFolder<A> | undefined;

        //if parent folder is not cached, return undefined
        if (parentDriveFolder === undefined) return undefined;

        return parentDriveFolder;
    }

    #notifyParentChildWasAdded = (path:Path):true =>
    {
        //get parent folder if it is cached
        const parentDriveFolder = this.#getParentDriveFolder(path);

        //if parent folder is not cached, return true
        if (parentDriveFolder === undefined) return true;

        //notify parent folder of new child
        parentDriveFolder.onChildAddedSignal.dispatch(parentDriveFolder, path);

        return true;
    }

    #notifyParentChildWasRemoved = (path:Path):true =>
    {
        //get parent folder if it is cached
        const parentDriveFolder = this.#getParentDriveFolder(path);

        //if parent folder is not cached, return true
        if (parentDriveFolder === undefined) return true;

        //notify parent folder of new child
        parentDriveFolder.onChildRemovedSignal.dispatch(parentDriveFolder, path);

        return true;
    }

    #notifyParentChildWasModified = (path:Path):true =>
    {
        //get parent folder if it is cached
        const parentDriveFolder = this.#getParentDriveFolder(path);

        //if parent folder is not cached, return true
        if (parentDriveFolder === undefined) return true;

        //notify parent folder of child modification
        parentDriveFolder.onChildModifiedSignal.dispatch(parentDriveFolder, path);

        return true;
    }

    #notifyParentChildWasRenamed = (fromPath:Path, toPath:Path):true =>
    {
        //get parent folder if it is cached
        const parentDriveFolder = this.#getParentDriveFolder(fromPath);

        //if parent folder is not cached, return true
        if (parentDriveFolder === undefined) return true;

        //notify parent folder of child modification
        parentDriveFolder.onChildRenamedSignal.dispatch(parentDriveFolder, fromPath, toPath);

        return true;
    }
}