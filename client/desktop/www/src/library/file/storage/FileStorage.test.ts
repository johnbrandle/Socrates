/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../../IBaseApp";
import { Data } from "../../../../../../../shared/src/library/data/Data";
import { TestSuite } from "../../../../../../../shared/src/library/test/TestSuite.test";
import { KeyType } from "../../utils/KeyUtil";
import { HashOutputFormat, type hex_256 } from "../../utils/HashUtil";
import type { IFileStorage } from "../../../../../../../shared/src/library/file/storage/IFileStorage";
import { FileStorage } from "../../../../../../../shared/src/library/file/storage/FileStorage";
import { OPFSFileStorageAdapter } from "./adapters/OPFSFileStorageAdapter";
import type { IFileStorageAdapter } from "../../../../../../../shared/src/library/file/storage/adapters/IFileStorageAdapter";
import { FilePath, FolderPath } from "../../../../../../../shared/src/library/file/Path";
import type { IError } from "../../../../../../../shared/src/library/error/IError";
import type { IAborted } from "../../../../../../../shared/src/library/abort/IAborted";

export class FileStorageTestSuite<A extends IBaseApp<A>> extends TestSuite<A> 
{
    public override async init():Promise<TestSuite<A>>
    {
        await super.init();

        this.addTest(this.FileStorage_createFolder);
        this.addTest(this.FileStorage_createFile);
        this.addTest(this.FileStorage_getFileInfo);
        this.addTest(this.FileStorage_getFolderInfo);
        this.addTest(this.FileStorage_setFileMetadata);
        this.addTest(this.FileStorage_setFolderMetadata);
        this.addTest(this.FileStorage_listFolder);
        this.addTest(this.FileStorage_deleteFile);
        this.addTest(this.FileStorage_deleteFolder);
        this.addTest(this.FileStorage_setFileData);
        this.addTest(this.FileStorage_copyFile);
        this.addTest(this.FileStorage_moveFile);
        this.addTest(this.FileStorage_copyFolder);
        this.addTest(this.FileStorage_moveFolder);
        this.addTest(this.FileStorage_renameFile);
        this.addTest(this.FileStorage_renameFolder);
        this.addTest(this.FileStorage_clear);

        return this;
    }

