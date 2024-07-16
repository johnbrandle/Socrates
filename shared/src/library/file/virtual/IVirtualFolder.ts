/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IAbortable } from "../../abort/IAbortable";
import { IAborted } from "../../abort/IAborted";
import { IError } from "../../error/IError";
import { uid } from "../../utils/UIDUtil";
import type { IVirtualFile, VirtualFileMetadata } from "./IVirtualFile";

export type VirtualFolderMetadata = 
{
    name:string;
    children:Array<VirtualFileMetadata | VirtualFolderMetadata>;
}

export const IVirtualFolderType = Symbol("IVirtualFolder");

export interface IVirtualFolder
{
    get uid():uid;

    getName():Promise<string | IAborted | IError>;

    getPath():Promise<string | IAborted | IError>;

    getParent():Promise<IVirtualFolder | undefined | IAborted | IError>;

    getCount(abortable:IAbortable):Promise<[number, number] | IAborted | IError>;
      
    getByteCount(abortable:IAbortable):Promise<number | IAborted | IError>;

    setName(name:string):Promise<true | IAborted | IError>;

    getParent():Promise<IVirtualFolder | undefined | IAborted | IError>;
    __setParent(parent:IVirtualFolder | undefined):Promise<true | IAborted | IError>;

    getMetadata(abortable:IAbortable):Promise<VirtualFolderMetadata | IAborted | IError>;

    /**
     * Adds a child file or folder to this folder.
     * If the child is already a child of this folder, this method returns true.
     * If the child is an ancestor of this folder, this method returns false.
     * If the child has a parent, it will be removed from its current parent and added to this folder.
     * @param child The child file or folder to add.
     * @returns A Promise that resolves to true if the child was successfully added, false otherwise.
     */
    add(child:IVirtualFile | IVirtualFolder):Promise<true | IAborted | IError>;

    /**
     * Removes a child file or folder from this folder.
     * @param child The child file or folder to remove.
     * @returns A promise that resolves to a boolean indicating whether the child was successfully removed.
     */
    remove(child:IVirtualFile | IVirtualFolder):Promise<true | IAborted | IError>;
    
    /**
     * Determines whether this folder contains the specified file or folder.
     * @param child The file or folder to check for.
     * @returns A Promise that resolves to a boolean indicating whether this folder contains the specified file or folder.
     */
    has(child:IVirtualFile | IVirtualFolder):Promise<boolean | IAborted | IError>;

    /**
     * Checks if the given folder or file is a ancestor of this folder.
     * @param folder The folder to check.
     * @returns A Promise that resolves to a boolean indicating whether the given folder is an ancestor of this folder.
     */
    isAncestorOf(folder:IVirtualFolder | IVirtualFile):Promise<boolean | IAborted | IError>;

    getChildren(abortable:IAbortable):AsyncGenerator<IVirtualFile | IVirtualFolder | IAborted | IError>;
    getChildren(abortable:IAbortable, options:{type:'file'}):AsyncGenerator<IVirtualFile | IAborted | IError>;
    getChildren(abortable:IAbortable, options:{type:'folder'}):AsyncGenerator<IVirtualFolder | IAborted | IError>;

    getDescendants(abortable:IAbortable):AsyncGenerator<IVirtualFile | IVirtualFolder | IAborted | IError>;
    getDescendants(abortable:IAbortable, options:{type:'file'}):AsyncGenerator<IVirtualFile | IAborted | IError>;
    getDescendants(abortable:IAbortable, options:{type:'folder'}):AsyncGenerator<IVirtualFolder | IAborted | IError>;

    /**
     * Asynchronously generates parts of data from the files in the Folder.
     * Each part is a Blob with a size not exceeding the specified maxBytesPerPart.
     * Works with multiple files of varying sizes by iterating over each file's blob stream,
     * chunking it into parts of the specified size, and yielding them as Blob objects.
     * @param {number} maxBytesPerPart - Maximum size for each Blob part in bytes.
     * @returns {AsyncGenerator<Blob>} A generator that yields Blob parts, each close to the size defined by maxBytesPerPart.
     * @throws {Error} If any error occurs during file retrieval or stream reading.
     */
    parts(abortable:IAbortable, maxBytesPerPart:number):AsyncGenerator<Blob | IAborted | IError>;
}