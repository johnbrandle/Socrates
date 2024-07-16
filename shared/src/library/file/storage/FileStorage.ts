/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { AbortController } from "../../abort/AbortController";
import { type IAbortable } from "../../abort/IAbortable";
import { Data } from "../../data/Data";
import type { IAbortController } from "../../abort/IAbortController";
import { WeakValueMap } from "../../weak/WeakValueMap";
import { type Turn, Turner } from "../../basic/Turner";
import { IFileStorageType, type IFileInfo, type IFileStorage, type IFolderInfo } from "./IFileStorage";
import { ResolvePromise } from "../../promise/ResolvePromise";
import { KeyType, type CRYPTKey, type HKDFKey, type HMACKey } from "../../utils/KeyUtil";
import type { IFileStorageAdapter } from "./adapters/IFileStorageAdapter";
import { AbortableEntity } from "../../entity/AbortableEntity";
import { type IAborted } from "../../abort/IAborted";
import { filepath, FilePath, folderpath, FolderPath } from "../Path";
import { IBaseApp } from "../../IBaseApp";
import { HashOutputFormat, HashType, hex_128, Hex_256, hex_512 } from "../../utils/HashUtil";
import { IError } from "../../error/IError";
import { HMACOutputFormat } from "../../utils/HMACUtil";
import { CharSet } from "../../utils/BaseUtil";
import { json } from "../../utils/JSONUtil";
import type { CRYPT, CRYPT_StreamHeader } from "../../utils/CryptUtil";
import { ImplementsDecorator } from "../../decorators/ImplementsDecorator";
import { uint } from "../../utils/IntegerUtil";
import { IDatable } from "../../data/IDatable";

type FolderPathSet = {hashed:FolderPath, unhashed:FolderPath, filePathSet:FilePathSet, toString:() => string};
type FilePathSet = {hashed:FilePath, unhashed:FilePath, toString:() => string};


/**
 * files will be stored as follows:
 * 
 * /encrypted_name.file (will contain the metadata for the file)
 * the file metadata will contain a random 32 byte id, which will be used to name the data file
 * 
 * file data will be stored in a seperate file, with the id defined in the file's metadata. Its location will be based on the first 4 characters
 * of the id.
 *
 * /data/encrypted__id_first_letter/encrypted__id_second_letter/encrypted__id_third_letter/encrypted__id_fourth_letter/encrypted_id.data
 *
 * File data will be encrypted using AES-CTR with a random 32 byte salt:
 * [32 bytes salt][file data][32 bytes hmac]
 * 
 * The reason for storing file data in a separate location is so that one cannot guess what data file is associated with a given metadata file. This
 * would make it extremely difficult, if not impossible, to guess the contents of a folder based on the size of the data files. For instance, suppose a folder contains 1000 files, and
 * this is being shared. If the attacker knew the unencrypted sizes of each file, they could guess the contents of the encrypted folder based on the size of the
 * data files. By storing the data files in a separate location, this is not possible.
 * 
 * folders will be stored as follows:
 * 
 * /encrypted_name (will be the folder)
 * /encrypted_name.folder (will contain the metadata for the folder)
 * 
 * The only thing we are really giving away here is the number of files in a folder, but this is not a big deal.
 * 
 * Suppose a data file became orphaned. How would one detect that? During a export/backup operations we can open each metadata file and keep track of the ids. If we find
 * a data file that is not associated with a metadata file, we can delete it. 
 * 
 */

@ImplementsDecorator(IFileStorageType)
export class FileStorage<A extends IBaseApp<A>> extends AbortableEntity<A> implements IFileStorage<A> 
{
    #_rootFolderPath!:FolderPath;

    #_treeFS!:IFileStorageAdapter<A>;
    #_lookupFS!:IFileStorageAdapter<A>;

    #_config = this._app.configUtil.get(true).classes.FileStorageAdapter;

    #_cryptKey!:CRYPTKey;

    protected _hkdfKey:HKDFKey;

    protected _hmacKey!:HMACKey<HashType.SHA_256>;

    protected _createStorageAdapter:(app:A, fileStorage:IFileStorage<A>, rootFolderPath:FolderPath) => Promise<IFileStorageAdapter<A> | IAborted | IError>;

    constructor(app:A, hkdfKey:HKDFKey, createStorageAdapter:(app:A, fileStorage:IFileStorage<A>, rootFolderPath:FolderPath) => Promise<IFileStorageAdapter<A> | IAborted | IError>) 
    {
        super(app);

        this._hkdfKey = hkdfKey;
        this._createStorageAdapter = createStorageAdapter;
    }

