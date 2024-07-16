/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../abort/IAbortable";
import { IBaseApp } from "../../IBaseApp";
import type { IDatable } from "../../data/IDatable";
import type { IWeakSignal } from "../../signal/IWeakSIgnal";
import { FolderPath, Path, path } from "../Path";
import type { IDrive, IDriveFileInfo, IDriveFileMetadata, IDriveFolderInfo, IDriveFolderMetadata } from "./IDrive";
import type { IDriveFile } from "./IDriveFile";
import { IError } from "../../error/IError";
import { IAborted } from "../../abort/IAborted";
import { uid } from "../../utils/UIDUtil";

export const IDriveFolderType = Symbol("IDriveFolder");

export interface IDriveFolder<A extends IBaseApp<A>>
{
    get uid():uid;

    getName():Promise<string | IAborted | IError>;

    getPath():Promise<string | IAborted | IError>;

    getParent():Promise<IDriveFolder<A> | undefined | IAborted | IError>;

    getCount(abortable:IAbortable):Promise<[number, number] | IAborted | IError>;
      
    getByteCount(abortable:IAbortable):Promise<number | IAborted | IError>;

    get path():FolderPath;

    get drive():IDrive<A>;

    /**
     * Adds a child file or folder to this folder.
     * If the child is already a child of this folder, this method returns true.
     * If the child is an ancestor of this folder, this method returns false.
     * If the child has a parent, it will be removed from its current parent and added to this folder.
     * @param child The child file or folder to add.
     * @returns A Promise that resolves to true if the child was successfully added, false otherwise.
     */

    add(child:IDriveFile<A> | IDriveFolder<A>, abortable:IAbortable):Promise<true | IAborted | IError>;

    /**
     * Removes a child file or folder from this folder.
     * @param child The child file or folder to remove.
     * @returns A promise that resolves to a boolean indicating whether the child was successfully removed.
     */

    remove(child:IDriveFile<A> | IDriveFolder<A>, abortable:IAbortable):Promise<true | IAborted | IError>;

    /**
     * Determines whether this folder contains the specified file or folder.
     * @param child The file or folder to check for.
     * @returns A Promise that resolves to a boolean indicating whether this folder contains the specified file or folder.
     */

    has(child:IDriveFile<A>| IDriveFolder<A>):Promise<boolean | IAborted | IError>;

    /**
     * Checks if the given folder or file is a ancestor of this folder.
     * @param folder The folder to check.
     * @returns A Promise that resolves to a boolean indicating whether the given folder is an ancestor of this folder.
     */

    isAncestorOf(folder:IDriveFile<A> | IDriveFolder<A>):Promise<boolean | IAborted | IError>;

    getChildren(abortable:IAbortable, options?:{hidden?:boolean}):AsyncGenerator<IDriveFile<A> | IDriveFolder<A> | IAborted | IError>;
    getChildren(abortable:IAbortable, options?:{type:'folder', hidden?:boolean}):AsyncGenerator<IDriveFolder<A> | IAborted | IError>;
    getChildren(abortable:IAbortable, options?:{type:'file', hidden?:boolean}):AsyncGenerator<IDriveFile<A> | IAborted | IError>;

    getChildrenInfo(abortable:IAbortable, options?:{hidden?:boolean}):AsyncGenerator<IDriveFolderInfo | IDriveFileInfo | IAborted | IError>;
    getChildrenInfo(abortable:IAbortable, options:{type:'folder', hidden?:boolean}):AsyncGenerator<IDriveFolderInfo | IAborted | IError>;
    getChildrenInfo(abortable:IAbortable, options:{type:'file', hidden?:boolean}):AsyncGenerator<IDriveFileInfo | IAborted | IError>;

    getDescendants(abortable:IAbortable, options?:{hidden?:boolean}):AsyncGenerator<IDriveFile<A> | IDriveFolder<A> | IAborted | IError>;
    getDescendants(abortable:IAbortable, options:{type:'file', hidden?:boolean}):AsyncGenerator<IDriveFile<A> | IAborted | IError>;
    getDescendants(abortable:IAbortable, options:{type:'folder', hidden?:boolean}):AsyncGenerator<IDriveFolder<A> | IAborted | IError>;

    getInfo():Promise<IDriveFolderInfo | IAborted | IError>;

    getCount(abortable:IAbortable, options?:{hidden?:boolean}):Promise<[number, number] | IAborted | IError>;
      
    getByteCount(abortable:IAbortable, options?:{hidden?:boolean}):Promise<number | IAborted | IError>;

    createFile<T extends IDriveFileMetadata>(name:string, metadata:T):Promise<IDriveFile<A> | IAborted | IError>;
    createFile<T extends IDriveFileMetadata>(name:string, metadata:T, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable):Promise<IDriveFile<A> | IAborted | IError>;
    createFile<T extends IDriveFileMetadata>(name:string, metadata:T, data:ReadableStream<Uint8Array>, abortable:IAbortable):Promise<IDriveFile<A> | IAborted | IError>;
    createFile<T extends IDriveFileMetadata>(name:string, metadata:T, data:Uint8Array, abortable:IAbortable):Promise<IDriveFile<A> | IAborted | IError>;
    createFile<T extends IDriveFileMetadata>(name:string, metadata:T, data:JsonObject, abortable:IAbortable):Promise<IDriveFile<A> | IAborted | IError>;
    createFile<T extends IDriveFileMetadata>(name:string, metadata:T, data:string, abortable:IAbortable):Promise<IDriveFile<A> | IAborted | IError>;
    createFileIfNotExists<T extends IDriveFileMetadata>(name:string, metadata:T):Promise<IDriveFile<A> | IAborted | IError>;
    createFileIfNotExists<T extends IDriveFileMetadata>(name:string, metadata:T, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<IDriveFile<A> | IAborted | IError>;
    createFileIfNotExists<T extends IDriveFileMetadata>(name:string, metadata:T, data:ReadableStream<Uint8Array>, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<IDriveFile<A> | IAborted | IError>;
    createFileIfNotExists<T extends IDriveFileMetadata>(name:string, metadata:T, data:Uint8Array, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<IDriveFile<A> | IAborted | IError>;
    createFileIfNotExists<T extends IDriveFileMetadata>(name:string, metadata:T, data:JsonObject, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<IDriveFile<A> | IAborted | IError>;
    createFileIfNotExists<T extends IDriveFileMetadata>(name:string, metadata:T, data:string, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<IDriveFile<A> | IAborted | IError>;
    
    createFolder<T extends IDriveFolderMetadata>(name:string, metadata:T):Promise<IDriveFolder<A> | IAborted | IError>;
    createFolderIfNotExists<T extends IDriveFolderMetadata>(name:string, metadata:T):Promise<IDriveFolder<A> | IAborted | IError>;

    get onChildAddedSignal():IWeakSignal<[IDriveFolder<A>, Path]>;
    get onChildRemovedSignal():IWeakSignal<[IDriveFolder<A>, Path]>;
    get onChildModifiedSignal():IWeakSignal<[IDriveFolder<A>, Path]>;
    get onChildRenamedSignal():IWeakSignal<[IDriveFolder<A>, Path, Path]>;
}