/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../../../../../../shared/src/library/abort/IAbortable";
import type { IBaseApp } from "../../IBaseApp";
import { WeakSignal } from "../../../../../../../shared/src/library/signal/WeakSignal";
import type { IDrive, IDriveFileInfo, IDriveFileMetadata, IDriveFolderInfo, IDriveFolderMetadata } from "../../../../../../../shared/src/library/file/drive/IDrive";
import { IDriveFileType, type IDriveFile } from "../../../../../../../shared/src/library/file/drive/IDriveFile";
import { IDriveFolderType, type IDriveFolder } from "../../../../../../../shared/src/library/file/drive/IDriveFolder";
import type { IDatable } from "../../../../../../../shared/src/library/data/IDatable";
import { type uid } from "../../utils/UIDUtil";
import type { FolderPath, Path, path } from "../../../../../../../shared/src/library/file/Path";
import { ImplementsDecorator } from "../../../../../../../shared/src/library/decorators/ImplementsDecorator";
import type { IError } from "../../../../../../../shared/src/library/error/IError";
import type { IAborted } from "../../../../../../../shared/src/library/abort/IAborted";
import { AbortableHelper } from "../../../../../../../shared/src/library/helpers/AbortableHelper";

@ImplementsDecorator(IDriveFolderType)
export class DriveFolder<A extends IBaseApp<A>> implements IDriveFolder<A>
{
    private _uid:uid;
    public get uid():uid { return this._uid; }

    private _drive:IDrive<A>;
    public get drive():IDrive<A> { return this._drive; }
    
    private _path:FolderPath;
    public get path():FolderPath { return this._path; }

    private _onChildAddedSignal?:WeakSignal<[IDriveFolder<A>, Path]>; 
    public get onChildAddedSignal() { return this._onChildAddedSignal ?? (this._onChildAddedSignal = new WeakSignal<[IDriveFolder<A>, Path]>(this._drive.app)); };

    private _onChildRemovedSignal?:WeakSignal<[IDriveFolder<A>, Path]>; 
    public get onChildRemovedSignal() { return this._onChildRemovedSignal ?? (this._onChildRemovedSignal = new WeakSignal<[IDriveFolder<A>, Path]>(this._drive.app)); };

    private _onChildModifiedSignal?:WeakSignal<[IDriveFolder<A>, Path]>; 
    public get onChildModifiedSignal() { return this._onChildModifiedSignal ?? (this._onChildModifiedSignal = new WeakSignal<[IDriveFolder<A>, Path]>(this._drive.app)); };

    private _onChildRenamedSignal?:WeakSignal<[IDriveFolder<A>, Path, Path]>;
    public get onChildRenamedSignal() { return this._onChildRenamedSignal ?? (this._onChildRenamedSignal = new WeakSignal<[IDriveFolder<A>, Path, Path]>(this._drive.app)); };


    constructor(drive:IDrive<A>, path:FolderPath) 
    {
        this._drive = drive;
        this._path = path;

        this._uid = drive.app.uidUtil.derive(drive.uid, path.toString(), true);
    }

    public async createFile<T extends IDriveFileMetadata>(name:string, metadata:T):Promise<IDriveFile<A> | IAborted | IError>;
    public async createFile<T extends IDriveFileMetadata>(name:string, metadata:T, data:IDatable<ReadableStream>, abortable:IAbortable):Promise<IDriveFile<A> | IAborted | IError>;
    public async createFile<T extends IDriveFileMetadata>(name:string, metadata:T, data?:IDatable<ReadableStream>, abortable?:IAbortable):Promise<IDriveFile<A> | IAborted | IError>
    {
        const app = this._drive.app;

        try
        {
            const _ = (abortable === undefined ? new AbortableHelper(app) : new AbortableHelper(app, abortable)).throwIfAborted();

            const path = this._path.getSubFile(name);
            _.check(await (data === undefined || abortable === undefined ? this._drive.createFile(path, metadata) : this._drive.createFile(path, metadata, data, abortable)));
            
            return this._drive.getFile(path);
        }
        catch (error)
        {
            return this._drive.app.warn(error, 'Failed to create file.', arguments, {names:[DriveFolder, this.createFile]});
        }
    }

    public async createFolder<T extends IDriveFolderMetadata>(name:string, metadata:T):Promise<IDriveFolder<A> | IAborted | IError>
    {
        const app = this._drive.app;

        try
        {
            const _ = new AbortableHelper(app).throwIfAborted();

            const path = this._path.getSubFolder(name);
            _.check(await this._drive.createFolder(path, metadata));

            return this._drive.getFolder(path);
        }
        catch (error)
        {
            return this._drive.app.warn(error, 'Failed to create folder.', arguments, {names:[DriveFolder, this.createFolder]});
        }
    }
    
