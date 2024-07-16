/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IDriveFileType, type IDriveFile } from "../../../../../../../shared/src/library/file/drive/IDriveFile";
import { AncillaryDataType, DataFormat, type IDrive, type IDriveFileInfo } from "../../../../../../../shared/src/library/file/drive/IDrive";
import type { IBaseApp } from "../../IBaseApp";
import type { IAbortable } from "../../../../../../../shared/src/library/abort/IAbortable";
import type { IDriveFolder } from "../../../../../../../shared/src/library/file/drive/IDriveFolder";
import type { IDatable } from "../../../../../../../shared/src/library/data/IDatable";
import { type uid } from "../../utils/UIDUtil";
import { ImplementsDecorator } from "../../../../../../../shared/src/library/decorators/ImplementsDecorator";
import { FilePath } from "../../../../../../../shared/src/library/file/Path";
import type { IError } from "../../../../../../../shared/src/library/error/IError";
import type { IAborted } from "../../../../../../../shared/src/library/abort/IAborted";
import { AbortableHelper } from "../../../../../../../shared/src/library/helpers/AbortableHelper";
import { Data } from "../../../../../../../shared/src/library/data/Data";
import { CLEAR_CACHE_FLAG } from "../../../../../../../shared/src/library/utils/PromiseUtil";

const THUMBNAIL_WIDTH = 256; //create 256x256 thumbnail's, but...
const THUMBNAIL_HEIGHT = 256;
const IMAGEBITMAP_WIDTH = 128; //...only use 128x128 (for now)
const IMAGEBITMAP_HEIGHT = 128;

@ImplementsDecorator(IDriveFileType)
export class DriveFile<A extends IBaseApp<A>> implements IDriveFile<A>
{
    private _uid:uid;
    public get uid():uid { return this._uid; }

    private _drive:IDrive<A>;
    public get drive():IDrive<A> { return this._drive; }

    private _path:FilePath;
    public get path():FilePath { return this._path; }

    private _getScreenshot;
    public getScreenshot;
    public getThumbnail;

