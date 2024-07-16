/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../abort/IAbortable";
import { IAborted } from "../../abort/IAborted";
import type { IDatable } from "../../data/IDatable";
import { IError } from "../../error/IError";
import { uid } from "../../utils/UIDUtil";
import type { IFileObject } from "./IFileObject";
import type { IVirtualFolder } from "./IVirtualFolder";

export type VirtualFileMetadata = 
{
    name:string;
    byteCount:number;
}

export const IVirtualFileType = Symbol("IVirtualFile");

export interface IVirtualFile
{  
    get uid():uid;

    getName():Promise<string | IAborted | IError>;

    getPath():Promise<string | IAborted | IError>;

    getMimeType():Promise<string | IAborted | IError>;

    getByteCount():Promise<number | IAborted | IError>;

    setName(name:string):Promise<true | IAborted | IError>;

    getParent():Promise<IVirtualFolder | undefined | IAborted | IError>;
    __setParent(parent:IVirtualFolder | undefined):Promise<true | IAborted | IError>;

    getBytes(abortable:IAbortable):Promise<IDatable<ReadableStream<Uint8Array>> | IAborted | IError>;
    setBytes(data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable, byteCount:number):Promise<true | IAborted | IError>;

    getHash(abortable:IAbortable):Promise<string | IAborted | IError>;

    getMetadata():Promise<VirtualFileMetadata| IAborted | IError>;

    __setFile(file:IFileObject):void;
}