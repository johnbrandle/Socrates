/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../abort/IAbortable";
import type { IDatable } from "../../data/IDatable";
import type { IFileInfo, IFolderInfo } from "../storage/IFileStorage";
import type { IDriveFile } from "./IDriveFile";
import type { IDriveFolder } from "./IDriveFolder";
import { IError } from "../../error/IError";
import { filepath, FilePath, folderpath, FolderPath, path } from "../Path";
import { IBaseApp } from "../../IBaseApp";
import { IAborted } from "../../abort/IAborted";
import { uid } from "../../utils/UIDUtil";

export enum FileType
{
    Other = 'other',
    Ancillary = 'ancillary',
    Unclassified = 'unclassified',
    Alias = 'alias',
    Video = 'video',
    Audio = 'audio',
    Image = 'image',
}

export interface IDriveFileInfo extends IFileInfo
{
    readonly metadata:IDriveFileMetadata;
}
export interface IDriveFolderInfo extends IFolderInfo
{
    readonly metadata:IDriveFolderMetadata;
}

export interface IMetadata extends JsonObject
{
    readonly immutable:boolean, 
    readonly hidden:boolean,
}
export interface IDriveFolderMetadata extends IMetadata
{
    readonly compressed:boolean, 
    readonly app:boolean, 
    extra:JsonObject
}
export interface IDriveFileMetadata extends IMetadata
{
    readonly type:FileType;
    readonly mimeType?:string;
}
export interface IOtherDriveFileMetadata extends IDriveFileMetadata
{
    readonly type:FileType.Other;
}
export interface IAliasDriveFileMetadata extends IDriveFileMetadata
{
    readonly type:FileType.Alias;
    readonly aliasOfPath:string;
    readonly aliasOfType:'file' | 'folder';
}

export enum MediaQuality
{
    Low = 0,
    Medium = 1,
    High = 2,
}

export interface IMediaThumbnailInfo extends JsonObject
{
    readonly width:number;
    readonly height:number;
    readonly quality:MediaQuality;
    readonly mimeType:string;
}

export interface IMediaTranscodeInfo extends JsonObject
{
    readonly quality:MediaQuality;
    readonly mimeType:string;
}
export interface IVideoTranscodeInfo extends IMediaTranscodeInfo
{
    readonly codec:string;
}
export interface IAudioTranscodeInfo extends IMediaTranscodeInfo
{
    readonly codec:string;
}

export interface IMediaDriveFileMetadata extends IDriveFileMetadata
{
    readonly type:FileType.Video | FileType.Audio | FileType.Image;
    readonly thumbnailInfo?:IMediaThumbnailInfo;
    readonly transcodeInfo?:IMediaTranscodeInfo;
}

export interface IVideoFileInfo extends IMediaDriveFileMetadata
{
    readonly type:FileType.Video;
    readonly transcodeInfo?:IVideoTranscodeInfo;
}

export interface IAudioFileInfo extends IMediaDriveFileMetadata
{
    readonly type:FileType.Audio;
    readonly transcodeInfo?:IAudioTranscodeInfo;
}

export interface IImageFileInfo extends IMediaDriveFileMetadata
{
    readonly type:FileType.Image;
    readonly transcodeInfo?:IMediaTranscodeInfo;
}

export enum DataFormat
{
    string = 'string',
    JsonObject = 'json',
    Uint8Array = 'uint8array',
    ReadableStream = 'readablestream',
    Data = 'data',
}

export enum AncillaryDataType
{
    thumbnail = 'thumbnail',
    transcoded = 'transcoded',
    screenshot = 'screenshot',
}

export const IDriveType = Symbol("IDrive");

export interface IDrive<A extends IBaseApp<A>> extends IAbortable<A>
{
    get uid():uid;

    init():Promise<true | IAborted | IError>
    exists(path:FilePath | FolderPath):Promise<false | 'file' | 'folder' | IAborted | IError>;
    existsFolder(path:FolderPath):Promise<boolean | IAborted | IError>;
    existsFile(path:FilePath):Promise<boolean | IAborted | IError>;
    
    createFolder<T extends IDriveFolderMetadata>(path:FolderPath, metadata:T):Promise<true | IAborted | IError>;
    createFolderIfNotExists<T extends IDriveFolderMetadata>(path:FolderPath, metadata:T):Promise<true | IAborted | IError>;

