/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import path from 'path';
import fs from 'fs-extra';
import { ReadableStream } from 'stream/web';
import { Paths } from '../../../../shared/src/app/Paths.ts';
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { filepath, folderpath, FolderPath } from '../../../../../../shared/src/library/file/Path.ts';
import type { IError } from '../../../../../../shared/src/library/error/IError.ts';
import { Data } from '../../../../../../shared/src/library/data/Data.ts';
import type { IAbortable } from '../../../../../../shared/src/library/abort/IAbortable.ts';
import type { IAborted } from '../../../../../../shared/src/library/abort/IAborted.ts';
import { AbortableHelper } from '../../../../../../shared/src/library/helpers/AbortableHelper.ts';
import type { IApp } from '../../IApp.ts';
import type { IDatable } from '../../../../../../shared/src/library/data/IDatable.ts';

@SealedDecorator()
export class RemoteFileSystem
{
    #_app:IApp;

    #_basePath!:FolderPath;

    constructor(basePath:Paths); //we don't actually use this overload. it is here for the web renderer process (see AppAPI.ts)
    constructor(app:IApp, basePath:Paths);
    constructor(...args:any[])
    {
        const [app, basePath] = args as [IApp, Paths];

        this.#_app = app;
        
        if (basePath === Paths.data) this.#_basePath = app.dataPath;
        else app.throw('invalid base path', [], {correctable:true});
    }

    public async createFolder(folderPath:folderpath):Promise<true | IError>
    {
        try
        {
            folderPath = this.#resolve(folderPath); //very important!
            
            await fs.ensureDir(folderPath);

            return true;
        }
        catch (error)
        {
            return this.#_app.warn(error, 'could not create folder, {}', arguments, {errorOnly:true, names:[RemoteFileSystem, this.createFolder]});
        }
    };

    public async exists(fileOrFolderPath:folderpath | filepath):Promise<false | 'file' | 'folder' | IError>
    {
        try 
        {
            fileOrFolderPath = this.#resolve(fileOrFolderPath); //very important!

            const exists = await fs.pathExists(fileOrFolderPath).catch(() => false);
        
            if (exists === false) return false;

            const stats = await fs.lstat(fileOrFolderPath);
    
            if (stats.isDirectory() === true) return 'folder';

            return 'file';
        } 
        catch (error) 
        {
            return this.#_app.warn(error, 'could not check if file or folder exists, {}', arguments, {errorOnly:true, names:[RemoteFileSystem, this.exists]});
        }
    };

    public async createFile(filePath:filepath):Promise<true | IError>
    {
        try
        {
            const handle = this.#resolve(filePath); //very important!

            await fs.ensureFile(handle);

            return true;
        }
        catch (error)
        {
            return this.#_app.warn(error, 'could not create file, {}', arguments, {errorOnly:true, names:[RemoteFileSystem, this.createFile]});
        }
    };

    public async hasFileData(path:filepath):Promise<boolean | IError>
    {
        try
        {
            const handle = this.#resolve(path); //very important!

            const stats = await fs.stat(handle);

            return stats.size > 0;
        }
        catch (error)
        {
            return this.#_app.warn(error, 'could not check if file has data, {}', arguments, {errorOnly:true, names:[RemoteFileSystem, this.hasFileData]});
        }
    }

    public async getFileData(filePath:filepath, abortable:IAbortable):Promise<IDatable<ReadableStream<Uint8Array>> | IAborted | IError>
    {
        try
        {
            const handle = this.#resolve(filePath); //very important!

            return new Data(this.#_app, async () => 
            {
                try
                {
                    if (abortable.aborted === true) return abortable as IAborted;

                    const nodeStream = fs.createReadStream(handle);

                    const stream = new ReadableStream(
                    {
                        start(controller) 
                        {
                            nodeStream.on('data', (chunk:Buffer) => 
                            {
                                if (abortable.aborted === true)
                                {
                                    controller.error(abortable);
                                    nodeStream.close();
                                    return;
                                }

                                controller.enqueue(new Uint8Array(chunk));
                            });
                            nodeStream.on('end', () => 
                            {
                                controller.close();
                            });
                            nodeStream.on('error', (err) => 
                            {
                                controller.error(err);
                            });
                        }
                    });

                    return stream;
                }
                catch (error)
                {
                    return this.#_app.warn(error, 'could not get file data, {}', arguments, {names:[RemoteFileSystem, this.getFileData]});
                }
            });
        }
        catch (error)
        {
            return this.#_app.warn(error, 'could not get file data, {}', arguments, {names:[RemoteFileSystem, this.getFileData]});
        }
    }