    public async createFileIfNotExists<T extends IDriveFileMetadata>(name:string, metadata:T):Promise<IDriveFile<A> | IAborted | IError>;
    public async createFileIfNotExists<T extends IDriveFileMetadata>(name:string, metadata:T, data:IDatable<ReadableStream>, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<IDriveFile<A> | IAborted | IError>;
    public async createFileIfNotExists<T extends IDriveFileMetadata>(name:string, metadata:T, data?:IDatable<ReadableStream>, abortable?:IAbortable, options?:{overwrite?:boolean}):Promise<IDriveFile<A> | IAborted | IError>
    {
        const app = this._drive.app;

        try
        {
            const _ = (abortable === undefined ? new AbortableHelper(app) : new AbortableHelper(app, abortable)).throwIfAborted();
            
            const path = this._path.getSubFile(name);

            if (data !== undefined && options?.overwrite !== true) _.check(await this._drive.createFileIfNotExists(path, metadata, data, abortable!, options));
            else _.check(await this._drive.createFileIfNotExists(path, metadata));

            const file = this._drive.getFile(path);

            if (data !== undefined && options?.overwrite === true) _.check(await file.setBytes(data, abortable!));
            
            return file;
        }
        catch (error)
        {
            return this._drive.app.warn(error, 'Failed to create file if not exists.', arguments, {names:[DriveFolder, this.createFileIfNotExists]});
        }
    }

    public async createFolderIfNotExists<T extends IDriveFolderMetadata>(name:string, metadata:T):Promise<IDriveFolder<A> | IAborted | IError>
    {
        const app = this._drive.app;

        try
        {
            const _ = new AbortableHelper(app).throwIfAborted();

            const path = this._path.getSubFolder(name);
            _.check(await this._drive.createFolderIfNotExists(path, metadata));

            return this._drive.getFolder(path);
        }
        catch (error)
        {
            return this._drive.app.warn(error, 'Failed to create folder if not exists.', arguments, {names:[DriveFolder, this.createFolderIfNotExists]});
        }
    }

    public async add(child:IDriveFile<A> | IDriveFolder<A>, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        const drive = this._drive;
        const app = drive.app;

        try
        {
            const _ = new AbortableHelper(app, abortable).throwIfAborted();

            if (app.typeUtil.is<IDriveFolder<A>>(child, IDriveFolderType) === true) 
            {
                const fromChildPath = child.path;
                const toChildPath = this._path.getSubFolder(fromChildPath.name);

                const exists = _.value(await drive.exists(toChildPath));
                if (exists !== false) app.throw('Folder already exists.', []);

                return drive.moveFolder(fromChildPath, toChildPath, abortable);
            }
            
            const fromChildPath = child.path;
            const toChildPath = this._path.getSubFile(fromChildPath.name);

            const exists = _.value(await drive.exists(toChildPath));
            if (exists !== false) app.throw('File already exists.', []);

            return _.value(await drive.moveFile(fromChildPath, toChildPath, abortable));
        }
        catch (error)
        {
            return app.warn(error, 'Failed to add child.', arguments, {names:[DriveFolder, this.add]});
        }
    }

    public async remove(child:IDriveFile<A> | IDriveFolder<A>, abortable:IAbortable):Promise<true | IAborted | IError> 
    {
        const drive = this._drive;
        const app = drive.app;

        try
        {
            const _ = new AbortableHelper(app, abortable).throwIfAborted();

            if (_.value(await this.has(child)) === false) return true;

            if (app.typeUtil.is<IDriveFolder<A>>(child, IDriveFolderType) === true) return _.value(await drive.deleteFolder(child.path, abortable));
            
            return _.value(await drive.deleteFile(child.path, abortable));
        }
        catch (error)
        {
            return app.warn(error, 'Failed to remove child.', arguments, {names:[DriveFolder, this.remove]});
        }
    }

    public async has(child:IDriveFolder<A> | IDriveFile<A>):Promise<boolean | IAborted | IError> 
    {
        try
        {
            return this._path.isParentOf(child.path);
        }
        catch (error)
        {
            return this._drive.app.warn(error, 'Failed to check if folder has child.', arguments, {names:[DriveFolder, this.has]});
        }
    } 

    public async exists():Promise<boolean | IAborted | IError> 
    {
        return this._drive.existsFolder(this._path);   
    }

    public async getParent():Promise<IDriveFolder<A> | undefined | IAborted | IError>
    {
        if (this._path.parent === undefined) return undefined;

        return this._drive.getFolder(this._path.parent);
    }

    public getChildren(abortable:IAbortable, options?:{hidden?:boolean}):AsyncGenerator<IDriveFile<A> | IDriveFolder<A> | IAborted | IError>;
    public getChildren(abortable:IAbortable, options:{type:'file', hidden?:boolean}):AsyncGenerator<IDriveFile<A> | IAborted | IError>;
    public getChildren(abortable:IAbortable, options:{type:'folder', hidden?:boolean}):AsyncGenerator<IDriveFolder<A> | IAborted | IError>;
    public async *getChildren(abortable:IAbortable, options?:{type?:'folder'|'file', hidden?:boolean}):AsyncGenerator<IDriveFile<A> | IDriveFolder<A> | IAborted | IError>
    {
        const app = this._drive.app;

        try
        {
            const _ = new AbortableHelper(app, abortable).throwIfAborted();

            const hidden = options?.hidden ?? false;
            const type = options?.type;

            for await (let info of this._drive.listFolder(this._path, abortable)) 
            {
                info = _.value(info);

                if (hidden === false && info.metadata.hidden === true) continue;

                if (type === 'file' && info.type === 'folder') continue;
                if (type === 'folder' && info.type === 'file') continue;

                if (info.type === 'file') yield this._drive.getFile(this._path.getSubFile(info.name));
                else yield this._drive.getFolder(this._path.getSubFolder(info.name));
            }
        }
        catch (error)
        {
            yield this._drive.app.warn(error, 'Failed to get children.', arguments, {names:[DriveFolder, this.getChildren]});
        }
    }

    public getChildrenInfo(abortable:IAbortable, options?:{hidden?:boolean}):AsyncGenerator<IDriveFolderInfo | IDriveFileInfo | IAborted | IError>;
    public getChildrenInfo(abortable:IAbortable, options:{type:'file', hidden?:boolean}):AsyncGenerator<IDriveFileInfo | IAborted | IError>;
    public getChildrenInfo(abortable:IAbortable, options:{type:'folder', hidden?:boolean}):AsyncGenerator<IDriveFolderInfo | IAborted | IError>;
    public async *getChildrenInfo(abortable:IAbortable, options?:{type?:'folder'|'file', hidden?:boolean}):AsyncGenerator<IDriveFolderInfo | IDriveFileInfo | IAborted | IError>
    {
        const app = this._drive.app;

        try
        {
            const _ = new AbortableHelper(app, abortable).throwIfAborted();

            const hidden = options?.hidden ?? false;
            const type = options?.type;

            for await (let info of this._drive.listFolder(this._path, abortable)) 
            {
                info = _.value(info);

                if (hidden === false && info.metadata.hidden === true) continue;

                if (type === 'file' && info.type === 'folder') continue;
                if (type === 'folder' && info.type === 'file') continue;

                yield info;
            }
        }
        catch (error)
        {
            yield this._drive.app.warn(error, 'Failed to get children info.', arguments, {names:[DriveFolder, this.getChildrenInfo]});
        }
    }

    public async getInfo():Promise<IDriveFolderInfo | IAborted | IError>
    {
        return this._drive.getFolderInfo(this._path);
    }

    public async getCount(abortable:IAbortable, options?:{hidden:boolean}):Promise<[number, number] | IAborted | IError>
    {
        const app = this._drive.app;

        try
        {
            const _ = new AbortableHelper(app, abortable).throwIfAborted();

            const hidden = options?.hidden ?? false;

            let fileCount = 0;
            let folderCount = 0;
        
            const children:(IDriveFolderInfo | IDriveFileInfo)[] = [];
            for await (let info of this.getChildrenInfo(abortable, {hidden})) children.push(_.value(info));

            const queue = [{children:children, path:this._path}];
            let index = 0;
            while (index < queue.length) 
            {
                const {children, path} = queue[index];
        
                for (let i = 0, length = children.length; i < length; i++) 
                {
                    const childData = children[i];
        
                    if (childData.type === 'file') fileCount++;
                    else 
                    {
                        folderCount++;
                        const child = this.drive.getFolder(path.getSubFolder(childData.name));
                        const children:(IDriveFolderInfo | IDriveFileInfo)[] = [];
                        for await (let info of child.getChildrenInfo(abortable, {hidden})) children.push(_.value(info));

                        queue.push({children, path:path.getSubFolder(childData.name)});
                    }
                }
        
                index++;
            }
        
            return [fileCount, folderCount];
        }
        catch (error)
        {
            return this._drive.app.warn(error, 'Failed to get count.', arguments, {names:[DriveFolder, this.getCount]});
        }
    }

    public async getByteCount(abortable:IAbortable, options?:{hidden:boolean}):Promise<number | IAborted | IError>
    {
        const app = this._drive.app;

        try
        {
            const _ = new AbortableHelper(app, abortable).throwIfAborted();

            const hidden = options?.hidden ?? false;

            let bytes = 0;
            const children:(IDriveFolderInfo | IDriveFileInfo)[] = [];
            for await (let info of this.getChildrenInfo(abortable, {hidden})) children.push(_.value(info));
            const queue = [{children:children, path:this._path}];
            let index = 0;
            
            while (index < queue.length) 
            {
                const {children, path} = queue[index];
            
                for (let i = 0, length = children.length; i < length; i++) 
                {
                    const childData = children[i];
            
                    if (childData.type === 'file') bytes += childData.data.bytes.decrypted;
                    else 
                    {
                        const child = this.drive.getFolder(path.getSubFolder(childData.name));
                        const children:(IDriveFolderInfo | IDriveFileInfo)[] = [];
                        for await (let info of child.getChildrenInfo(abortable, {hidden})) children.push(_.value(info));

                        queue.push({children, path:path.getSubFolder(childData.name)});
                    }
                }
            
                index++;
            }
            
            return bytes;
        }
        catch (error)
        {
            return this._drive.app.warn(error, 'Failed to get byte count.', arguments, {names:[DriveFolder, this.getByteCount]});
        }
    }

    public getDescendants(abortable:IAbortable, options?:{hidden?:boolean}):AsyncGenerator<IDriveFile<A> | IDriveFolder<A> | IAborted | IError>;
    public getDescendants(abortable:IAbortable, options?:{type:'file', hidden?:boolean}):AsyncGenerator<IDriveFile<A> | IAborted | IError>;
    public getDescendants(abortable:IAbortable, options:{type:'folder', hidden?:boolean}):AsyncGenerator<IDriveFolder<A> | IAborted | IError>;
    public async *getDescendants(abortable:IAbortable, options?:{type?:'file'|'folder', hidden?:boolean}):AsyncGenerator<IDriveFile<A> | IDriveFolder<A> | IAborted | IError>
    {
        const drive = this._drive;
        const app = drive.app;

        try
        {
            const _ = new AbortableHelper(app, abortable).throwIfAborted();

            const hidden = options?.hidden ?? false;
            const type = options?.type;

            const children:(IDriveFolder<A> | IDriveFile<A>)[] = [];
            for await (let child of this.getChildren(abortable, {hidden})) children.push(_.value(child));

            const files = [];
            const queue = [children];
            let index = 0;
        
            while (index < queue.length) 
            {
                const children = queue[index];
        
                for (let i = 0, length = children.length; i < length; i++) 
                {
                    const child = children[i];
        
                    if (app.typeUtil.is<IDriveFile<A>>(child, IDriveFileType) === true) 
                    {
                        if (type === 'folder') continue;

                        files.push(child);
                    }
                    else 
                    {
                        const children:(IDriveFolder<A> | IDriveFile<A>)[] = [];
                        for await (let childOfChild of child.getChildren(abortable, {hidden})) children.push(_.value(childOfChild));

                        queue.push(children);

                        if (type !== 'file') files.push(child);
                    }
                }
        
                index++;
            }
        
            return files;
        }
        catch (error)
        {
            return app.warn(error, 'Failed to get descendants.', arguments, {names:[DriveFolder, this.getDescendants]});
        }
    }

    /**
     * Checks if the given folder or file is a ancestor of this folder.
     * @param folder The folder to check.
     * @returns A Promise that resolves to a boolean indicating whether the given folder is an ancestor of this folder.
     */
    public async isAncestorOf(folder:IDriveFolder<A> | IDriveFile<A>):Promise<boolean | IAborted | IError>
    {
        const app = this._drive.app;

        try
        {
            const _ = new AbortableHelper(app).throwIfAborted();

            let innerFolder:IDriveFolder<A> | IDriveFile<A> | undefined = folder;
            while (innerFolder)
            {
                if (innerFolder.path.equals(this._path) === true) return true;
                innerFolder = _.value(await innerFolder.getParent());
            }
            
            return false;
        }
        catch (error)
        {
            return this._drive.app.warn(error, 'Failed to check if folder is ancestor.', arguments, {names:[DriveFolder, this.isAncestorOf]});
        }
    }

    /**
     * Returns the full path of the current folder, including the names of all parent folders.
     * @returns A Promise that resolves to a string representing the full path of the current folder.
     */
    public async getPath():Promise<string | IAborted | IError>
    {
        return this._path.toString();
    }

    public async getName():Promise<string | IAborted | IError> 
    {
        return this._path.name;
    }
}