    constructor(drive:IDrive<A>, path:FilePath)
    {
        const app = drive.app;

        this._drive = drive;
        this._path = path;

        this._uid = app.uidUtil.derive(drive.uid, path.toString(), true);

        this._getScreenshot = app.promiseUtil.debounceWithCache(async (abortable:IAbortable):Promise<[Uint8Array, string] | [undefined, string] | IAborted | IError> =>
        {
            try
            {
                const _ = new AbortableHelper(app, abortable).throwIfAborted();
    
                const mimeType = _.value(await this.getMimeType());
                if (app.stringUtil.isEmpty(mimeType) === true) return [undefined, mimeType];
    
                const data = _.value(await drive.getAncillaryFileData(this._path, AncillaryDataType.screenshot, abortable, DataFormat.Uint8Array));
                if (data !== undefined) return [data, mimeType];
                
                const isVideo = app.fileUtil.isVideo(mimeType);
                if (isVideo === true) 
                {
                    const data = _.value(await this.getTranscodedBytes(abortable)) ?? _.value(await this.getBytes(abortable));
    
                    const screenshot = _.value(await app.videoUtil.getScreenshot(data, mimeType, abortable));
                    if (screenshot === undefined) return [undefined, mimeType];
    
                    const imageBitmap = _.value(await app.imageUtil.getBitmap(new Data(app, async () => screenshot.stream()), mimeType, abortable));
                    if (imageBitmap === undefined) return [undefined, mimeType];
    
                    //save screenshot to file
                    _.check(await drive.setAncillaryFileData(this._path, new Data(app, async () => screenshot.stream()), AncillaryDataType.screenshot, abortable));
    
                    return [_.value(await drive.getAncillaryFileData(this._path, AncillaryDataType.screenshot, abortable, DataFormat.Uint8Array)), mimeType];
                }
    
                const isImage = app.fileUtil.isImage(mimeType);
                if (isImage !== false) 
                {
                    const data = _.value(await this.getTranscodedBytes(abortable)) ?? _.value(await this.getBytes(abortable));
                    const stream = _.value(await data.get());
                    return [_.value(await app.streamUtil.toUint8Array(stream)), mimeType];
                }
                return [undefined, mimeType];
            }
            catch (error)
            {
                return app.warn(error, 'Failed to get thumbnail from file', [this._path], {names:[DriveFile, this._getScreenshot]});
            }
        }, (result) => result === undefined || app.typeUtil.isError(result) === true || app.typeUtil.isAborted(result) === true);

        this.getScreenshot = app.promiseUtil.debounceWithCache(async (abortable:IAbortable):Promise<ImageBitmap | undefined | IAborted | IError> =>
        {
            try
            {
                const _ = new AbortableHelper(app, abortable).throwIfAborted();
    
                const [data, mimeType] = _.value(await this._getScreenshot(abortable)) as [Uint8Array, string] | [undefined, string];
                if (data === undefined) return undefined;
    
                return _.value(await app.imageUtil.getBitmap(new Data(app, async () => app.streamUtil.fromUint8Array(data)), mimeType, abortable));
            }
            catch (error)
            {
                return app.warn(error, 'Failed to get screenshot from file', [this._path], {names:[DriveFile, this.getScreenshot]});
            }
        }, (result) => result === undefined || app.typeUtil.isError(result) === true || app.typeUtil.isAborted(result) === true);

        this.getThumbnail = app.promiseUtil.debounceWithCache(async (abortable:IAbortable):Promise<ImageBitmap | undefined | IAborted | IError> =>
        {
            try
            {
                const _ = new AbortableHelper(app, abortable).throwIfAborted();
    
                const drive = this._drive;
    
                const mimeType = _.value(await this.getMimeType());
                if (app.stringUtil.isEmpty(mimeType) === true) return undefined;
    
                const data = _.value(await drive.getAncillaryFileData(this._path, AncillaryDataType.thumbnail, abortable, DataFormat.Data));
    
                if (data !== undefined) 
                {
                    const imageBitmap = _.value(await app.imageUtil.getBitmap(data, mimeType, abortable, IMAGEBITMAP_WIDTH, IMAGEBITMAP_HEIGHT));
                    if (imageBitmap !== undefined) return imageBitmap;
                    
                    app.consoleUtil.warn(this.constructor, 'Failed to get thumbnail from file storage, generating new thumbnail...', this._path);
                }
    
                const isVideo = app.fileUtil.isVideo(mimeType);
                if (isVideo === true) 
                {
                    const [data, _mimeType] = _.value(await this._getScreenshot(abortable)) as [Uint8Array, string] | [undefined, string];
                    if (data === undefined) return undefined; 
    
                    const blob = _.value(await app.imageUtil.getThumbnail(new Data(app, async () => app.streamUtil.fromUint8Array(data)), mimeType, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, abortable)); 
                    if (blob === undefined) return undefined;
    
                    const imageBitmap = _.value(await app.imageUtil.getBitmap(new Data(app, async () => blob.stream()), mimeType, abortable, IMAGEBITMAP_WIDTH, IMAGEBITMAP_HEIGHT)); //...only use 128x128 (for now)
                    if (imageBitmap === undefined) return undefined;
    
                    _.check(await drive.setAncillaryFileData(this._path, new Data(app, async () => blob.stream()), AncillaryDataType.thumbnail, abortable));
    
                    return imageBitmap;
                }
    
                const isImage = app.fileUtil.isImage(mimeType);
                if (isImage !== false)
                {
                    const [data, _mimeType] = _.value(await this._getScreenshot(abortable)) as [Uint8Array, string] | [undefined, string];
                    if (data === undefined) return undefined;
    
                    const blob = _.value(await app.imageUtil.getThumbnail(new Data(app, async () => app.streamUtil.fromUint8Array(data)), mimeType, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, abortable)); //create 256x256 thumbnail's, but...
                    if (blob === undefined) return undefined;
    
                    const imageBitmap = _.value(await app.imageUtil.getBitmap(new Data(app, async () => blob.stream()), mimeType, abortable, IMAGEBITMAP_WIDTH, IMAGEBITMAP_HEIGHT)); 
                    if (imageBitmap === undefined) return undefined;
    
                    _.check(await drive.setAncillaryFileData(this._path, new Data(app, async () => blob.stream()), AncillaryDataType.thumbnail, abortable));
    
                    return imageBitmap;
                }
                
                return undefined;
            }
            catch (error)
            {
                return this._drive.app.warn(error, 'Failed to get thumbnail from file', [this._path], {names:[DriveFile, this.getThumbnail]});
            }
        }, (result) => result === undefined || app.typeUtil.isError(result) === true || app.typeUtil.isAborted(result) === true);
    }

