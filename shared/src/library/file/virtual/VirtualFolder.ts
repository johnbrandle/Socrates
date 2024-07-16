/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { VirtualFile } from "./VirtualFile";
import type { IFileObject } from "./IFileObject";
import { MultipartUint8Array } from "../../multipart/MultipartUint8Array";
import { IVirtualFolderType, type IVirtualFolder, type VirtualFolderMetadata } from "./IVirtualFolder";
import { IVirtualFileType, type IVirtualFile, type VirtualFileMetadata } from "./IVirtualFile";
import { ImplementsDecorator } from "../../decorators/ImplementsDecorator";
import { uid } from "../../utils/UIDUtil";
import { IError } from "../../error/IError";
import { IAborted } from "../../abort/IAborted";
import { AbortableHelper } from "../../helpers/AbortableHelper";
import { IAbortable } from "../../abort/IAbortable";
import { IBaseApp } from "../../IBaseApp";

@ImplementsDecorator(IVirtualFolderType)
export class VirtualFolder<A extends IBaseApp<A>> implements IVirtualFolder
{
    private _app:A;

    public _name:string;
    public _parent:IVirtualFolder | undefined;
    public _children:Array<IVirtualFile | IVirtualFolder> = [];

    private _uid:uid | undefined;
    
    constructor(app:A, name:string) 
    {
        this._app = app;
        this._name = name;
    }

    public get uid():uid
    {
        return this._uid ??= this._app.uidUtil.generate();
    }

    public async getName():Promise<string | IAborted | IError>
    {
        return this._name;
    }

    public async setName(name:string):Promise<true | IAborted | IError>
    {
        this._name = name;

        return true;
    }

    public async getPath():Promise<string | IAborted | IError> 
    {
        return Promise.resolve(this._parent ? `${await this._parent.getPath()}/${this._name}` : this._name);
    }

    public async getParent():Promise<IVirtualFolder | undefined | IAborted | IError>
    {
        return this._parent;
    }

    public async __setParent(parent:IVirtualFolder | undefined):Promise<true | IAborted | IError>
    {
        this._parent = parent as IVirtualFolder;

        return true;
    }

    /**
     * Adds a child file or folder to this folder.
     * If the child is already a child of this folder, this method returns true.
     * If the child is an ancestor of this folder, this method returns false.
     * If the child has a parent, it will be removed from its current parent and added to this folder.
     * @param child The child file or folder to add.
     * @returns A Promise that resolves to true if the child was successfully added, false otherwise.
     */
    public async add(child:IVirtualFile | IVirtualFolder):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = new AbortableHelper(this._app).throwIfAborted();

            if (child === this) this._app.throw('Cannot add a folder to itself', []);
            
            const parent = _.value(await child.getParent());
            
            if (parent) 
            {
                if (parent === this) this._app.throw('Child is already a child of this folder', []);
                if (this._app.typeUtil.is<IVirtualFolder>(child, IVirtualFolderType) === true)
                {
                    let isAncestorOf = _.value(await child.isAncestorOf(this)); //check if this is an ancestor of the child
                    if (isAncestorOf) this._app.throw('Child is an ancestor of this folder', []); //if it is, then we can't add the child to this folder because it would create a circular reference
                }

                _.check(await parent.remove(child));
            }