    async FileStorage_createFolder():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());

            const created = _.value(await opfs.createFolder(new FolderPath("/foo/")), {allowError:true});
            this.assertTrue(created, {id:"createFolder"});

            const exists = _.value(await opfs.exists(new FolderPath("/foo/")), {allowError:true});
            this.assertTrue(exists === "folder", {id:"exists"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }

    async FileStorage_createFile():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());

            const created = await opfs.createFile(new FilePath("/foo"));
            this.assertTrue(created, {id:"createFile"});

            const exists = await opfs.exists(new FilePath("/foo"));
            this.assertTrue(exists === "file", {id:"exists"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }

    async FileStorage_getFileInfo():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());
            
            const created = await opfs.createFile(new FilePath("/foo"));
            this.assertTrue(created, {id:"createFile"});

            const info = await opfs.getFileInfo(new FilePath("/foo"));
            this.assertTrue(info !== undefined, {id:"getFileMetadata"});

            this.assertTrue(info?.name === "foo", {id:"name"});
            this.assertTrue(info?.type === "file", {id:"type"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }

    async FileStorage_getFolderInfo():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());
            
            const created = await opfs.createFolder(new FolderPath("/foo/"));
            this.assertTrue(created, {id:"createFolder"});

            const info = await opfs.getFolderInfo(new FolderPath("/foo/"));
            this.assertTrue(info !== undefined, {id:"getFolderMetadata"});

            this.assertTrue(info?.name === "foo", {id:"name"});
            this.assertTrue(info?.type === "folder", {id:"type"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }

    async FileStorage_deleteFile():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());
            
            const created = await opfs.createFile(new FilePath("/foo"));
            this.assertTrue(created, {id:"createFile"});

            const textToWrite = this._app.textUtil.generate(1024 * 1024 * 10, {secureMode:false}); //10MB
            const dataToWrite = this._app.textUtil.toUint8Array(textToWrite);
            const stream = this._app.streamUtil.fromUint8Array(dataToWrite);

            const set = await opfs.setFileData(new FilePath("/foo"), new Data(this._app, async () => stream), this);
            this.assertTrue(set, {id:"setFileData"});

            const deleted = await opfs.deleteFile(new FilePath("/foo"), this);
            this.assertTrue(deleted, {id:"deleteFile"});

            const exists = await opfs.exists(new FilePath("/foo"));
            this.assertTrue(exists === false, {id:"exists"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }

    async FileStorage_setFileMetadata():Promise<void>
    {
        const _ = this.abortableHelper.throwIfAborted();

        let opfs:IFileStorage<A> | undefined;

        try
        {
            opfs = _.value(await this.createFileStorage());
            
            const created = await opfs.createFile(new FilePath("/foo"));
            this.assertTrue(created, {id:"createFile"});

            const set = await opfs.setFileMetadata(new FilePath("/foo"), {foo:'bar'});
            this.assertTrue(set, {id:"setFileMetadata"});

            const metadata = await opfs.getFileInfo(new FilePath("/foo"));
            this.assertTrue(metadata !== undefined, {id:"getFileMetadata"});

            this.assertTrue(metadata?.metadata.foo === "bar", {id:"foo"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }

    async FileStorage_setFolderMetadata():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());
            
            const created = await opfs.createFolder(new FolderPath("/foo/"));
            this.assertTrue(created, {id:"createFolder"});

            const set = await opfs.setFolderMetadata(new FolderPath("/foo/"), {foo:'bar'});
            this.assertTrue(set, {id:"setFolderMetadata"});

            const metadata = await opfs.getFolderInfo(new FolderPath("/foo/"));
            this.assertTrue(metadata !== undefined, {id:"getFolderMetadata"});

            this.assertTrue(metadata?.metadata.foo === "bar", {id:"foo"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }

    async FileStorage_setFileData():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());
            
            const created = await opfs.createFile(new FilePath("/foo"));
            this.assertTrue(created, {id:"createFile"});

            const textToWrite = this._app.textUtil.generate(1024 * 1024 * 10, {secureMode:false}); //10MB
            const dataToWrite = this._app.textUtil.toUint8Array(textToWrite);
            const stream = this._app.streamUtil.fromUint8Array(dataToWrite);

            const set = this._app.extractOrRethrow(await opfs.setFileData(new FilePath("/foo"), new Data(this._app, async () => stream), this));
            this.assertTrue(set, {id:"setFileData"});

            const data = this._app.extractOrRethrow(await opfs.getFileData(new FilePath("/foo"), this));
            this.assertTrue(data !== undefined, {id:"getFileData"});

            const stream2 = await data?.get();
            this.assertTrue(stream2 !== undefined, {id:"getData"});

            const data2 = this._app.extractOrRethrow(await this._app.streamUtil.toUint8Array(stream2!), [stream2]);

            const readData = this._app.textUtil.fromUint8Array(data2);

            this.assertTrue(readData === textToWrite, {id:"setFileData"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }

    async FileStorage_copyFolder():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        //attempt to copy to non-existent folder
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());

            const created0 = await opfs.createFolder(new FolderPath("/foo2/"));
            this.assertTrue(created0, {id:"createFolder"});

            const created1 = await opfs.createFolder(new FolderPath("/foo2/foo1/"));
            this.assertTrue(created1, {id:"createFolder"});
            
            const created2 = await opfs.createFolder(new FolderPath("/foo2/foo1/foo2/"));
            this.assertTrue(created2, {id:"createFolder"});

            const created3 = await opfs.createFile(new FilePath("/foo2/foo1/foo2/bar"));
            this.assertTrue(created3, {id:"createFile"});

            const copied = await this.#copyFolderRecursive(opfs, new FolderPath("/foo2/"), new FolderPath("/fooTo2/"));
            this.assertTrue(copied, {id:"copyFolder 2"});

            const exists = await opfs.exists(new FilePath("/fooTo2/foo1/foo2/bar"));
            this.assertTrue(exists === "file", {id:"exists 2"});
        }
        finally
        {
            await opfs?.clear(this);
        }
        
        //attempt to copy to existant file
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());

            const created0 = await opfs.createFolder(new FolderPath("/foo3/"));
            this.assertTrue(created0, {id:"createFolder"});

            const created1 = await opfs.createFolder(new FolderPath("/foo3/foo1/"));
            this.assertTrue(created1, {id:"createFolder"});
            
            const created2 = await opfs.createFolder(new FolderPath("/foo3/foo1/foo2/"));
            this.assertTrue(created2, {id:"createFolder"});

            const created3 = await opfs.createFile(new FilePath("/foo3/foo1/foo2/bar"));
            this.assertTrue(created3, {id:"createFile"});

            const created4 = await opfs.createFile(new FilePath("/fooTo3"));
            this.assertTrue(created4, {id:"createFile"});

            //this.assertThrows(async () => await opfs.copyFolder(new FolderPath("/foo3/"), new FolderPath("/fooTo3/"), this), {id:"copyFolder 3"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }

    async FileStorage_copyFile():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());

            const created = await opfs.createFile(new FilePath("/foo"));
            this.assertTrue(created, {id:"createFile"});

            const created2 = await opfs.createFolder(new FolderPath("/fooTo/"));
            this.assertTrue(created2, {id:"createFile"});

            //create data for the file
            const dataToWrite = this._app.baseUtil.fromHex('aa' as hex_256);
            const stream = this._app.streamUtil.fromUint8Array(dataToWrite);
            const set = await opfs.setFileData(new FilePath("/foo"), new Data(this._app, async () => stream), this);
            this.assertTrue(set, {id:"setFileData"});

            const copied = await opfs.copyFile(new FilePath("/foo"), new FilePath("/fooTo/fooCopy"), this);
            this.assertTrue(copied, {id:"copyFile"});

            const exists = await opfs.exists(new FilePath("/fooTo/fooCopy"));
            this.assertTrue(exists === "file", {id:"exists"});

            //read the data
            const data = await opfs.getFileData(new FilePath("/fooTo/fooCopy"), this);
            this.assertTrue(data !== undefined, {id:"getFileData"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }

    async FileStorage_moveFolder():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());

            const created0 = await opfs.createFolder(new FolderPath("/foo/"));
            this.assertTrue(created0, {id:"createFolder"});

            const created1 = await opfs.createFolder(new FolderPath("/foo/foo1/"));
            this.assertTrue(created1, {id:"createFolder"});

            const created2 = await opfs.createFolder(new FolderPath("/foo/foo1/foo2/"));
            this.assertTrue(created2, {id:"createFolder"});

            const created3 = await opfs.createFile(new FilePath("/foo/foo1/foo2/bar"));
            this.assertTrue(created3, {id:"createFile"});

            const copied = await this.#moveFolderRecursive(opfs, new FolderPath("/foo/"), new FolderPath("/fooTo/"));
            this.assertTrue(copied, {id:"moveFolder"});

            const exists = await opfs.exists(new FilePath("/fooTo/foo1/foo2/bar"));
            this.assertTrue(exists === "file", {id:"exists 1"});

            const exists2 = await opfs.exists(new FolderPath("/foo/"));
            this.assertTrue(exists2 === false, {id:"exists 2"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }
    
    async FileStorage_moveFile():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());

            const created = await opfs.createFile(new FilePath("/foo"));
            this.assertTrue(created, {id:"createFile"});

            const textToWrite = this._app.textUtil.generate(1024, {secureMode:false}); //1KB
            const dataToWrite = this._app.textUtil.toUint8Array(textToWrite);
            const stream = this._app.streamUtil.fromUint8Array(dataToWrite);

            const set = _.value(await opfs.setFileData(new FilePath("/foo"), new Data(this._app, async () => stream), this), {allowError:true});
            this.assertTrue(set, {id:"setFileData"});

            const created2 = await opfs.createFolder(new FolderPath("/fooTo/"));
            this.assertTrue(created2, {id:"createFile"});

            const moved = await opfs.moveFile(new FilePath("/foo"), new FilePath("/fooTo/fooCopy"), this);
            this.assertTrue(moved, {id:"moveFile"});

            //verify the file data was moved
            const data = _.value(await opfs.getFileData(new FilePath("/fooTo/fooCopy"), this), {allowError:true});
            this.assertTrue(this._app.typeUtil.isError(data) !== true, {id:"getFileData"});

            const stream2 = _.value(await data?.get(), {allowError:true});
            this.assertTrue(this._app.typeUtil.isError(stream2) !== true, {id:"getData"});

            const data2 = this._app.extractOrRethrow(await this._app.streamUtil.toUint8Array(stream2!), [stream2]);

            const readData = this._app.textUtil.fromUint8Array(data2);

            this.assertTrue(readData === textToWrite, {id:"setFileData"});

            const exists = await opfs.exists(new FilePath("/fooTo/fooCopy"));
            this.assertTrue(exists === "file", {id:"exists"});

            const exists2 = await opfs.exists(new FilePath("/foo"));
            this.assertTrue(exists2 === false, {id:"exists"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }
    
    async FileStorage_deleteFolder():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());

            //test folder deletion
            const created2 = await opfs.createFolder(new FolderPath("/foo/"));
            this.assertTrue(created2, {id:"createFolder"});

            const deleted2 = await opfs.deleteFolder(new FolderPath("/foo/"), this);
            this.assertTrue(deleted2, {id:"delete"});
            
            const exists2 = await opfs.exists(new FolderPath("/foo/"));
            this.assertTrue(exists2 === false, {id:"exists"});

            //test folder deletion with files
            const created3 = await opfs.createFolder(new FolderPath("/foo/"));
            this.assertTrue(created3, {id:"createFolder"});

            const created4 = await opfs.createFile(new FilePath("/foo/bar"));
            this.assertTrue(created4, {id:"createFile"});

            const deleted3 = await this.#deleteFolderRecursive(opfs, new FolderPath("/foo/"));
            this.assertTrue(deleted3, {id:"delete"});
     
            const exists3 = await opfs.exists(new FolderPath("/foo/"));
            this.assertTrue(exists3 === false, {id:"exists"});
            

            //test folder deletion with files and folders
            const created5 = await opfs.createFolder(new FolderPath("/foo/"));
            this.assertTrue(created5, {id:"createFolder"});

            const created6 = await opfs.createFolder(new FolderPath("/foo/bar/"));
            this.assertTrue(created6, {id:"createFolder"});

            const created7 = await opfs.createFile(new FilePath("/foo/bar/baz"));
            this.assertTrue(created7, {id:"createFile"});

            const deleted4 = await this.#deleteFolderRecursive(opfs, new FolderPath("/foo/"));
            this.assertTrue(deleted4, {id:"delete"});

            const exists4 = await opfs.exists(new FolderPath("/foo/"));
            this.assertTrue(exists4 === false, {id:"exists"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }

    #deleteFolderRecursive = async (opfs:IFileStorage<A>, path:FolderPath):Promise<boolean> =>
    {
        const exists = await opfs.exists(path);
        if (exists === false) return true;

        for await (const item of opfs.listFolder(path, this)) 
        {
            let success;
            if (item.type === "file") success = await opfs.deleteFile(new FilePath(`${path.toString()}${item.name}`), this);
            else success = await this.#deleteFolderRecursive(opfs, new FolderPath(`${path.toString()}${item.name}/`));

            if (success === false) return false;
        }

        return await opfs.deleteFolder(path, this);
    }

    #copyFolderRecursive = async (opfs:IFileStorage<A>, fromPath:FolderPath, toPath:FolderPath):Promise<boolean> =>
    {
        const exists = await opfs.exists(toPath);
        if (exists === "folder") return false;

        const created = await opfs.createFolder(toPath);
        if (created === false) return false;

        for await (const item of opfs.listFolder(fromPath, this)) 
        {
            let success;
            if (item.type === "file") success = await opfs.copyFile(new FilePath(`${fromPath.toString()}${item.name}`), new FilePath(`${toPath.toString()}${item.name}`), this);
            else success = await this.#copyFolderRecursive(opfs, new FolderPath(`${fromPath.toString()}${item.name}/`), new FolderPath(`${toPath.toString()}${item.name}/`));

            if (success === false) return false;
        }

        return true;
    }

    #moveFolderRecursive = async (opfs:IFileStorage<A>, fromPath:FolderPath, toPath:FolderPath):Promise<boolean> =>
    {
        const exists = await opfs.exists(toPath);
        if (exists === "folder") return false;

        const created = await opfs.createFolder(toPath);
        if (created === false) return false;

        for await (const item of opfs.listFolder(fromPath, this)) 
        {
            let success;
            if (item.type === "file") success = await opfs.moveFile(new FilePath(`${fromPath.toString()}${item.name}`), new FilePath(`${toPath.toString()}${item.name}`), this);
            else success = await this.#moveFolderRecursive(opfs, new FolderPath(`${fromPath.toString()}${item.name}/`), new FolderPath(`${toPath.toString()}${item.name}/`));

            if (success === false) return false;
        }

        return await opfs.deleteFolder(fromPath, this);
    }
    
    async FileStorage_listFolder():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());

            const created = await opfs.createFolder(new FolderPath("/foo/"));
            this.assertTrue(created, {id:"createFolder 1"});

            const created1 = await opfs.createFolder(new FolderPath("/foo/foo1/"));
            this.assertTrue(created1, {id:"createFolder 2"});

            const created2 = await opfs.createFolder(new FolderPath("/foo/foo1/foo2/"));
            this.assertTrue(created2, {id:"createFolder 3"});

            const created3 = await opfs.createFile(new FilePath("/foo/foo1/foo2/bar"));
            this.assertTrue(created3, {id:"createFile 4"});

            const list = [];
            for await (const metadata of opfs.listFolder(new FolderPath("/foo/foo1/foo2/"), this)) list.push(metadata);
            this.assertTrue(list.length === 1, {id:"listFolder"});
            this.assertTrue(list[0].name === "bar" && list[0].type === 'file', {id:"listFolder"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }
    
    async FileStorage_clear():Promise<void>
    {
        const _ = this.abortableHelper.throwIfAborted();

        let opfs:IFileStorage<A> | undefined;

        try
        {
            opfs = _.value(await this.createFileStorage());

            const created = await opfs.createFolder(new FolderPath("/foo/"));
            this.assertTrue(created, {id:"createFolder 1"});

            const created1 = await opfs.createFolder(new FolderPath("/foo/foo1/"));
            this.assertTrue(created1, {id:"createFolder 2"});

            const created2 = await opfs.createFolder(new FolderPath("/foo/foo1/foo2/"));
            this.assertTrue(created2, {id:"createFolder 3"});

            const created3 = await opfs.createFile(new FilePath("/foo/foo1/foo2/bar"));
            this.assertTrue(created3, {id:"createFile"});

            const cleared = await opfs.clear(this);
            this.assertTrue(cleared, {id:"clear"});

            const exists = await opfs.exists(new FolderPath("/foo/"));
            this.assertTrue(exists === false, {id:"exists"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }

    async FileStorage_renameFile():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());
            
            const created = await opfs.createFile(new FilePath("/foo"));
            this.assertTrue(created, {id:"createFile"});

            const renamed = await opfs.renameFile(new FilePath("/foo"), "bar", this);
            this.assertTrue(renamed, {id:"renameFile"});

            const exists = await opfs.exists(new FilePath("/foo"));
            this.assertTrue(exists === false, {id:"exists 1"});

            const exists2 = await opfs.exists(new FilePath("/bar"));
            this.assertTrue(exists2 === "file", {id:"exists 2"}); 
        }
        finally
        {
            await opfs?.clear(this);
        }
    }

    async FileStorage_renameFolder():Promise<void>
    {
        let opfs:IFileStorage<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            opfs = _.value(await this.createFileStorage());
            
            const created = await opfs.createFolder(new FolderPath("/foo/"));
            this.assertTrue(created, {id:"createFolder"});

            const created1 = await opfs.createFolder(new FolderPath("/foo/foo1/"));
            this.assertTrue(created1, {id:"createFolder"});

            const created2 = await opfs.createFile(new FilePath("/foo/foo1/foo2"));
            this.assertTrue(created2, {id:"createFile"});

            const renamed = await opfs.renameFolder(new FolderPath("/foo/"), "bar", this);
            this.assertTrue(renamed, {id:"renameFolder"});

            const exists = await opfs.exists(new FolderPath("/foo/"));
            this.assertTrue(exists === false, {id:"exists 1"});

            const exists2 = await opfs.exists(new FolderPath("/bar/"));
            this.assertTrue(exists2 === "folder", {id:"exists 2"});
        }
        finally
        {
            await opfs?.clear(this);
        }
    }
    
    protected async createFileStorage():Promise<IFileStorage<A> | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const hkdfKey = await this._app.keyUtil.import(this._app.hashUtil.generate(512, HashOutputFormat.hex), KeyType.HKDF);
            const storage = new FileStorage(this._app, hkdfKey, async (app:A, _fileStorage:IFileStorage<A>, rootFolderPath:FolderPath):Promise<IFileStorageAdapter<A> | IAborted | IError> => 
            { 
                try
                {
                    const adapter = new OPFSFileStorageAdapter(app, new FolderPath('/test/').getSubFolder(rootFolderPath));
                    _.check(await adapter.init());

                    return adapter;
                }
                catch (error)
                {
                    return this._app.warn(error, 'Failed to create file storage adapter', [], {names:[this.constructor, this.createFileStorage]})
                }
            });
            _.check(await storage.init());

            return storage;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to create file storage', [], {names:[this.constructor, this.createFileStorage]})
        }
    }
}