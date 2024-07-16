/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { FileStorage } from '../../../../../../../shared/src/library/file/storage/FileStorage';
import { FileStorageTestSuite as Shared } from '../../../library/file/storage/FileStorage.test';
import type { IFileStorage } from '../../../../../../../shared/src/library/file/storage/IFileStorage';
import type { IFileStorageAdapter } from '../../../../../../../shared/src/library/file/storage/adapters/IFileStorageAdapter';
import { OPFSFileStorageAdapter } from '../../../library/file/storage/adapters/OPFSFileStorageAdapter';
import { HashOutputFormat } from '../../../library/utils/HashUtil';
import { KeyType } from '../../../library/utils/KeyUtil';
import type { IApp } from '../../IApp';
import { BridgeFileStorageAdapter } from './adapters/BridgeFileStorageAdapter';
import { FolderPath } from '../../../../../../../shared/src/library/file/Path';
import type { IError } from '../../../../../../../shared/src/library/error/IError';
import type { IAborted } from '../../../../../../../shared/src/library/abort/IAborted';

/**
 * @forceSuperTransformer_ignoreParent (aliases are not supported by the transformer)
 */
export class FileStorageTestSuite<A extends IApp<A>> extends Shared<A>
{
    protected override async createFileStorage():Promise<IFileStorage<A> | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const hkdfKey = await this._app.keyUtil.import(this._app.hashUtil.generate(512, HashOutputFormat.hex), KeyType.HKDF);
            const storage = new FileStorage(this._app, hkdfKey, async (app:A, _fileStorage:IFileStorage<A>, rootFolderPath:FolderPath):Promise<IFileStorageAdapter<A> | IAborted | IError> => 
            {
                try
                {
                    //if the bridge is available, use the FSFileStorageAdapter, otherwise use the OPFSFileStorageAdapter
                    if (this._app.bridgeManager.available === true) 
                    {
                        const adapter = new BridgeFileStorageAdapter(app, new FolderPath('/test/').getSubFolder(rootFolderPath));
                        _.check(await adapter.init());

                        return adapter;
                    }

                    const adapter = new OPFSFileStorageAdapter(app, new FolderPath('/test/').getSubFolder(rootFolderPath));
                    _.check(await adapter.init());

                    return adapter;
                }
                catch (error)
                {
                    return this._app.warn(error, 'Failed to create file storage adapter', [], {names:[FileStorageTestSuite, this.createFileStorage]})
                }
            });
            _.check(await storage.init());

            return storage;
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to create file storage', [], {names:[FileStorageTestSuite, this.createFileStorage]})
        }
    }
}