            _.check(await child.__setParent(this));
            this._children.push(child);

            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to add child to folder', arguments, {names:[VirtualFolder, this.add]});
        }
    }

    /**
     * Removes a child file or folder from this folder.
     * @param child The child file or folder to remove.
     * @returns A promise that resolves to a boolean indicating whether the child was successfully removed.
     */
    public async remove(child:IVirtualFile | IVirtualFolder):Promise<true | IAborted | IError> 
    {
        try
        {
            const _ = new AbortableHelper(this._app).throwIfAborted();

            const index = this._children.indexOf(child);
            if (index !== -1) this._children.splice(index, 1);
            return _.value(await child.__setParent(undefined));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to remove child from folder', arguments, {names:[VirtualFolder, this.remove]});
        }
    }
 
    /**
     * Determines whether this folder contains the specified file or folder.
     * @param child The file or folder to check for.
     * @returns A Promise that resolves to a boolean indicating whether this folder contains the specified file or folder.
     */
    public async has(child:IVirtualFile | IVirtualFolder):Promise<boolean | IAborted | IError> 
    {
        try
        {
            const _ = new AbortableHelper(this._app).throwIfAborted();

            return _.value(await child.getParent()) === this;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to check if folder contains child', arguments, {names:[VirtualFolder, this.has]});
        }
    }

    /**
     * Checks if the given folder or file is a ancestor of this folder.
     * @param folder The folder to check.
     * @returns A Promise that resolves to a boolean indicating whether the given folder is an ancestor of this folder.
     */
    public async isAncestorOf(folder:IVirtualFolder | IVirtualFile):Promise<boolean | IAborted | IError>
    {
        try
        {
            const _ = new AbortableHelper(this._app).throwIfAborted();

            let innerFolder:IVirtualFolder | IVirtualFile | undefined = folder;
            while (innerFolder) 
            {
                if (innerFolder === this) return true;
                innerFolder = _.value(await folder.getParent());
            }
            
            return false;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to check if folder is ancestor of this folder', arguments, {names:[VirtualFolder, this.isAncestorOf]});
        }
    }

    public getChildren(abortable:IAbortable):AsyncGenerator<IVirtualFile | IVirtualFolder | IAborted | IError>;
    public getChildren(abortable:IAbortable, options:{type:'folder'}):AsyncGenerator<IVirtualFolder | IAborted | IError>;
    public getChildren(abortable:IAbortable, options:{type:'file'}):AsyncGenerator<IVirtualFile | IAborted | IError>;
    public async *getChildren(abortable:IAbortable, options?:{type?:'folder'|'file'}):AsyncGenerator<IVirtualFile | IVirtualFolder | IAborted | IError>
    {
        try
        {
            const _ = new AbortableHelper(this._app, abortable).throwIfAborted();

            const type = options?.type;

            for (let child of this._children) 
            {
                child = _.value(child);

                if (type === 'file' && this._app.typeUtil.is<IVirtualFolder>(child, IVirtualFolderType) === true) continue;
                if (type === 'folder' && this._app.typeUtil.is<IVirtualFile>(child, IVirtualFileType) === true) continue;

                yield child;
            }
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get children', arguments, {names:[VirtualFolder, this.getChildren]});
        }
    }

    public async getCount(abortable:IAbortable):Promise<[number, number] | IAborted | IError> 
    {
        try
        {
            const _ = new AbortableHelper(this._app, abortable).throwIfAborted();

            let fileCount = 0;
            let folderCount = 0;
        
            let queue = [{fileCount:0, folderCount:0, children:this._children}];
            let index = 0;
            while (index < queue.length) 
            {
                let {fileCount:currentFileCount, folderCount:currentFolderCount, children} = queue[index];
        
                for (let i = 0, length = children.length; i < length; i++) 
                {
                    let child = children[i];
        
                    if (this._app.typeUtil.is<IVirtualFile>(child, IVirtualFileType) === true) currentFileCount++;
                    else 
                    {
                        currentFolderCount++;

                        const grandChildren = [];
                        for await (let grandChild of child.getChildren(abortable)) grandChildren.push(_.value(grandChild));

                        queue.push({fileCount:currentFileCount, folderCount:currentFolderCount, children:grandChildren});
                    }
                }
        
                fileCount += currentFileCount;
                folderCount += currentFolderCount;
                index++;
            }
        
            return [fileCount, folderCount];
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get count', arguments, {names:[VirtualFolder, this.getCount]});
        }
    }
    
    public async getByteCount(abortable:IAbortable):Promise<number | IAborted | IError> 
    {
        try
        {
            const _ = new AbortableHelper(this._app, abortable).throwIfAborted();
            
            let bytes = 0;
            let index = 0;
            
            const queue = [this._children];
            
            while (index < queue.length) 
            {
                let children = queue[index];
            
                for (let i = 0, length = children.length; i < length; i++) 
                {
                    let child = children[i];
            
                    if (this._app.typeUtil.is<IVirtualFile>(child, IVirtualFileType) === true) bytes += _.value(await child.getByteCount());
                    else 
                    {
                        const grandChildren = [];
                        for await (let grandChild of child.getChildren(abortable)) grandChildren.push(_.value(grandChild));

                        queue.push(grandChildren);
                    }
                }
            
                index++;
            }
            
            return bytes;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get byte count', arguments, {names:[VirtualFolder, this.getByteCount]});
        }
    }
    
    public getDescendants(abortable:IAbortable):AsyncGenerator<IVirtualFile | IVirtualFolder | IAborted | IError>;
    public getDescendants(abortable:IAbortable, options:{type:'file'}):AsyncGenerator<IVirtualFile | IAborted | IError>;
    public getDescendants(abortable:IAbortable, options:{type:'folder'}):AsyncGenerator<IVirtualFolder | IAborted | IError>;
    public async *getDescendants(abortable:IAbortable, options?:{type?:'file'|'folder'}):AsyncGenerator<IVirtualFile | IVirtualFolder | IAborted | IError> 
    {
        try
        {
            const _ = new AbortableHelper(this._app, abortable).throwIfAborted();

            const type = options?.type;

            const files = [];
            const queue = [this._children];
            
            let index = 0;
        
            while (index < queue.length) 
            {
                let children = queue[index];
        
                for (let i = 0, length = children.length; i < length; i++) 
                {
                    let child = children[i];
        
                    if (this._app.typeUtil.is<IVirtualFile>(child, IVirtualFileType) === true) 
                    {
                        if (type === 'folder') continue;
                        
                        files.push(child);
                    }
                    else 
                    {
                        const grandChildren = [];
                        for await (let grandChild of child.getChildren(abortable)) grandChildren.push(_.value(grandChild));

                        queue.push(grandChildren);

                        if (type !== 'file') files.push(child);
                    }
                }
        
                index++;
            }
        
            return files;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get files', arguments, {names:[VirtualFolder, this.getDescendants]});
        }
    }

    /**
     * Asynchronously generates parts of data from the files in the Folder.
     * Each part is a Blob with a size not exceeding the specified maxBytesPerPart.
     * Works with multiple files of varying sizes by iterating over each file's blob stream,
     * chunking it into parts of the specified size, and yielding them as Blob objects.
     * @param {number} maxBytesPerPart - Maximum size for each Blob part in bytes.
     * @returns {AsyncGenerator<Blob>} A generator that yields Blob parts, each close to the size defined by maxBytesPerPart.
     * @throws {Error} If any error occurs during file retrieval or stream reading.
     */
    public async *parts(abortable:IAbortable, maxBytesPerPart:number):AsyncGenerator<Blob | IAborted | IError> 
    {
        try
        {
            const _ = new AbortableHelper(this._app, abortable).throwIfAborted();

            const files = [];
            for await (let file of this.getDescendants(abortable, {type:'file'})) files.push(_.value(file));

            let nextFileIndex = 0;
            let currentPartSize = 0;
            let partParts:Uint8Array[] = [];

            while (nextFileIndex < files.length) 
            {
                const file = files[nextFileIndex];

                const data = _.value(await file.getBytes(abortable));
                const stream = _.value(await data.get());

                for await (let chunk of this._app.streamUtil.split(stream, maxBytesPerPart))
                {
                    chunk = _.value(chunk);

                    currentPartSize += chunk.byteLength; //increment the current part size

                    if (currentPartSize >= maxBytesPerPart) 
                    {
                        const overflowSize = currentPartSize - maxBytesPerPart;
                        const cutIndex = chunk.byteLength - overflowSize;

                        partParts.push(chunk.slice(0, cutIndex));
                        _.check(yield new Blob(partParts)); //yield the current part as a Blob

                        partParts = [chunk.slice(cutIndex)]; //start a new part with the overflow data
                        currentPartSize = overflowSize;
                    } 
                    else partParts.push(chunk);
                }

                nextFileIndex++; //move to the next file
            }

            if (partParts.length > 0) _.check(yield new Blob(partParts)); //yield any remaining data
        }
        catch (error)
        {
            yield this._app.warn(error, 'Failed to generate parts', arguments, {names:[VirtualFolder, this.parts]});
        }
    }
 
    public async getMetadata(abortable:IAbortable):Promise<VirtualFolderMetadata | IAborted | IError>
    {
        try
        {
            const _ = new AbortableHelper(this._app, abortable).throwIfAborted();

            let folderData = {name:this._name, children:[] as Array<VirtualFolderMetadata | VirtualFileMetadata>};
            type FolderMetadata = typeof folderData;
        
            const queue:{parentData:FolderMetadata, children:Array<IVirtualFile | IVirtualFolder>}[] = [{parentData:folderData, children:this._children}];
            let index = 0;
        
            while (index < queue.length) 
            {
                const {parentData, children} = queue[index];
        
                for (let i = 0, length = children.length; i < length; i++) 
                {
                    const child = children[i];
                    const childData = _.value(await child.getMetadata(abortable));
        
                    parentData.children.push(childData);
        
                    if (this._app.typeUtil.is<IVirtualFile>(child, IVirtualFileType) === true) continue;

                    const grandChildren = [];
                    for await (let grandChild of child.getChildren(abortable)) grandChildren.push(_.value(grandChild));
                    queue.push({parentData:childData as FolderMetadata, children:grandChildren});
                }
        
                index++;
            }
        
            return folderData;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get metadata', arguments, {names:[VirtualFolder, this.getMetadata]});
        }
    }  

    /**
     * Creates a VirtualFolder from an array of Blob parts and metadata.
     * @param {AsyncIterable<Blob>} parts - An async iterable of Blob parts.
     * @param {Record<string, any>} metaData - The metadata of the original VirtualFolder.
     * @returns {Promise<VirtualFolder>} A promise that resolves to a reconstructed VirtualFolder.
     */
    public static async fromParts<A extends IBaseApp<A>>(app:A, abortable:IAbortable, parts:AsyncIterable<Blob | IAborted | IError>, metaData:VirtualFolderMetadata, writeFile:(filePath:string, fileName:string, uint8Array:Uint8Array) => Promise<IFileObject | IAborted | IError>):Promise<IVirtualFolder | IAborted | IError> 
    {
        try
        {
            const _ = new AbortableHelper(app, abortable).throwIfAborted();

            //reconstruct the VirtualFolder hierarchy from metadata
            const root = _.value(await VirtualFolder.__fromMetaData(app, metaData));

            //create an iterator for the Blob parts
            const iterator = parts[Symbol.asyncIterator]();
        
            const multiUint8Array = new MultipartUint8Array();

            //use a stack and an index to traverse the folder hierarchy
            const stack: {folder:IVirtualFolder, path:string}[] = [{folder:root, path:''}];
            let stackIndex = 0;
        
            while (stackIndex < stack.length) 
            {
                const {folder, path} = stack[stackIndex];

                for await (let child of folder.getChildren(abortable))
                {
                    child = _.value(child);

                    if (app.typeUtil.is<IVirtualFolder>(child, IVirtualFolderType) === true) 
                    {
                        //append the folder name to the path
                        stack.push({folder:child, path: path + '/' + _.value(await child.getName())});
                        continue;
                    }

                    const bytes = _.value(await child.getByteCount());
                    while (multiUint8Array.length < bytes)
                    {
                        //get the next part from the iterator
                        let {value:part, done} = _.value(await iterator.next());

                        //if there are no more parts, throw an error
                        if (done) app.throw('Not enough parts to construct the VirtualFolder', []);

                        part = _.value(part);

                        multiUint8Array.push(new Uint8Array(_.value(await part.arrayBuffer())));
                    }
                    
                    let file = _.value(await writeFile(path + '/', (_.value(await child.getName())), multiUint8Array.splice(0, bytes)));

                    child.__setFile(file);
                }
        
                stackIndex++; //advance to the next folder in the stack
            }
        
            //make sure there are no extra parts
            const {done} = await iterator.next();
            if (!done) app.throw('Too many parts to construct the VirtualFolder', []);
        
            return root;
        }
        catch (error)
        {
            return app.warn(error, 'Failed to create VirtualFolder from parts', arguments, {names:[VirtualFolder, VirtualFolder.fromParts]});
        }
    }
      
    public static async __fromMetaData<A extends IBaseApp<A>>(app:A, metaData:VirtualFolderMetadata):Promise<IVirtualFolder | IAborted | IError> 
    {
        try
        {
            const rootFolder = new VirtualFolder(app, metaData.name);
            const queue = [{parentFolder:rootFolder, childrenMetaData:metaData.children}];
            
            let index = 0;
        
            while (index < queue.length) 
            {
                let {parentFolder, childrenMetaData} = queue[index];
        
                for (let i = 0, length = childrenMetaData.length; i < length; i++) 
                {
                    let childData = childrenMetaData[i];
                    let child;
        
                    if ('children' in childData) 
                    {
                        child = new VirtualFolder(app, childData.name);
                        queue.push({parentFolder:child, childrenMetaData:childData.children});
                    } 
                    else child = VirtualFile.__fromMetaData(app, childData);
            
                    parentFolder.add(child);
                }
            
                index++;
            }
            
            return rootFolder;
        }
        catch (error)
        {
            return app.warn(error, 'Failed to create VirtualFolder from metadata', arguments, {names:[VirtualFolder, VirtualFolder.__fromMetaData]});
        }
    }

    /*
    private _deleted:boolean = false;
        public async delete():Promise<boolean> //delete removes this folder, whereas remove removes a child from this folder
    {
        let success:boolean = true;
        for (let child of this._children) 
        {
            let result = await child.delete();

            if (!result) success = false;
        }

        let parent = this._parent;
        if (parent) 
        {
            let result = await parent.remove(this);
            if (!result) success = false;
            else this._parent = undefined;

            if (result) this._deleted = true;
        }
        
        return success;
    }

    public get deleted():boolean
    {
    return this._deleted;
    }

    */
}