    public async setFileData(filePath:filepath, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        let fileStream:fs.WriteStream | undefined;
        let reader:ReadableStreamDefaultReader<Uint8Array> | undefined;

        try
        {
            const _ = new AbortableHelper(this.#_app, abortable).throwIfAborted();

            const handle = this.#resolve(filePath); //very important!

            const stream = _.value(await data.get());

            fileStream = fs.createWriteStream(handle);

            reader = stream.getReader();

            while (true)
            {
                const {done, value} = _.value(await reader.read());

                if (done === true) break;
                if (value === undefined) continue;

                if (fileStream.write(value) === false) _.check(await new Promise(resolve => fileStream?.once('drain', resolve)));
            }

            return true;
        }
        catch (error)
        {
            return this.#_app.warn(error, 'could not set file data, {}', arguments, {names:[RemoteFileSystem, this.setFileData]});
        }
        finally
        {
            fileStream?.end();
            reader?.releaseLock();

            fileStream = undefined;
            reader = undefined;
        }
    }

    public async renameFolder(folderPath:folderpath, name:string):Promise<true | IError>
    {
        try
        {
            folderPath = this.#resolve(folderPath); //very important!

            let newFolderPath = path.join(path.dirname(folderPath), name) as folderpath;

            newFolderPath = this.#resolve(newFolderPath); //very important!

            await fs.rename(folderPath, newFolderPath);

            return true;
        }
        catch (error)
        {
            return this.#_app.warn(error, 'could not rename folder, {}', arguments, {errorOnly:true, names:[RemoteFileSystem, this.renameFolder]});
        }
    }

    public async renameFile(filePath:filepath, name:string):Promise<true | IError>
    {
        try
        {
            filePath = this.#resolve(filePath); //very important!

            let newFilePath = path.join(path.dirname(filePath), name) as filepath;

            newFilePath = this.#resolve(newFilePath); //very important!

            await fs.rename(filePath, newFilePath);

            return true;
        }
        catch (error)
        {
            return this.#_app.warn(error, 'could not rename file, {}', arguments, {errorOnly:true, names:[RemoteFileSystem, this.renameFile]});
        }
    }

    public async listFolder(folderPath:folderpath, abortable:IAbortable):Promise<AsyncGenerator<{name:string, type:'file' | 'folder'} | IAborted | IError> | IError>
    {
        const ref = this;
        
        return (async function* (folderPath:folderpath):AsyncGenerator<{name:string, type:'file' | 'folder'} | IAborted | IError>
        {
            try
            {
                const _ = new AbortableHelper(ref.#_app, abortable).throwIfAborted();

                folderPath = ref.#resolve(folderPath); //very important!

                const dirents = _.value(await fs.readdir(folderPath, {withFileTypes:true}));

                for (const dirent of dirents)
                {
                    if (dirent.name.startsWith('.') === true) continue;

                    if (dirent.isDirectory() === true) _.check(yield {name:dirent.name, type:'folder'});
                    else _.check(yield {name:dirent.name, type:'file'}); 
                }
            }
            catch (error)
            {
                yield ref.#_app.warn(error, 'could not list folder, {}', arguments, {names:[RemoteFileSystem, ref.listFolder]});
            }
        })(folderPath);
    }

    public async deleteFolder(folderPath:folderpath, options?:{isOkayIfNotExists?:boolean}):Promise<true | IError>
    {
        try
        {
            folderPath = this.#resolve(folderPath); //very important!

            await fs.remove(folderPath);

            return true;
        }
        catch (error)
        {
            return options?.isOkayIfNotExists === true ? true : this.#_app.warn(error, 'could not delete folder, {}', arguments, {errorOnly:true, names:[RemoteFileSystem, this.deleteFolder]});
        }
    }

    public async deleteFile(filePath:filepath, options?:{isOkayIfNotExists?:boolean}):Promise<true | IError>
    {
        try
        {
            filePath = this.#resolve(filePath); //very important!

            await fs.remove(filePath);

            return true;
        }
        catch (error)
        {
            return options?.isOkayIfNotExists === true ? true : this.#_app.warn(error, 'could not delete file, {}', arguments, {errorOnly:true, names:[RemoteFileSystem, this.deleteFile]});
        }
    }

    /*
    writeFile = async (file:string, buffer:Buffer):Promise<true | ErrorJSONObject> => 
    {
        await fs.ensureDir(path.dirname(file));

        await fs.writeFile(file, buffer, {encoding:"binary"});

        const result = await fs.exists(file);
        if (!result) return new ErrorJSONObject(ErrorCode.MAIN_UNRECOVERABLE, 'could not create file: ' + file);

        return true;
    };

    readFile = async (file:string):Promise<Buffer | ErrorJSONObject> => 
    {
        const result = await fs.exists(file);
        if (!result) return new ErrorJSONObject(ErrorCode.MAIN_UNRECOVERABLE, 'file does not exist');

        return fs.readFile(file);
    };

    readJSONFile = async <T>(file:string):Promise<T | ErrorJSONObject> => 
    {
        const result = await fs.exists(file);
        if (!result) return new ErrorJSONObject(ErrorCode.MAIN_UNRECOVERABLE, 'file does not exist');

        return fs.readJSON(file);
    };

    getFileInfo = async (file:string):Promise<{bytes:number} | ErrorJSONObject> => 
    {
        const result = await fs.exists(file);
        if (!result) return new ErrorJSONObject(ErrorCode.MAIN_UNRECOVERABLE, 'file does not exist');

        const stat = await fs.stat(file);

        return {bytes:stat.size};
    };
    */

    #resolve = <T extends folderpath | filepath>(pathString:T):T =>
    {
        const basePath = this.#_basePath.toString();

        //if the path is root, return the base path
        if (pathString === '/') return basePath as T;
    
        //resolve the provided path with the base path
        let resolvedPathString = path.resolve(basePath, `./${pathString}`);

        //if the path is a folder, make sure it ends with a '/', as our folderpath type is supposed to always end with a '/'
        if (resolvedPathString !== '/' && pathString.endsWith('/') === true) resolvedPathString = resolvedPathString + '/';

        //ensure they cannot escape the root folder
        if (resolvedPathString.startsWith(basePath) !== true) this.#_app.throw('path is not within root folder', [pathString]);

        return resolvedPathString as T;
    }
}