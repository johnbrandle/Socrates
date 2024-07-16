/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../abort/IAbortable";
import type { IDatable } from "../../data/IDatable";
import type { IAborted } from "../../abort/IAborted";
import { FilePath, filepath, FolderPath, folderpath, path } from "../Path";
import { uid } from "../../utils/UIDUtil";
import { IBaseApp } from "../../IBaseApp";
import { IError } from "../../error/IError";
import { IProgressor } from "../../progress/IProgressor";

export const IFileStorageType = Symbol("IFileStorage");

export interface IInfo extends JsonObject
{
    name:string,
    path:path,
    type:'file' | 'folder',
    metadata:JsonObject,
    created:number,
    modified:number,
    accessed:number,
}

export interface IFolderInfo extends IInfo
{
    type:'folder',
    path:folderpath,
}

export interface IFileInfo extends IInfo
{
    type:'file',
    path:filepath,
    extension:string,
    data:
    {
        uid:uid, 
        bytes:
        {
            decrypted:number, 
            encrypted:number
        }, 
        chunks:number, 
        format:number,
        metadata:JsonObject,
    },
}

export interface IFileStorage<A extends IBaseApp<A>> extends IAbortable<A>
{
    init():Promise<true | IAborted | IError>;
    
    get rootFolderName():string;

    exists(path:FolderPath | FilePath):Promise<false | 'file' | 'folder' | IAborted | IError>;
    
    existsFile(path:FilePath):Promise<boolean | IAborted | IError>;
    existsFolder(path:FolderPath):Promise<boolean | IAborted | IError>;
    
    createFolder<T extends JsonObject>(path:FolderPath, options?:{metadata?:T}):Promise<true | IAborted | IError>;
    createFile<T extends JsonObject>(path:FilePath, options?:{metadata?:T}):Promise<true | IAborted | IError>;
    
    renameFolder(path:FolderPath, name:string, abortable:IAbortable):Promise<true | IAborted | IError>;
    renameFile(path:FilePath, name:string, abortable:IAbortable):Promise<true | IAborted | IError>;

    copyFolder(fromPath:FolderPath, toPath:FolderPath, abortable:IAbortable):Promise<true | IAborted | IError>;
    copyFile(fromFilePath:FilePath, toFilePath:FilePath, abortable:IAbortable):Promise<true | IAborted | IError>;
    
    moveFolder(fromPath:FolderPath, toPath:FolderPath, abortable:IAbortable):Promise<true | IAborted | IError>;
    moveFile(fromFilePath:FilePath, toFilePath:FilePath, abortable:IAbortable):Promise<true | IAborted | IError>;
    
    hasFileData(path:FilePath):Promise<boolean | IAborted | IError>;

    getFileData(path:FilePath, abortable:IAbortable):Promise<IDatable<ReadableStream<Uint8Array>>>;
    setFileData(path:FilePath, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable):Promise<true | IAborted | IError>;

    getFileInfo<T extends IFileInfo>(path:FilePath):Promise<T | IAborted | IError>;
    getFolderInfo<T extends IFolderInfo>(path:FolderPath):Promise<T | IAborted | IError>;

    setFileMetadata<T extends JsonObject>(path:FilePath, metadata:T):Promise<true | IAborted | IError>;
    setFolderMetadata<T extends JsonObject>(path:FolderPath, metadata:T):Promise<true | IAborted | IError>;
    
    deleteFile(path:FilePath, abortable:IAbortable, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>;
    deleteFolder(path:FolderPath, abortable:IAbortable, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>;

    listFolder<T extends IFileInfo | IFolderInfo>(path:FolderPath, abortable:IAbortable):AsyncGenerator<T | IAborted | IError>;

    clear(abortable:IAbortable):Promise<true | IAborted | IError>;
}