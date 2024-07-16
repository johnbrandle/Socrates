/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { IFileObjectType, type IFileObject } from "./IFileObject";
import type { IDatable } from "../../data/IDatable";
import { IVirtualFileType, type IVirtualFile, type VirtualFileMetadata } from "./IVirtualFile";
import type { IVirtualFolder } from "./IVirtualFolder";
import type { IAbortable } from "../../abort/IAbortable";
import { ImplementsDecorator } from "../../decorators/ImplementsDecorator";
import { uid } from "../../utils/UIDUtil";
import { hex_256 } from "../../utils/HashUtil";
import { IError } from "../../error/IError";
import { IAborted } from "../../abort/IAborted";
import { Data } from "../../data/Data";
import { AbortableHelper } from "../../helpers/AbortableHelper";
import { IBaseApp } from "../../IBaseApp";

@ImplementsDecorator(IVirtualFileType)
export class VirtualFile<A extends IBaseApp<A>> implements IVirtualFile
{
    private _app:A;

    private _file:IFileObject;
    
    protected _name:string;
    private _parent:IVirtualFolder | undefined;
    protected _byteCount = -1;

    private _hash:hex_256 | undefined;

    private _stream:ReadableStream<Uint8Array> | undefined;

    private _uid:uid | undefined;

    constructor(app:A, file:IFileObject) 
    {
        this._app = app;

        this._file = file;
        this._byteCount = file.size;

        this._name = file.name;
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
        return this._parent ? `${await this._parent.getPath()}/${this._name}` : this._name;
    }

    public async getParent():Promise<IVirtualFolder | undefined | IAborted | IError>
    {
        return this._parent;
    }

    public async __setParent(parent:IVirtualFolder | undefined):Promise<true | IAborted | IError>
    {
        this._parent = parent;

        return true;
    }

    public async getHash(abortable:IAbortable):Promise<hex_256 | IAborted | IError>
    {
        this._app.throw('Not implemented', [], {correctable:true});

        /*
        if (this._hash !== undefined) return this._hash;

        const [hashTransformer, promise] = this._app.hashUtil.createTransformer();
        const stream = this._app.streamUtil.transform(this._file.stream(), [this._app.streamUtil.createAbortableTransformer(abortable), hashTransformer]);
        await this._app.streamUtil.consume(stream);

        const hash = await promise;
        this._hash = hash;

        return hash;
        */
    }

    public async getMimeType():Promise<string | IAborted | IError>
    {
        return this._file.type;
    }

    public async getByteCount():Promise<number | IAborted | IError>
    {
        return this._byteCount;
    }

    public async getBytes(abortable:IAbortable):Promise<IDatable<ReadableStream<Uint8Array>> | IAborted | IError>
    {
        const app = this._app;

        return new Data(app, async () => 
        {
            try
            {
                const _ = new AbortableHelper(this._app, abortable).throwIfAborted();

                return _.value(this._stream ?? this._file.stream());
            }
            catch (error)
            {
                return app.warn(error, 'Failed to get bytes', arguments, {names:[this.constructor, this.getBytes]});
            }
        });
    }

    public async setBytes(data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable, byteCount:number):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = new AbortableHelper(this._app, abortable).throwIfAborted();

            const stream = _.value(await data.get());

            this._stream = stream;
            this._byteCount = byteCount;

            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to set bytes', arguments, {names:[this.constructor, this.setBytes]});
        }
    }

    public async getMetadata():Promise<VirtualFileMetadata | IAborted | IError>
    {
        return {name:this._name, byteCount:this._byteCount};
    }

    public __setFile(file:IFileObject):void
    {
        this._file = file;
    }

    public static __fromMetaData<A extends IBaseApp<A>>(app:A, metaData:VirtualFileMetadata):IVirtualFile 
    {
        return new VirtualFile(app, new EmptyFile(metaData.name, metaData.byteCount));
    }
}

@ImplementsDecorator(IFileObjectType)
class EmptyFile implements IFileObject
{
    private _name:string
    private _bytes:number = 0;

    constructor(name:string, bytes:number)
    {
        this._name = name;
        this._bytes = bytes;
    }

    public get name()
    {
        return this._name;
    }

    public get size()
    {
        return this._bytes;
    }

    public get type()
    {
        return '';
    }

    public async arrayBuffer():Promise<ArrayBuffer>
    {
        return new ArrayBuffer(0);
    }
    
    public stream():ReadableStream<Uint8Array>
    {
        return new ReadableStream<Uint8Array>();
    }
    
    public async text():Promise<string>
    {
        return '';
    }
}