    public async init():Promise<true | IAborted | IError>
    {    
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            let data:{hmacKey:hex_512, cryptKey:hex_512};

            //phase 1: create the root directory and the keys file, with the given hkdf key
            {
                const hkdfKey = this._hkdfKey;

                //derive a crypt key tied to the hkdf key
                const cryptKeyPromise = this._app.keyUtil.derive(hkdfKey, this.#_config.frozen.cryptLabel_hex_128 as hex_128, KeyType.CRYPT);

                //derive the hmac key
                const hmacKeyPromise = this._app.keyUtil.derive(hkdfKey, this.#_config.frozen.hmacLabel_hex_128 as hex_128, KeyType.HMAC, HashType.SHA_256);

                const [cryptKey, hmacKey] = _.value(await Promise.all([cryptKeyPromise, hmacKeyPromise]));

                //derive the root directory name
                const hexName = _.value(await this._app.hmacUtil.derive(hmacKey, this._app.hmacUtil.derivePAE([this._app.textUtil.toUint8Array('root')]), HMACOutputFormat.Hex));
                const rootDirectoryName = this._app.baseUtil.toBase32(hexName.slice(0, 20), CharSet.Base32_Custom);

                //create the root fs
                const rootFolderPath = this.#_rootFolderPath = new FolderPath(`/${rootDirectoryName}/`);
                const rootFS = _.value(await this._createStorageAdapter(this._app, this, rootFolderPath));

                //so, we create a metadata file which will contain the uid of the crypto keys we will use for encryption/decryption
                //this way if the hkdf key or uid changes, we only need to re-encrypt the metadata file and rename the root directory
                const keysFilePath = new FilePath(`/keys`);
                const keysFilePathSet = _.value(await this.#resolve(keysFilePath, {hmacKey}));
                const exists = _.value(await rootFS.exists(keysFilePathSet.hashed));

                //create the keys file if it doesn't exist
                if (exists === false)
                {
                    const success = _.value(await rootFS.createFile(keysFilePathSet.hashed));
                    if (success !== true) this._app.throw('Failed to create keys file', []);
                 
                    data =
                    {
                        hmacKey:this._app.hashUtil.generate(512, HashOutputFormat.hex),
                        cryptKey:this._app.hashUtil.generate(512, HashOutputFormat.hex),
                    } as typeof data;

                    const uint8Array = this._app.textUtil.toUint8Array(this._app.jsonUtil.stringify(data));
                    _.check(await this.#encrypt<CRYPT<Uint8Array>>(keysFilePathSet, uint8Array, {fsRoot:rootFS, cryptKey}));
                }
                else
                {
                    //decrypt the keys file
                    const decrypted = _.value(await this.#decrypt(keysFilePathSet, {fsRoot:rootFS, cryptKey}));

                    const json = this._app.textUtil.fromUint8Array<json>(decrypted);
                    const object = this._app.extractOrRethrow(this._app.jsonUtil.parse<typeof data>(json));

                    data = object;
                }
            }

            //phase 2: create the lookup and tree opfs, using our agnostic keys
            {
                const rootFolderPath = this.#_rootFolderPath;

                //derive the key we will use for hashing
                const hmacKeyPromise = this._app.keyUtil.import(data.hmacKey, KeyType.HMAC, HashType.SHA_256);

                //derive the key we will use for encryption/decryption
                const cryptKeyPromise = this._app.keyUtil.import(data.cryptKey, KeyType.CRYPT);

                [this._hmacKey, this.#_cryptKey] = _.value(await Promise.all([hmacKeyPromise, cryptKeyPromise]));

                const [hashedLookupName, hashedTreeName] = _.values(await Promise.all([this.hashName('lookup'), this.hashName('tree')]));

                //create lookup and tree fs
                [this.#_lookupFS, this.#_treeFS] = _.values(await Promise.all([this._createStorageAdapter(this._app, this, rootFolderPath.getSubFolder(hashedLookupName)), this._createStorageAdapter(this._app, this, rootFolderPath.getSubFolder(hashedTreeName))]));

                return true;
            }
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to initialize file storage', arguments, {names:[this.constructor, this.init]});
        }
    }

    public async exists(fileOrFolderPath:FolderPath | FilePath):Promise<false | 'file' | 'folder' | IAborted | IError>
    {
        let turn:Turn<A> | undefined;
        
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            turn = _.value(await this.#getTurn(fileOrFolderPath, true));

            const fileOrFolderPathSet = _.value(await this.#resolve(fileOrFolderPath));

            return _.value(await this.#exists(fileOrFolderPathSet));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to check if file or folder exists', arguments, {names:[this.constructor, this.exists]});
        }
        finally
        {
            turn?.end();
        }
    }
    public async existsFile(path:FilePath):Promise<boolean | IError>
    {
        return this.abortableHelper.value(await this.exists(path)) === 'file';
    }
    public async existsFolder(path:FolderPath):Promise<boolean | IError>
    {
        return this.abortableHelper.value(await this.exists(path)) === 'folder';
    }    
    
    async #exists(handle:FolderPathSet | FilePathSet):Promise<false | 'file' | 'folder' | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            return _.value(await this.#_treeFS.exists(handle.hashed));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to check if file or folder exists', arguments, {names:[this.constructor, this.#exists]});
        }
    }

    public async createFolder<T extends JsonObject>(folderPath:FolderPath, options?:{metadata?:T}):Promise<true | IAborted | IError>
    {
        let turn:Turn<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            turn = _.value(await this.#getTurn(folderPath, false));

            const folderPathSet = _.value(await this.#resolve(folderPath));

            const result = _.value(await this.#exists(folderPathSet));
            if (result !== false) this._app.throw('File or folder already exists at path', []);

            return _.value(await this.#createFolder(folderPathSet, options));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to create folder', arguments, {names:[this.constructor, this.createFolder]});
        }
        finally
        {
            turn?.end();
        }
    }
    async #createFolder<T extends JsonObject>(folderPathSet:FolderPathSet, options?:{metadata?:T, info?:IFolderInfo}):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const promises = [];

            //create the folder
            promises.push(this.#_treeFS.createFolder(folderPathSet.hashed));

            //create the associated metadata file
            promises.push(this.#_treeFS.createFile(folderPathSet.filePathSet.hashed));

            //create one of the names files
            promises.push(this.#createNamesFile(folderPathSet));

            //create the other names file
            promises.push(this.#createNamesFile(folderPathSet.filePathSet));
            
            let success:true | IAborted | IError;

            const results = _.values(await Promise.all(promises).catch(error => [this._app.warn(error, 'Failed to resolve promises', [], {names:[this.constructor, this.#createFolder]})]), {extract:true});

            if (this._app.typeUtil.isArray(results) === true)
            {
                const info = options?.info ?? 
                {
                    name:folderPathSet.unhashed.name, 
                    path:'' as folderpath, //will be set on the info object when we get it
                    type:'folder',
                    created:Date.now(), 
                    modified:Date.now(), 
                    accessed:Date.now(), 
                    metadata:options?.metadata ?? {},
                };

                success = _.value(await this.#setInfo(folderPathSet.filePathSet, info));
            }
            else success = results;

            //attempt to clean up if we failed to set the info
            if (success !== true) 
            {
                promises.length = 0;
                promises.push(this.#_treeFS.deleteFolder(folderPathSet.hashed));
                promises.push(this.#_treeFS.deleteFile(folderPathSet.filePathSet.hashed));

                _.check(await Promise.all(promises).catch(() => {}));

                return this._app.extractOrRethrow(success);
            }
            
            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to create folder', arguments, {names:[this.constructor, this.#createFolder]});
        }
    }

    public async createFile<T extends JsonObject>(filePath:FilePath, options?:{metadata?:T}):Promise<true | IAborted | IError>
    {
        let turn:Turn<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            turn = _.value(await this.#getTurn(filePath, false));

            const filePathSet = _.value(await this.#resolve(filePath));

            const result = _.value(await this.#exists(filePathSet));
            if (result !== false) return this._app.throw('File or folder already exists at path', []);

            return _.value(await this.#createFile(filePathSet, options));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to create file', arguments, {names:[this.constructor, this.createFile]});
        }
        finally
        {
            turn?.end();
        }
    }
    async #createFile<T extends JsonObject>(filePathSet:FilePathSet, options?:{metadata?:T, info?:IFileInfo}):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const promises = [this.#_treeFS.createFile(filePathSet.hashed), this.#createNamesFile(filePathSet)];

            let success:true | IAborted | IError;

            const results = _.values(await Promise.all(promises).catch(error => [this._app.warn(error, 'Failed to resolve promises', [], {names:[this.constructor, this.#createFile]})]), {extract:true});

            const info = options?.info ??
            {
                name:filePathSet.unhashed.name, 
                extension:filePathSet.unhashed.extension,
                path:'' as filepath, //will be set on the info object when we get it
                type:'file',
                created:Date.now(), 
                modified:Date.now(), 
                accessed:Date.now(), 
                data:
                {
                    uid:this._app.uidUtil.generate(), 
                    bytes:
                    {
                        decrypted:0, 
                        encrypted:0
                    },
                    chunks:0,
                    format:0,
                    metadata:{},
                }, 
                metadata:options?.metadata ?? {}
            };
    
            if (this._app.typeUtil.isArray(results) === true) success = _.value(await this.#setInfo(filePathSet, info));
            else success = results;
            
            //attempt to clean up if we failed to set the info
            if (success !== true) 
            {
                _.check(await this.#_treeFS.deleteFile(filePathSet.hashed).catch(() => {}));
                
                return this._app.extractOrRethrow(success);
            }

            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to create file', arguments, {names:[this.constructor, this.#createFile]});
        }
    }

    public async getFileInfo<T extends IFileInfo>(filePath:FilePath):Promise<T | IAborted | IError>
    {
        let turn:Turn<A> | undefined;
        
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            turn = _.value(await this.#getTurn(filePath, true));

            const filePathSet = _.value(await this.#resolve(filePath));

            return _.value(await this.#getInfo<T>(filePathSet));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get file info', arguments, {names:[this.constructor, this.getFileInfo]});
        }
        finally
        {
            turn?.end();
        }
    }

    public async getFolderInfo<T extends IFolderInfo>(folderPath:FolderPath):Promise<T | IAborted | IError>
    {
        let turn:Turn<A> | undefined;
        
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            turn = _.value(await this.#getTurn(folderPath, true));

            const folderPathSet = _.value(await this.#resolve(folderPath));

            return _.value(await this.#getInfo<T>(folderPathSet.filePathSet));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get folder info', arguments, {names:[this.constructor, this.getFolderInfo]});
        }
        finally
        {
            turn?.end();
        }
    }

    async #getInfo<T extends IFileInfo | IFolderInfo>(filePathSet:FilePathSet):Promise<T | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const decrypted = _.value(await this.#decrypt(filePathSet));

            const json = this._app.textUtil.fromUint8Array<json>(decrypted);
            const info = this._app.extractOrRethrow(this._app.jsonUtil.parse<T>(json));

            if (this._app.stringUtil.isEmpty(info.name) === true) return info; //this is the root, so we don't need to set the path

            //set the path
            const parent = filePathSet.unhashed.parent!.toString();
            if (this._app.stringUtil.isEmpty(parent) === true) info.path = `/${info.name}` as folderpath | filepath;
            else
            {
                if (info.type === 'file') info.path = new FolderPath(parent).getSubFile(info.name).toString();
                else info.path = new FolderPath(parent).getSubFolder(info.name).toString();
            }

            return info;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get info', arguments, {names:[this.constructor, this.#getInfo]});
        }
    }

    public async setFileMetadata<T extends JsonObject>(filePath:FilePath, metadata:T):Promise<true | IAborted | IError>
    {
        let turn:Turn<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            turn = _.value(await this.#getTurn(filePath, false));

            const filePathSet = _.value(await this.#resolve(filePath));

            const info = _.value(await this.#getInfo(filePathSet));

            info.metadata = metadata ?? {};

            return _.value(await this.#setInfo(filePathSet, info));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to set file metadata', arguments, {names:[this.constructor, this.setFileMetadata]});
        }
        finally
        {
            turn?.end();
        }
    }

    public async setFolderMetadata<T extends JsonObject>(folderPath:FolderPath, metadata:T):Promise<true | IAborted | IError>
    {
        let turn:Turn<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            turn = _.value(await this.#getTurn(folderPath, false));

            const folderPathSet = _.value(await this.#resolve(folderPath));

            const info = _.value(await this.#getInfo(folderPathSet.filePathSet));

            info.metadata = metadata ?? {};

            return _.value(await this.#setInfo(folderPathSet.filePathSet, info));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to set folder metadata', arguments, {names:[this.constructor, this.setFolderMetadata]});
        }
        finally
        {
            turn?.end();
        }
    }

    async #setInfo<T extends IFileInfo | IFolderInfo>(filePathSet:FilePathSet, info:T):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const data = this._app.textUtil.toUint8Array(this._app.jsonUtil.stringify(info));

            _.check(await this.#encrypt(filePathSet, data));
            
            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to set info', arguments, {names:[this.constructor, this.#setInfo]});
        }
    }

    public async hasFileData(path:FilePath):Promise<boolean | IAborted | IError>
    {
        let turn:Turn<A> | undefined;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            turn = _.value(await this.#getTurn(path, true));

            const filePathSet = _.value(await this.#resolve(path));

            const info = _.value(await this.#getInfo<IFileInfo>(filePathSet));

            return info.data.bytes.encrypted > 0;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to check if file has data', arguments, {names:[this.constructor, this.hasFileData]});
        }
        finally
        {
            turn?.end();
        }
    }
    
    public async getFileData(filePath:FilePath, abortable:IAbortable):Promise<IDatable<ReadableStream<Uint8Array>>>
    {
        const app = this._app;

        return new Data(app, async () => 
        {
            let turn:Turn<A> | undefined;

            try
            {     
                const abortController = new AbortController(app, [this, abortable]);

                const _ = this.createAbortableHelper(abortController).throwIfAborted();

                turn = _.value(await this.#getTurn(filePath, true));

                const filePathSet = _.value(await this.#resolve(filePath));
                const info = _.value(await this.#getInfo<IFileInfo>(filePathSet));

                let chunkIndex = 0;

                const fileDataPathSet = _.value(await this.#getFileDataPathSet(info, info.data.chunks, {create:false}));
                const data = _.value(await this.#_lookupFS.getFileData(fileDataPathSet.hashed, abortController));

                let headersStream = _.value(await data.get());

                const decryptTransfomer = app.cryptUtil.createVariableTransformer(this.#_cryptKey, info.data.chunks, info.data.metadata.format as uint);
                headersStream = app.streamUtil.transform(headersStream, [app.streamUtil.createAbortableTransformer(abortController), decryptTransfomer], {allowVariableByteLengthTransformers:true, onEnd:async (success) =>
                {
                    const error = _.error(success);
                    if (error !== undefined) return app.warn(error, 'failed to stream headers for path', [filePath], {names:[this.constructor, this.getFileData]});
                    
                    const aborted = _.aborted(success); 
                    if (aborted !== undefined) return app.abort(aborted, 'failed to read headers for path', [filePath], {names:[this.constructor, this.getFileData]});                    
                }});

                const headers = _.value(await app.streamUtil.toUint8Array<Uint8Array>(headersStream));
  
                const offsets = info.data.metadata.offsets as number[];
                const getHeader = (index:number):CRYPT_StreamHeader =>
                {
                    const start = offsets[index];
                    const end = offsets[index + 1] ?? headers.length;

                    return headers.slice(start, end) as CRYPT_StreamHeader;
                }

                const chunkStreams:Data<A, ReadableStream<Uint8Array>>[] = [];
                while (chunkIndex < info.data.chunks)
                {
                    const eachChunkIndex = chunkIndex;

                    const getChunkStream = new Data(app, async () =>
                    {
                        try
                        {
                            const fileDataPathSet = _.value(await this.#getFileDataPathSet(info, eachChunkIndex, {create:false}));

                            const data = _.value(await this.#_lookupFS.getFileData(fileDataPathSet.hashed, abortController!));

                            let chunkStream = _.value(await data.get());
                            
                            const decryptTransfomer = app.cryptUtil.createTransformer(this.#_cryptKey, eachChunkIndex, getHeader(eachChunkIndex), info.data.format as uint);
                            chunkStream = app.streamUtil.transform(chunkStream, [app.streamUtil.createAbortableTransformer(abortController!), decryptTransfomer], {onEnd:async (success) =>
                            {
                                const error = _.error(success);
                                if (error !== undefined) return app.warn(error, 'failed to stream chunk data for path', [filePath], {names:[this.constructor, this.getFileData]});
                                
                                const aborted = _.aborted(success); 
                                if (aborted !== undefined) return app.abort(aborted, 'failed to stream chunk data for path', [filePath], {names:[this.constructor, this.getFileData]});  
                            }});

                            return chunkStream;
                        }
                        catch (error)
                        {
                            return app.warn(error, 'Failed to get chunk stream for path', arguments, {names:[this.constructor, this.getFileData]});
                        }
                    });

                    chunkStreams.push(getChunkStream);

                    chunkIndex++;
                }

                //we could end the turn once the stream has been consumed, but if we do that, and the stream is not consumed, the turn will never end...
                const stream = app.streamUtil.transform(app.streamUtil.join(chunkStreams), [], {onEnd:async (success) =>
                {
                    const error = _.error(success);
                    if (error !== undefined) return app.warn(error, 'failed to stream file data for path', [filePath], {names:[this.constructor, this.getFileData]});
                    
                    const aborted = _.aborted(success); 
                    if (aborted !== undefined) return app.abort(aborted, 'failed to stream file data for path', [filePath], {names:[this.constructor, this.getFileData]});
                }});

                return stream;
            }
            catch (error)
            {
                return this._app.warn(error, 'Failed to get file data', arguments, {names:[this.constructor, this.getFileData]});
            }
            finally
            {
                turn?.end();
            }
        });
    }

    public async setFileData(filePath:FilePath, data:IDatable<ReadableStream<Uint8Array>>, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        let turn:Turn<A> | undefined;
        
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            turn = _.value(await this.#getTurn(filePath, false));

            const filePathSet = _.value(await this.#resolve(filePath));
            const info = _.value(await this.#getInfo<IFileInfo>(filePathSet));

            return _.value(await this.#setFileData(filePathSet, data, info, abortController));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to set file data', arguments, {names:[this.constructor, this.setFileData]});
        }
        finally
        {
            turn?.end();
        }
    }

    async #setFileData(handle:FilePathSet, data:IDatable<ReadableStream<Uint8Array> | IError>, info:IFileInfo, abortController:IAbortController<A>):Promise<true | IAborted | IError>
    {    
        const app = this._app;
        
        try
        {  
            let partIndex = 0;

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            const stream = _.value(await data.get());
            
            const config = this.#_config.data;

            const encryptedHeaders:CRYPT_StreamHeader[] = [];

            for await (let chunk of app.streamUtil.split(stream, app.integerUtil.generate(config.targetMinChunkSize as uint, config.targetMaxChunkSize as uint)))
            {
                chunk = _.value(chunk);

                const [fileDataPathSet, _created] = _.value(await this.#getFileDataPathSet(info, partIndex, {create:true})); //create the data file handle

                let chunkStream:ReadableStream<Uint8Array> = app.streamUtil.fromUint8Array(chunk);

                const [encryptionTransfomer, encryptionHeaderPromise, format] = app.cryptUtil.createTransformer(this.#_cryptKey, partIndex);
                chunkStream = app.streamUtil.transform(chunkStream, [app.streamUtil.createAbortableTransformer(abortController), encryptionTransfomer]);

                _.check(await this.#_lookupFS.setFileData(fileDataPathSet.hashed, new Data(app, async () => chunkStream), abortController));

                info.data.format = format;

                const encryptedHeader = _.value(await encryptionHeaderPromise);

                encryptedHeaders.push(encryptedHeader);

                const decryptedBytes = chunk.length;
                const encryptedBytes = decryptedBytes + encryptedHeader.length;
                
                info.data.bytes.decrypted += decryptedBytes;
                info.data.bytes.encrypted += encryptedBytes;

                partIndex++;
            }
            _.check(); //check again after the for await loop

            const result1 = _.value(await this.#getFileDataPathSet(info, partIndex, {create:true})); //create the data file handle

            const [fileDataPathSet, _created] = result1;

            let headerStream:ReadableStream<Uint8Array> = app.streamUtil.fromUint8Array(app.byteUtil.concat(encryptedHeaders));

            const [encryptionTransfomer, format] = app.cryptUtil.createVariableTransformer(this.#_cryptKey, partIndex);
            headerStream = app.streamUtil.transform(headerStream, [app.streamUtil.createAbortableTransformer(abortController), encryptionTransfomer], {allowVariableByteLengthTransformers:true});

            const metadata = {offsets:[] as number[], format};
            
            let offset = 0;
            for (const chunk of encryptedHeaders) 
            {
                metadata.offsets.push(offset);
                offset += chunk.length;
            }
            info.data.metadata = metadata;

            _.check(await this.#_lookupFS.setFileData(fileDataPathSet.hashed, new Data(app, async () => headerStream), abortController));
            
            info.data.chunks = partIndex;

            return _.value(await this.#setInfo(handle, info));
        }
        catch (error)
        {
            return app.warn(error, 'Failed to set file data', arguments, {names:[this.constructor, this.#setFileData]});
        }
    }

    async #createNamesFile(fileOrFolderPathSet:FilePathSet | FolderPathSet):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const [fileNamePathSet, created] = _.value(await this.#getFileNamePathSet(fileOrFolderPathSet.hashed.name, {create:true}));

            //the file already exists, so we don't need to do anything
            if (created === false) return true;

            _.check(await this.#encrypt(fileNamePathSet, this._app.textUtil.toUint8Array(fileOrFolderPathSet.unhashed.name), {fsRoot:this.#_lookupFS}));

            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to create names file', arguments, {names:[this.constructor, this.#createNamesFile]});
        }
    }

    async #getUnhashedName(hashedName:string):Promise<string | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const fileNamesPathSet = _.value(await this.#getFileNamePathSet(hashedName, {create:false}));

            const exists = _.value(await this.#_lookupFS.exists(fileNamesPathSet.hashed));
            if (exists !== 'file') this._app.throw('File does not exist', [fileNamesPathSet.hashed.toString()]);

            const decrypted = _.value(await this.#decrypt(fileNamesPathSet, {fsRoot:this.#_lookupFS}));

            return this._app.textUtil.fromUint8Array(decrypted);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get unhashed name', arguments, {names:[this.constructor, this.#getUnhashedName]});
        }
    }

    async #getLookupDirectoryFolderPath(uint8Array:Hex_256, options?:{create?:boolean}):Promise<[FolderPath, string] | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const base32 = this._app.baseUtil.toBase32(uint8Array.slice(0, 30), CharSet.Base32_Custom); 
            const level1FolderName = `${base32[0]}${base32[1]}`; //1024
            const level2FolderName = `${base32[2]}${base32[3]}`; //1024

            //maximum of: 1024 * 1024 = 1,048,576 folders
            const fullFolderPath = new FolderPath(`/${level1FolderName}/${level2FolderName}/`);

            if (options?.create === true)
            {
                //first check if the full folder path exists. if not, create the level 1 and level 2 folders
                const exists0 = _.value(await this.#_lookupFS.exists(fullFolderPath));
                if (exists0 === false)
                {
                    const level1FolderPath = new FolderPath(`/${level1FolderName}/`);

                    const exists1 = _.value(await this.#_lookupFS.exists(level1FolderPath));
                    if (exists1 === false) _.check(await this.#_lookupFS.createFolder(level1FolderPath));

                    const level2FolderPath = new FolderPath(`/${level1FolderName}/${level2FolderName}/`);

                    const exists2 = _.value(await this.#_lookupFS.exists(level2FolderPath));
                    if (exists2 === false) _.check(await this.#_lookupFS.createFolder(level2FolderPath));
                }
            }

            //two levels deep to avoid having too many files in a single directory
            return [fullFolderPath, base32.slice(4)];
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get lookup directory folder path', arguments, {names:[this.constructor, this.#getLookupDirectoryFolderPath]});
        }
    }

    async #getFileNamePathSet(name:string, options?:{create?:false}):Promise<FilePathSet | IAborted | IError>;
    async #getFileNamePathSet(name:string, options:{create:true}):Promise<[FilePathSet, created:boolean] | IAborted | IError>;
    async #getFileNamePathSet(name:string, options?:{create?:boolean}):Promise<[FilePathSet, created:boolean] | FilePathSet | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            //hashed the hashed name to prevent an attacker from guessing which hashed name is associated with what name file
            //this will make it so they can't determine the length of the associated name by the size of the hashed name file
            const uint8Array = _.value(await this._app.hmacUtil.derive(this._hmacKey, this._app.hmacUtil.derivePAE([this._app.textUtil.toUint8Array(name)]), HMACOutputFormat.Hex));

            const [lookupDirectoryFolderPath, nameName] = _.value(await this.#getLookupDirectoryFolderPath(uint8Array, {create:options?.create ?? false}));

            const unhashed = lookupDirectoryFolderPath.getSubFile(`${nameName}.name`);
            const hashed = lookupDirectoryFolderPath.getSubFile(await this.hashName(`${nameName}.name`));
            let fileNamePathSet = {unhashed, hashed, toString:() => hashed.toString()};

            if (options?.create === true)
            {
                const exists = _.value(await this.#_lookupFS.exists(fileNamePathSet.hashed));
                if (exists !== false) return [fileNamePathSet, false];
    
                _.check(await this.#_lookupFS.createFile(fileNamePathSet.hashed));
                
                return [fileNamePathSet, true];
            }

            return fileNamePathSet;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get file name path set', arguments, {names:[this.constructor, this.#getFileNamePathSet]});
        }
    }

    async #getFileDataPathSet(info:IFileInfo, partIndex:number, options?:{create?:false}):Promise<FilePathSet | IAborted | IError>;
    async #getFileDataPathSet(info:IFileInfo, partIndex:number, options:{create:true}):Promise<[FilePathSet, created:boolean] | IAborted | IError>;
    async #getFileDataPathSet(info:IFileInfo, partIndex:number, options?:{create?:boolean}):Promise<[FilePathSet, created:boolean] | FilePathSet | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            //the uid is encrypted in the metadata so we shouldn't need to hash the uid, but we will do it anyway
            //so that if the metadata file data contents is leaked, the attacker will not be able to guess the associated data file name
            const uint8Array = _.value(await this._app.hmacUtil.derive(this._hmacKey, this._app.hmacUtil.derivePAE([this._app.baseUtil.fromHex(info.data.uid), this._app.textUtil.toUint8Array((partIndex).toString())]), HMACOutputFormat.Hex));
            
            const [lookupDirectoryFolderPath, name] = _.value(await this.#getLookupDirectoryFolderPath(uint8Array, {create:options?.create ?? false}));

            //we keep the data seperate from the metadata to make it difficult to guess what data file is associated with a given metadata file
            //also, this will be useful for moving files around, as we can just move the metadata file and not the data file
            //and, it will make cloud storage easier to implement, given the clear separation
            const unhashed = lookupDirectoryFolderPath.getSubFile(`${name}.data`);
            const hashed = lookupDirectoryFolderPath.getSubFile(_.value(await this.hashName(`${name}.data`)));
            const fileDataPathSet = {unhashed, hashed, toString:() => hashed.toString()};

            if (options?.create === true)
            {
                const exists = _.value(await this.#_lookupFS.exists(fileDataPathSet.hashed));
                if (exists !== false) return [fileDataPathSet, false];
    
                _.check(await this.#_lookupFS.createFile(fileDataPathSet.hashed));
                
                return [fileDataPathSet, true];
            }

            return fileDataPathSet;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to get file data path set', arguments, {names:[this.constructor, this.#getFileDataPathSet]});
        }
    }

    public async renameFolder(fromFolderPath:FolderPath, name:string, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            const nativeRename = async ():Promise<true | IAborted | IError> =>
            {
                let fromTurn:Turn<A> | undefined;
                let toTurn:Turn<A> | undefined;
        
                try
                {
                    const toFolderPath = new FolderPath(fromFolderPath, name);

                    toTurn = _.value(await this.#getTurn(toFolderPath, false));
        
                    const toFolderPathSet = _.value(await this.#resolve(toFolderPath));
        
                    const exists = _.value(await this.#exists(toFolderPathSet));
                    if (exists !== false) this._app.throw('File or folder already exists', [toFolderPath]);
        
                    fromTurn = _.value(await this.#getTurn(fromFolderPath, false));
        
                    const fromFolderPathSet = _.value(await this.#resolve(fromFolderPath));
        
                    for await (const info of this.#listFolder(fromFolderPathSet, abortController)) 
                    {
                        _.check(info);

                        this._app.throw('Folder is not empty', [fromFolderPathSet.toString()]);
                    }
                    _.check(); //check again after the for await loop

                    return _.value(await this.#_treeFS.renameFolder(fromFolderPath, name));
                }
                catch (error)
                {
                    return this._app.warn(error, 'Failed to rename folder', arguments, {names:[this.constructor, this.renameFolder, nativeRename]});
                }
                finally
                {
                    fromTurn?.end();
                    toTurn?.end();
                }
            }

            const moveRename = async ():Promise<true | IAborted | IError> =>
            {
                try
                {
                    const toFolderPath = new FolderPath(fromFolderPath, name);
        
                    //we will have to do a recursive move until rename is supported by the browser
                    const moveFolderRecursive = async (fromPath:FolderPath, toPath:FolderPath):Promise<true | IAborted | IError> =>
                    {
                        try
                        {
                            const exists = _.value(await this.exists(toPath));
                            if (exists !== false) this._app.throw('File or folder already exists', []);
                    
                            _.check(await this.createFolder(toPath));
                    
                            for await (let item of this.listFolder(fromPath, abortController)) 
                            {
                                item = _.value(item);

                                if (item.type === "file") _.value(await this.moveFile(fromPath.getSubFile(item.name), toPath.getSubFile(item.name), abortController));
                                else _.value(await moveFolderRecursive(fromPath.getSubFolder(item.name), toPath.getSubFolder(item.name)))
                            }
                            _.check(); //check again after the for await loop
                    
                            return _.value(await this.deleteFolder(fromPath, abortController));
                        }
                        catch (error)
                        {
                            return this._app.warn(error, 'Failed to move folder', arguments, {names:[this.constructor, this.renameFolder, moveRename, moveFolderRecursive]});
                        }
                    }
        
                    return await moveFolderRecursive(fromFolderPath, toFolderPath);
                }
                catch (error)
                {
                    return this._app.warn(error, 'Failed to rename folder', arguments, {names:[this.constructor, this.renameFolder]});
                }
            }

            if (this.#_treeFS.hasNativeSupportForRenaming === true) return _.value(await nativeRename());
            else return _.value(await moveRename());
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to rename folder', arguments, {names:[this.constructor, this.renameFolder]});
        }
    }
    
    public async renameFile(fromFilePath:FilePath, name:string, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            const nativeRename = async ():Promise<true | IAborted | IError> =>
            {
                let fromTurn:Turn<A> | undefined;
                let toTurn:Turn<A> | undefined;
        
                try
                {
                    const toFilePath = new FilePath(fromFilePath, name);

                    toTurn = _.value(await this.#getTurn(toFilePath, false));
        
                    const toFilePathSet = _.value(await this.#resolve(toFilePath));
        
                    const exists = _.value(await this.#exists(toFilePathSet));
                    if (exists !== false) this._app.throw('File or folder already exists', []);
        
                    fromTurn = _.value(await this.#getTurn(fromFilePath, false));
        
                    const fromFilePathSet = _.value(await this.#resolve(fromFilePath));
        
                    return _.value(await this.#_treeFS.renameFile(fromFilePath, name));
                }
                catch (error)
                {
                    return this._app.warn(error, 'Failed to rename file', arguments, {names:[this.constructor, this.renameFile, nativeRename]});
                }
                finally
                {
                    fromTurn?.end();
                    toTurn?.end();
                }
            }

            const moveRename = async ():Promise<true | IAborted | IError> =>
            {
                try
                {
                    const toFilePath = new FilePath(fromFilePath, name);
        
                    return _.value(await this.moveFile(fromFilePath, toFilePath, abortable));
                }
                catch (error)
                {
                    return this._app.warn(error, 'Failed to rename file', arguments, {names:[this.constructor, this.renameFile, moveRename]});
                }
            }

            if (this.#_treeFS.hasNativeSupportForRenaming === true) return _.value(await nativeRename());
            else return _.value(await moveRename());
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to rename file', arguments, {names:[this.constructor, this.renameFile]});
        }
    }

    public async *listFolder<T extends IFileInfo | IFolderInfo>(folderPath:FolderPath, abortable:IAbortable):AsyncGenerator<T | IAborted | IError>
    {
        let turn:Turn<A> | undefined;

        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            turn = _.value(await this.#getTurn(folderPath, true));

            const folderPathSet = _.value(await this.#resolve(folderPath));

            for await (const info of this.#listFolder<T>(folderPathSet, abortController)) yield _.result(info);
        }
        catch (error)
        {
            yield this._app.warn(error, 'Failed to list folder', arguments, {names:[this.constructor, this.listFolder]});
        }
        finally
        {
            turn?.end();
        }
    }

    async *#listFolder<T extends IFileInfo | IFolderInfo>(folderPathSet:FolderPathSet, abortController:IAbortController<A>):AsyncGenerator<T | IAborted | IError>
    {
        try
        {
            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            //@ts-ignore
            for await (let fileOrFolderPath of this.#_treeFS.listFolder(folderPathSet.hashed, abortController))
            {
                fileOrFolderPath = _.result(fileOrFolderPath);

                if (this._app.typeUtil.isError(fileOrFolderPath) === true) 
                {
                    _.check(yield this._app.warn(fileOrFolderPath, 'Failed to list folder', [folderPathSet], {names:[this.constructor, this.#listFolder]}));
                    continue;
                }

                if (this._app.typeUtil.isAborted(fileOrFolderPath) === true)
                {
                    _.check(yield fileOrFolderPath);
                    continue;
                }

                if (fileOrFolderPath.type === 'folder') continue; //skip folders (we only want metadata files)

                //file path set hack
                const filePathSet = {unhashed:folderPathSet.unhashed.getSubFile(fileOrFolderPath.name), hashed:fileOrFolderPath, toString:() => fileOrFolderPath.toString()};

                //if they have read access to the parent, they have read access to the children
                const info = _.result(await this.#getInfo<T>(filePathSet));
                
                if (this._app.typeUtil.isError(info) === true) _.check(yield this._app.warn(info, 'Failed to get info', [filePathSet], {names:[this.constructor, this.#listFolder]}));
                else _.check(yield info);
            }
            _.check(); //check again after the for await loop
        }
        catch (error)
        {
            yield this._app.warn(error, 'Failed to list folder', arguments, {names:[this.constructor, this.#listFolder]});
        }
    }

    public async deleteFolder(folderPath:FolderPath, abortable:IAbortable, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>
    {
        let turn:Turn<A> | undefined;

        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            turn = _.value(await this.#getTurn(folderPath, false));

            const folderPathSet = _.value(await this.#resolve(folderPath));

            return _.value(await this.#deleteFolder(folderPathSet, abortController));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to delete folder', arguments, {names:[this.constructor, this.deleteFolder]});
        }
        finally
        {
            turn?.end();
        }
    }

    async #deleteFolder(folderPathSet:FolderPathSet, abortController:IAbortController<A>, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            //check if the folder exists
            const exists = _.value(await this.#exists(folderPathSet));
            if (exists !== 'folder')
            {
                if (options?.isOkayIfNotExists === true) return true;
                this._app.throw('Folder does not exist', []);
            }

            //verify the folder is empty
            for await (const metadata of this.#listFolder(folderPathSet, abortController)) 
            {
                _.check(metadata);

                this._app.throw('Folder is not empty', []);
            }
            _.check(); //check again after the for await loop
            
            const result = _.value(await Promise.allSettled([this.#_treeFS.deleteFile(folderPathSet.filePathSet.hashed, options), this.#_treeFS.deleteFolder(folderPathSet.hashed, options)]));
            
            for (const promise of result)
            {
                if (promise.status === 'rejected') return this._app.rethrow(promise.reason, 'Promise failed', [promise]);

                _.check(promise.value);
            }

            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to delete folder', arguments, {names:[this.constructor, this.#deleteFolder]});
        }
    }

    async deleteFile(filePath:FilePath, abortable:IAbortable, options?:{isOkayIfNotExists?:boolean}):Promise<true | IAborted | IError>
    {
        let turn:Turn<A> | undefined;
        
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            turn = _.value(await this.#getTurn(filePath, false));

            const filePathSet = _.value(await this.#resolve(filePath));

            return _.value(await this.#deleteFile(filePathSet, abortController, options));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to delete file', arguments, {names:[this.constructor, this.deleteFile]});
        }
        finally
        {
            turn?.end();
        }
    }

    async #deleteFile(filePathSet:FilePathSet, abortController:IAbortController<A>, options?:{isOkayIfNotExists?:boolean, doNotDeleteData?:boolean}):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            //check to see if it exists
            const exists = _.value(await this.#exists(filePathSet));
            if (exists !== 'file')
            {
                if (options?.isOkayIfNotExists === true) return true;
                this._app.throw('File does not exist', []);
            }

            //get the file info
            const info = _.value(await this.#getInfo<IFileInfo>(filePathSet));
            
            //next, get the data file using the metadata and remove it if it exists
            if (options?.doNotDeleteData !== true) _.check(await this.#deleteFileData(filePathSet, info, abortController));

            //next, remove the file
            return _.value(await this.#_treeFS.deleteFile(filePathSet.hashed, options));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to delete file', arguments, {names:[this.constructor, this.#deleteFile]});
        }
    }

    async #deleteFileData(filePathSet:FilePathSet, info:IFileInfo, abortController:IAbortController<A>):Promise<true | IAborted | IError>
    {
        try
        {  
            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            if (info.data.chunks === 0) return true; //if there are no chunks, return true

            const parts = info.data.chunks + 1; //+1 for the header file
            for (let partIndex = 0; partIndex < parts; partIndex++)
            {
                const fileDataHandle = _.result(await this.#getFileDataPathSet(info, partIndex, {create:false}));
                
                //keep going if the file doesn't exist
                if (this._app.typeUtil.isError(fileDataHandle) === true) 
                {
                    this._app.warn(fileDataHandle, 'Could not get file handle when deleting file', arguments, {names:[this.constructor, this.#deleteFileData]});
                    continue;
                }
                if (this._app.typeUtil.isAborted(fileDataHandle) === true) return fileDataHandle;

                _.check(await this.#_lookupFS.deleteFile(fileDataHandle.hashed));
            }

            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to delete file data', arguments, {names:[this.constructor, this.#deleteFileData]});
        }
    }

    public async clear(abortable:IAbortable):Promise<true | IAborted | IError>
    {
        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            _.check(await this.#aquireGlobalLock());

            const deleteFolder_recursive = async (path:FolderPath):Promise<true | IAborted | IError> =>
            {
                try
                {
                    const files = [];
                    const folders = [];
                    
                    const folderPathSet = _.value(await this.#resolve(path));

                    for await (let fileOrFolderInfo of this.#listFolder(folderPathSet, abortController))
                    {
                        fileOrFolderInfo = _.value(fileOrFolderInfo);

                        if (fileOrFolderInfo.type === 'file') files.push(fileOrFolderInfo);
                        else folders.push(fileOrFolderInfo);
                    }
                    _.check(); //check again after the for await loop
        
                    //first delete the sub folders
                    for (let folderInfo of folders) _.check(await deleteFolder_recursive(new FolderPath(folderInfo.path)));
                    
                    //then delete the files
                    for (let fileInfo of files)
                    {
                        const filePathSet = _.value(await this.#resolve(new FilePath(fileInfo.path)));
                        
                        _.check(await this.#deleteFile(filePathSet, abortController)); 
                    }
        
                    //now that we have deleted all sub folders/files, delete this folder
                    return _.value(await this.#deleteFolder(folderPathSet, abortController));
                }
                catch (error)
                {
                    return this._app.warn(error, 'Failed to delete folder', arguments, {names:[this.constructor, this.clear, deleteFolder_recursive]});
                }
            }
    
            const rootFilePathSet = _.value(await this.#resolve(new FolderPath('/')));

            for await (let fileOrFolderInfo of this.#listFolder(rootFilePathSet, abortController))
            {   
                fileOrFolderInfo = _.value(fileOrFolderInfo);

                if (fileOrFolderInfo.type === 'file') 
                {
                    const filePathSet = _.value(await this.#resolve(new FilePath(fileOrFolderInfo.path)));

                    _.check(await this.#deleteFile(filePathSet, abortController));
                }
                else _.check(await deleteFolder_recursive(new FolderPath(fileOrFolderInfo.path)));
            }
            _.check(); //check again after the for await loop

            return true;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to clear', arguments, {names:[this.constructor, this.clear]});
        }
        finally
        {
            await this.#releaseGlobalLock();
        }
    }

    public async moveFolder(fromFolderPath:FolderPath, toFolderPath:FolderPath, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        let fromTurn:Turn<A> | undefined;
        let toTurn:Turn<A> | undefined;

        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            toTurn = _.value(await this.#getTurn(toFolderPath, false));

            const toFolderPathSet = _.value(await this.#resolve(toFolderPath));

            const exists = _.value(await this.#exists(toFolderPathSet));
            if (exists !== false) this._app.throw('File or folder already exists', []);

            fromTurn = _.value(await this.#getTurn(fromFolderPath, false));

            const fromFolderPathSet = _.value(await this.#resolve(fromFolderPath));

            for await (const info of this.#listFolder(fromFolderPathSet, abortController)) 
            {
                _.check(info);

                this._app.throw('Folder is not empty', []);
            }
            _.check(); //check again after the for await loop

            return _.value(await this.#moveFolder(fromFolderPathSet, toFolderPathSet, abortController));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to move folder', arguments, {names:[this.constructor, this.moveFolder]});
        }
        finally
        {
            fromTurn?.end();
            toTurn?.end();
        }
    }

    async #moveFolder(toFolderPathSet:FolderPathSet, fromFolderPathSet:FolderPathSet, abortController:IAbortController<A>):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            //copy the folder
            _.check(await this.#copyFolder(toFolderPathSet, fromFolderPathSet, abortController));
            
            //delete the original folder
            return _.value(await this.#deleteFolder(toFolderPathSet, abortController));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to move folder', arguments, {names:[this.constructor, this.#moveFolder]});
        }
    }

    public async copyFolder(fromFolderPath:FolderPath, toFolderPath:FolderPath, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        let fromTurn:Turn<A> | undefined;
        let toTurn:Turn<A> | undefined;

        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            toTurn = _.value(await this.#getTurn(toFolderPath, false));

            const toFolderPathSet = _.value(await this.#resolve(toFolderPath));

            const exists = _.value(await this.#exists(toFolderPathSet));
            if (exists !== false) this._app.throw('File or folder already exists', []);

            fromTurn = _.value(await this.#getTurn(fromFolderPath, true));

            const fromFolderPathSet = _.value(await this.#resolve(fromFolderPath));

            return _.value(await this.#copyFolder(fromFolderPathSet, toFolderPathSet, abortController));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to copy folder', arguments, {names:[this.constructor, this.copyFolder]});
        }
        finally
        {
            fromTurn?.end();
            toTurn?.end();
        }
    }

    async #copyFolder(fromFolderPathSet:FolderPathSet, toFolderPathSet:FolderPathSet, abortController:IAbortController<A>):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            //get the info to copy
            const fromInfo = _.value(await this.#getInfo<IFolderInfo>(fromFolderPathSet.filePathSet));

            //copy the metadata
            const toInfo = this._app.jsonUtil.clone(fromInfo);
            toInfo.name = toFolderPathSet.unhashed.name;
            toInfo.created = Date.now();
            toInfo.modified = Date.now();
            toInfo.accessed = Date.now();

            //create the folder
            return _.value(await this.#createFolder(toFolderPathSet, {info:toInfo}));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to copy folder', arguments, {names:[this.constructor, this.#copyFolder]});
        }
    }
    
    public async moveFile(fromFilePath:FilePath, toFilePath:FilePath, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        let fromTurn:Turn<A> | undefined;
        let toTurn:Turn<A> | undefined;

        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            toTurn = _.value(await this.#getTurn(toFilePath, false));

            const toFilePathSet = _.value(await this.#resolve(toFilePath));

            const exists = _.value(await this.#exists(toFilePathSet));
            if (exists !== false) this._app.throw('File or folder already exists', []);

            fromTurn = _.value(await this.#getTurn(fromFilePath, false));

            const fromFilePathSet = _.value(await this.#resolve(fromFilePath));

            return _.value(await this.#moveFile(fromFilePathSet, toFilePathSet, abortController));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to move file', arguments, {names:[this.constructor, this.moveFile]});
        }
        finally
        {
            fromTurn?.end();
            toTurn?.end();
        }
    }

    async #moveFile(fromFilePathSet:FilePathSet, toFilePathSet:FilePathSet, abortController:IAbortController<A>):Promise<true | IAborted | IError>
    {
        try
        {
            let _ = this.createAbortableHelper(abortController).throwIfAborted();

            //copy the file info, but not the data
            _.check(await this.#copyFile(fromFilePathSet, toFilePathSet, abortController, {doNotCopyData:true}));
            
            //we don't want to abort at this stage, so only do it if we must...
            abortController = new AbortController(this._app, [this]);

            _ = this.createAbortableHelper(abortController);

            //delete the original file
            let success = _.result(await this.#deleteFile(fromFilePathSet, abortController, {doNotDeleteData:true}));
            
            if (success === true) return true;
            
            if (this._app.typeUtil.isAborted(success) === true)
            {
                //this was aborted. there is nothing more we can do besides throw
                this._app.throw('file storage aborted in the middle of moving file, cleanup not possible', [], {correctable:true});
            }

            //this means we have two files referencing the same data, which is very bad. delete the new file
            success = _.result(await this.#deleteFile(toFilePathSet, abortController, {doNotDeleteData:true}));

            if (success === true) this._app.throw('failed to move file, cleanup successful', []);
            
            if (this._app.typeUtil.isAborted(success) === true)
            {
                //this was aborted. there is nothing more we can do besides throw
                this._app.throw('file storage aborted in the middle of moving file, cleanup not possible', [], {correctable:true});
            }

            //oh oh, let's try to update the info's data uid
            //try to update the info to point to a new data file
            const toInfo = _.value(await this.#getInfo<IFileInfo>(toFilePathSet));

            toInfo.data.uid = this._app.uidUtil.generate(); //be sure to update the data uid

            //if this fails, we are in a bad state (todo, add a flag so we can recover from this)
            _.check(await this.#setInfo(toFilePathSet, toInfo));
            
            this._app.throw('failed to move file, cleanup successful', []);
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to move file', arguments, {names:[this.constructor, this.#moveFile]});
        }
    }

    public async copyFile(fromFilePath:FilePath, toFilePath:FilePath, abortable:IAbortable):Promise<true | IAborted | IError>
    {
        let fromTurn:Turn<A> | undefined;
        let toTurn:Turn<A> | undefined;

        try
        {
            const abortController = new AbortController(this._app, [this, abortable]);

            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            toTurn = _.value(await this.#getTurn(toFilePath, false));

            const toFilePathSet = _.value(await this.#resolve(toFilePath));

            const exists = _.value(await this.#exists(toFilePathSet));
            if (exists !== false) this._app.throw('File or folder already exists', []);

            fromTurn = _.value(await this.#getTurn(fromFilePath, true));

            const fromFilePathSet = _.value(await this.#resolve(fromFilePath));

            return _.value(await this.#copyFile(fromFilePathSet, toFilePathSet, abortController, {doNotCopyData:false}));
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to copy file', arguments, {names:[this.constructor, this.copyFile]});
        }
        finally
        {
            fromTurn?.end();
            toTurn?.end();
        }
    }
    
    async #copyFile(fromFilePathSet:FilePathSet, toFilePathSet:FilePathSet, abortController:IAbortController<A>, options?:{doNotCopyData?:boolean}):Promise<true | IAborted | IError>
    {
        try
        {
            const _ = this.createAbortableHelper(abortController).throwIfAborted();

            //get the info to copy
            const fromInfo = _.value(await this.#getInfo<IFileInfo>(fromFilePathSet));

            //copy the metadata
            const toInfo = this._app.jsonUtil.clone(fromInfo);
            toInfo.name = toFilePathSet.unhashed.name;
            toInfo.extension = toFilePathSet.unhashed.extension;
            toInfo.created = Date.now();
            toInfo.modified = Date.now();
            toInfo.accessed = Date.now();

            if (options?.doNotCopyData !== true) toInfo.data.uid = this._app.uidUtil.generate(); //if we are copying the data, be sure to update the data uid

            //create the file
            _.check(await this.#createFile(toFilePathSet, {info:toInfo}));

            //if we are not copying the data, we are done
            if (options?.doNotCopyData === true) return true;

            //check if there is data to copy
            if (fromInfo.data.chunks > 0) //copy the data
            {
                const parts = fromInfo.data.chunks + 1; //+1 for the header file
                for (let partIndex = 0; partIndex < parts; partIndex++)
                {
                    const fromFileDataPathSet = _.value(await this.#getFileDataPathSet(fromInfo, partIndex, {create:false}));
                    const [toFileDataPathSet, _created] = _.value(await this.#getFileDataPathSet(toInfo, partIndex, {create:true}));

                    const fromData = _.value(await this.#_lookupFS.getFileData(fromFileDataPathSet.hashed, abortController));
                    
                    _.check(await this.#_lookupFS.setFileData(toFileDataPathSet.hashed, fromData, abortController));
                }
            }
            
            return true;
            
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to copy file', arguments, {names:[this.constructor, this.#copyFile]});
        }
    }

    async #encrypt<T extends CRYPT<Uint8Array>=CRYPT<Uint8Array>>(filePathSet:FilePathSet, data:Uint8Array, options?:{cryptKey?:CRYPTKey, fsRoot?:IFileStorageAdapter<A>}):Promise<T | IAborted | IError>
    {
        const app = this._app;

        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const fsRoot = options?.fsRoot ?? this.#_treeFS;
            const cryptKey = options?.cryptKey ?? this.#_cryptKey;

            const encrypted = _.value(await app.cryptUtil.encrypt(cryptKey, data));

            const stream = app.streamUtil.fromUint8Array(encrypted);

            _.check(await fsRoot.setFileData(filePathSet.hashed, new Data(app, async () => stream), this));
            
            return encrypted as T;
        }
        catch (error)
        {
            return app.warn(error, 'Failed to encrypt data', arguments, {names:[this.constructor, this.#encrypt]});
        }
    }

    async #decrypt(filePathSet:FilePathSet, options?:{cryptKey?:CRYPTKey, fsRoot?:IFileStorageAdapter<A>, abortController?:IAbortController<A>}):Promise<Uint8Array | IAborted | IError>
    {
        const app = this._app;

        try
        {
            const abortable = options?.abortController ?? this;

            const _ = this.createAbortableHelper(abortable).throwIfAborted();

            const fsRoot = options?.fsRoot ?? this.#_treeFS;
            const cryptKey = options?.cryptKey ?? this.#_cryptKey;

            const data = _.value(await fsRoot.getFileData(filePathSet.hashed, abortable));

            const stream = _.value(await data.get());
            if (stream === undefined) app.throw('Failed to get stream', []);

            const encrypted = _.value(await app.streamUtil.toUint8Array<CRYPT<Uint8Array>>(stream));
            if (encrypted.length === 0) app.throw('File stream is empty', []);

            return _.value(await app.cryptUtil.decrypt(cryptKey, encrypted));
        }
        catch (error)
        {
            return app.warn(error, 'Failed to decrypt data', arguments, {names:[this.constructor, this.#decrypt]});
        }
    }

    ///ensures file/folder cannot be read from if it is being written to, and cannot be written to if it is being read from (allows concurrent reads)
    #_turners:WeakValueMap<string, Turner<A>> = new WeakValueMap(true);
    #_globalLock?:ResolvePromise<void>;
    #_aquiringGlobalLock?:ResolvePromise<void>;
    async #getTurn(fileOrFolderPath:FilePath | FolderPath, readonly:boolean):Promise<Turn<A>>
    {
        const path = fileOrFolderPath.toString();
        const turners = this.#_turners;

        const turner = turners.get(path) ?? new Turner(this._app);
        const turn = await turner.getTurn({concurrency:readonly});

        while (this.#_aquiringGlobalLock !== undefined || this.#_globalLock !== undefined) await (this.#_aquiringGlobalLock ?? this.#_globalLock); //wait for the global lock to be released

        turners.set(path, turner);

        return turn;
    }

    async #aquireGlobalLock()
    {
        while (this.#_aquiringGlobalLock !== undefined || this.#_globalLock !== undefined) await (this.#_aquiringGlobalLock ?? this.#_globalLock); //wait for the global lock to be released

        const aquiringGlobalLock = this.#_aquiringGlobalLock = new ResolvePromise();

        //get turner end promises
        const turners = this.#_turners;
        const promises:Promise<void>[] = [];
        
        for (const [_id, turner] of turners) promises.push(turner.lock()); //prevents any new turns from being aquired
        await Promise.all(promises);

        promises.length = 0;
        for (const [_id, turner] of turners) promises.push(turner.waitForTurnsToEnd()); //wait for all outstanding turns to end
        await Promise.all(promises);

        this.#_globalLock = new ResolvePromise();

        this.#_aquiringGlobalLock = undefined;
        aquiringGlobalLock.resolve();
    }

    async #releaseGlobalLock()
    {
        while (this.#_aquiringGlobalLock !== undefined) await this.#_aquiringGlobalLock;
        if (this.#_globalLock === undefined) return; //no lock to release

        for (const [_id, turner] of this.#_turners) turner.unlock(); //unlock all turners (allow new turns to be aquired)

        const globalLock = this.#_globalLock;
        this.#_globalLock = undefined;

        globalLock.resolve();
    }

    async #resolve(folder:FolderPath, options?:{hmacKey?:HMACKey<HashType.SHA_256>}):Promise<FolderPathSet>;
    async #resolve(filePath:FilePath, options?:{hmacKey?:HMACKey<HashType.SHA_256>}):Promise<FilePathSet>;
    async #resolve(fileOrFolderPath:FilePath | FolderPath, options?:{hmacKey?:HMACKey<HashType.SHA_256>}):Promise<FolderPathSet | FilePathSet>;
    async #resolve(fileOrFolderPath:FilePath | FolderPath, options?:{hmacKey?:HMACKey<HashType.SHA_256>}):Promise<FolderPathSet | FilePathSet>
    {
        const promises = [];
        for (const part of fileOrFolderPath.parts) promises.push(this.hashName(part, options));

        const hashedParts = await Promise.all(promises);

        if (fileOrFolderPath.type === 'file') return {unhashed:fileOrFolderPath, hashed:new FilePath(`/${hashedParts.join('/')}`), toString:() => hashedFolderPath.toString()};

        const hashedFolderPath = fileOrFolderPath.parent === undefined ? new FolderPath('/') : new FolderPath(`/${hashedParts.join('/')}/`);
        
        const fileUnhashedPath = fileOrFolderPath.parent === undefined ? undefined : new FilePath(fileOrFolderPath, `${fileOrFolderPath.name}.folder`);
        const fileHashedPath = fileOrFolderPath.parent === undefined ? undefined : new FilePath(hashedFolderPath, await this.hashName(`${fileOrFolderPath.name}.folder`));
        const filePathSet =
        {
            unhashed:fileUnhashedPath!, 
            hashed:fileHashedPath!,
            toString:() => fileHashedPath === undefined ? '/' : fileHashedPath.toString()
        };

        const folderPath = 
        {
            unhashed:fileOrFolderPath!, 
            hashed:hashedFolderPath!, 
            toString:() => hashedFolderPath.toString(),
            filePathSet:filePathSet
        };

        return folderPath;
    }

    /**
     * Hashes the name of the file or folder. 
     * 
     * @note: in order to retrieve the unhashed name in the event of a corrupted or lost metadata,
     * we create a file for each hash, which is never deleted. They are stored like this:
     * 1) name "foobar", hashed name "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6"
     * 2) hashed name, hashed: "3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9"
     * /names/3/a/4/b/3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9
     * encrypted file contents: "foobar"
     * There would be little reason to delete these files, as they are fairly small, and there is
     * no way to associate them with a particular file or folder hashed name without the hmac key.
     * 
     * @note if the app is in plain text mode, the name will not be hashed.
     * 
     * @note encryption will not work because the encrypted output would be different with each encryption, given the ivs are random.
     * 
     * @note hashed names must be all upper or lowercase to avoid case sensitivity issues.
     * 
     * @param name the name of the file or folder
     * @returns a hashed version of the name
     */
    protected async hashName(name:string, options?:{hmacKey?:HMACKey<HashType.SHA_256>}):Promise<string>
    {
        if (this._app.environment.frozen.isPlainTextMode === true) return name;

        const hmacKey = options?.hmacKey ?? this._hmacKey;

        //slice to 160 bit signature, as that should be sufficient to ensure uniqueness within a folder
        const signature = (await this._app.hmacUtil.derive(hmacKey, this._app.hmacUtil.derivePAE([this._app.textUtil.toUint8Array(name)]), HMACOutputFormat.Hex)).slice(0, 20);

        return this._app.baseUtil.toBase32(signature, CharSet.Base32_Custom);
    }

    public get rootFolderName():string
    {
        return this.#_rootFolderPath.name;
    }
}