    createFile<T extends IDriveFileMetadata>(path:FilePath, metadata:T):Promise<true | IAborted | IError>;
    createFile<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable):Promise<true | IAborted | IError>;
    createFile<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:ReadableStream<Uint8Array>, abortable:IAbortable):Promise<true | IAborted | IError>;
    createFile<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:Uint8Array, abortable:IAbortable):Promise<true | IAborted | IError>;
    createFile<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:JsonObject, abortable:IAbortable):Promise<true | IAborted | IError>;
    createFile<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:string, abortable:IAbortable):Promise<true | IAborted | IError>;
    createFileIfNotExists<T extends IDriveFileMetadata>(path:FilePath, metadata:T):Promise<true | IAborted | IError>;
    createFileIfNotExists<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<true | IAborted | IError>;
    createFileIfNotExists<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:ReadableStream<Uint8Array>, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<true | IAborted | IError>;
    createFileIfNotExists<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:Uint8Array, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<true | IAborted | IError>;
    createFileIfNotExists<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:JsonObject, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<true | IAborted | IError>;
    createFileIfNotExists<T extends IDriveFileMetadata>(path:FilePath, metadata:T, data:string, abortable:IAbortable, options?:{overwrite?:boolean}):Promise<true | IAborted | IError>;
    
    copyFolder(fromPath:FolderPath, toPath:FolderPath, abortable:IAbortable, options?:{recursive?:boolean}):Promise<true | IAborted | IError>;
    copyFile(fromFilePath:FilePath, toFilePath:FilePath, abortable:IAbortable):Promise<true | IAborted | IError>;
    
    moveFolder(fromPath:FolderPath, toPath:FolderPath, abortable:IAbortable):Promise<true | IAborted | IError>;
    moveFile(fromFilePath:FilePath, toFilePath:FilePath, abortable:IAbortable):Promise<true | IAborted | IError>;

    hasFileData(path:FilePath):Promise<boolean | IAborted | IError>;

    getFileData(path:FilePath, abortable:IAbortable, format:DataFormat.Data):Promise<IDatable<ReadableStream> | IAborted | IError>;
    getFileData(path:FilePath, abortable:IAbortable, format:DataFormat.ReadableStream):Promise<ReadableStream<Uint8Array> | IAborted | IError>;
    getFileData(path:FilePath, abortable:IAbortable, format:DataFormat.Uint8Array):Promise<Uint8Array | IAborted | IError>;
    getFileData<T extends JsonObject>(path:FilePath, abortable:IAbortable, format:DataFormat.JsonObject):Promise<T | IAborted | IError>;
    getFileData(path:FilePath, abortable:IAbortable, format:DataFormat.string):Promise<string | IAborted | IError>;

    setFileData(path:FilePath, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable):Promise<true | IAborted | IError>;
    setFileData(path:FilePath, data:ReadableStream<Uint8Array>, abortable:IAbortable):Promise<true | IAborted | IError>;
    setFileData(path:FilePath, data:Uint8Array, abortable:IAbortable):Promise<true | IAborted | IError>;
    setFileData(path:FilePath, data:JsonObject, abortable:IAbortable):Promise<true | IAborted | IError>;
    setFileData(path:FilePath, data:string, abortable:IAbortable):Promise<true | IAborted | IError>;

    getAncillaryFileData(path:FilePath, type:AncillaryDataType, abortable:IAbortable, format:DataFormat.Data):Promise<IDatable<ReadableStream> | undefined | IAborted | IError>;
    getAncillaryFileData(path:FilePath, type:AncillaryDataType, abortable:IAbortable, format:DataFormat.ReadableStream):Promise<ReadableStream<Uint8Array> | undefined | IAborted | IError>;
    getAncillaryFileData(path:FilePath, type:AncillaryDataType, abortable:IAbortable, format:DataFormat.Uint8Array):Promise<Uint8Array | undefined | IAborted | IError>;

    setAncillaryFileData(path:FilePath, data:IDatable<ReadableStream<Uint8Array>> | undefined, type:AncillaryDataType, abortable:IAbortable):Promise<true | IAborted | IError>;
    setAncillaryFileData(path:FilePath, data:ReadableStream<Uint8Array> | undefined, type:AncillaryDataType, abortable:IAbortable):Promise<true | IAborted | IError>;
    setAncillaryFileData(path:FilePath, data:Uint8Array | undefined, type:AncillaryDataType, abortable:IAbortable):Promise<true | IAborted | IError>;

    getFileInfo(path:FilePath):Promise<IDriveFileInfo | IAborted | IError>;
    getFolderInfo(path:FolderPath):Promise<IDriveFolderInfo | IAborted | IError>

    setFileMetadata<T extends IDriveFileMetadata>(path:FilePath, metadata:T):Promise<true | IAborted | IError>;
    setFolderMetadata<T extends IDriveFolderMetadata>(path:FolderPath, metadata:T):Promise<true | IAborted | IError>;

    rename(path:FolderPath | folderpath | FilePath | filepath, name:string, abortable:IAbortable):Promise<void | IAborted | IError>;
    renameFolder(path:FolderPath | folderpath, name:string, abortable:IAbortable):Promise<void | IAborted | IError>;
    renameFile(path:FilePath | filepath, name:string, abortable:IAbortable):Promise<void | IAborted | IError>;
    
    deleteFile(path:FilePath, abortable:IAbortable, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>;
    deleteFolder(path:FolderPath, abortable:IAbortable, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>;

    listFolder(path:FolderPath, abortable:IAbortable):AsyncGenerator<IDriveFolderInfo | IDriveFileInfo | IAborted | IError>;
    
    clear(abortable:IAbortable):Promise<true | IAborted | IError>; 

    get rootFolderPath():FolderPath;

    get rootFolder():IDriveFolder<A>;

    getFolder(path:FolderPath | folderpath):IDriveFolder<A>;
    getFile(path:FilePath | filepath):IDriveFile<A>;

    getFileOrFolder(path:folderpath):IDriveFolder<A>;
    getFileOrFolder(path:filepath):IDriveFile<A>;
    getFileOrFolder(path:path):IDriveFile<A> | IDriveFolder<A>;
    
    __getCachedFolder(path:FolderPath):IDriveFolder<A> | undefined;
    __getCachedFile(path:FilePath):IDriveFile<A> | undefined;

    get app():A;
}