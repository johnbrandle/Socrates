/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../../abort/IAbortable";
import type { IAborted } from "../../../abort/IAborted";
import { IBaseApp } from "../../../IBaseApp";
import { IError } from "../../../error/IError";
import { FilePath, FolderPath } from "../../Path";
import { IDatable } from "../../../data/IDatable";

export const IFileStorageAdapterType = Symbol("IFileStorageAdapter");

export interface IFileStorageAdapter<A extends IBaseApp<A>>
{
    exists(fileOrFolderPath:FolderPath | FilePath):Promise<false | 'file' | 'folder' | IAborted | IError>;
    
    createFolder(folderPath:FolderPath):Promise<true | IAborted | IError>;
    createFile(filePath:FilePath):Promise<true | IAborted | IError>;

    hasFileData(path:FilePath):Promise<boolean | IAborted | IError>;
    
    getFileData(filePath:FilePath, abortable:IAbortable):Promise<IDatable<ReadableStream<Uint8Array>>>;
    setFileData(filePath:FilePath, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable):Promise<true | IAborted | IError>;
    
    renameFolder(folderPath:FolderPath, name:string):Promise<true | IAborted | IError>;
    renameFile(filePath:FilePath, name:string):Promise<true | IAborted | IError>;
    get hasNativeSupportForRenaming():boolean;

    listFolder(folderPath:FolderPath, abortable:IAbortable):AsyncGenerator<FolderPath | FilePath | IAborted | IError>;
    
    deleteFolder(folderPath:FolderPath, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>;
    deleteFile(filePath:FilePath, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>;
}