    public async getBytes(abortable:IAbortable):Promise<IDatable<ReadableStream<Uint8Array>> | IAborted | IError>
    {
        return this._drive.getFileData(this._path, abortable, DataFormat.Data);
    }

    public async getTranscodedBytes(abortable:IAbortable):Promise<IDatable<ReadableStream<Uint8Array>> | undefined | IAborted | IError>
    {
        return this._drive.getAncillaryFileData(this._path, AncillaryDataType.transcoded, abortable, DataFormat.Data);
    }

    public async getThumbnailBytes(abortable:IAbortable):Promise<IDatable<ReadableStream<Uint8Array>> | undefined | IAborted | IError>
    {
        return this._drive.getAncillaryFileData(this._path, AncillaryDataType.thumbnail, abortable, DataFormat.Data);
    }

    public async getScreenshotBytes(abortable:IAbortable):Promise<IDatable<ReadableStream<Uint8Array>> | undefined | IAborted | IError>
    {
        return this._drive.getAncillaryFileData(this._path, AncillaryDataType.screenshot, abortable, DataFormat.Data);
    }

    public async getParent():Promise<IDriveFolder<A> | undefined | IAborted | IError>
    {
        if (this._path.parent === undefined) return undefined;

        return this._drive.getFolder(this._path.parent);
    }

    public async getPath():Promise<string | IAborted | IError>
    {
        return this._path.toString();
    }

    public async getName():Promise<string | IAborted | IError> 
    {
        return this._path.name;
    }
  
    public async getExtension():Promise<string | IAborted | IError>
    {
        return this._path.extension;
    }

    public async getInfo():Promise<IDriveFileInfo | IAborted | IError> 
    { 
        return this._drive.getFileInfo(this._path);
    }

    public async getByteCount():Promise<number | IAborted | IError> 
    { 
        const app = this._drive.app;

        try
        {
            const _ = new AbortableHelper(app).throwIfAborted();

            const info = _.value(await this._drive.getFileInfo(this._path));
            return info.data.bytes.decrypted ?? 0;
        }
        catch (error)
        {
            return this._drive.app.warn(error, 'Failed to get byte count from file', [this._path], {names:[DriveFile, this.getByteCount]});
        }
    }

    public async getMimeType():Promise<string | IAborted | IError> 
    { 
        const app = this._drive.app;

        try
        {
            const _ = new AbortableHelper(app).throwIfAborted();

            const info = _.value(await this._drive.getFileInfo(this._path));
            return info.metadata.mimeType ?? '';
        }
        catch (error)
        {
            return this._drive.app.warn(error, 'Failed to get mime type from file', [this._path], {names:[DriveFile, this.getMimeType]});
        }
    }

    public async setBytes(data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        return this._drive.setFileData(this._path, data, abortable);
    }

    public async setTranscodedBytes(data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        return this._drive.setAncillaryFileData(this._path, data, AncillaryDataType.transcoded, abortable);
    }

    public async __clearAncillaryCache():Promise<void>
    {
        this._getScreenshot(CLEAR_CACHE_FLAG);
        this.getScreenshot(CLEAR_CACHE_FLAG);
        this.getThumbnail(CLEAR_CACHE_FLAG);
    }
}