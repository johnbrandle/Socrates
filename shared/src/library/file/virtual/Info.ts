/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IBaseApp } from "../../IBaseApp";
import { IVirtualFolder } from "./IVirtualFolder";

export class Info<A extends IBaseApp<A>>
{
    private _folder:IVirtualFolder;

    private _bytes!:number;

    private _fileCount!:number;
    private _folderCount!:number;

    constructor(folder:IVirtualFolder)
    {
        this._folder = folder;
    }

    public async init():Promise<Info<A>>
    {
        this._bytes = await this._folder.getByteCount();
        [this._fileCount, this._folderCount] = await this._folder.getCount();

        return this;
    }

    public get fileCount():number
    {
        return this._fileCount;
    }

    public get folderCount():number
    {
        return this._folderCount;
    }

    public get bytes():number
    {
        return this._bytes;
    }

    public getPartCount(maximumBytesPerPart:number):number
    {
        return Math.ceil(this._bytes / maximumBytesPerPart) || 1;
    }   
}