/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IAbortable } from "../../abort/IAbortable";
import { IBaseApp } from "../../IBaseApp";
import type { IDatable } from "../../data/IDatable";
import { FilePath } from "../Path";
import type { IDrive, IDriveFileInfo } from "./IDrive";
import type { IDriveFolder } from "./IDriveFolder";
import { IProgressor } from "../../progress/IProgressor";
import { IError } from "../../error/IError";
import { IAborted } from "../../abort/IAborted";
import { uid } from "../../utils/UIDUtil";

export const IDriveFileType = Symbol("IDriveFile");

export interface IDriveFile<A extends IBaseApp<A>>
{
    get uid():uid;

    getName():Promise<string | IAborted | IError>;

    getPath():Promise<string | IAborted | IError>;

    getParent():Promise<IDriveFolder<A> | undefined | IAborted | IError>;

    getMimeType():Promise<string | IAborted | IError>;

    getByteCount():Promise<number | IAborted | IError>;

    getBytes(abortable:IAbortable):Promise<IDatable<ReadableStream<Uint8Array>> | IAborted | IError>;
    setBytes(data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable, ...args:any):Promise<true | IAborted | IError>;

    get path():FilePath;

    get drive():IDrive<A>;

    getParent():Promise<IDriveFolder<A> | undefined | IAborted | IError>;

    getInfo():Promise<IDriveFileInfo | IAborted | IError>

    getTranscodedBytes(abortable:IAbortable):Promise<IDatable<ReadableStream<Uint8Array>> | undefined | IAborted | IError>;
    setTranscodedBytes(data:IDatable<ReadableStream<Uint8Array>>, progressor:IProgressor<A, undefined>):Promise<true | IAborted | IError>;

    getScreenshot(abortable:IAbortable):Promise<ImageBitmap | undefined | IAborted | IError>;
    getThumbnail(abortable:IAbortable):Promise<ImageBitmap | undefined | IAborted | IError>;

    __clearAncillaryCache():Promise<void>;
}