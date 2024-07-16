/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { View } from "../../../../../library/components/view/View";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import type { IApp } from "../../../../IApp";
import type { ITreeTileData } from "./ITreeTileData";
import html from './TreeView.html';
import { DebounceAssistant } from "../../../../../library/assistants/DebounceAssistant";
import { SortedBucketCollection } from "../../../../../../../../../shared/src/library/collection/SortedBucketCollection";
import { SignalAssistant } from "../../../../../library/assistants/SignalAssistant";
import type { IAbortable } from "../../../../../../../../../shared/src/library/abort/IAbortable";
import { Signal } from "../../../../../../../../../shared/src/library/signal/Signal";
import type { TreeBoard } from "./TreeBoard";
import { SerialHelper } from "../../../../../library/helpers/SerialHelper";
import { FilteredCollection } from "../../../../../../../../../shared/src/library/collection/FilteredCollection";
import type { ITileData } from "../../../../../library/components/board/ITileData";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import { AbortController } from "../../../../../../../../../shared/src/library/abort/AbortController";
import type { IDriveFolder } from "../../../../../../../../../shared/src/library/file/drive/IDriveFolder";
import type { IDriveFileInfo, IDriveFolderInfo } from "../../../../../../../../../shared/src/library/file/drive/IDrive";
import type { folderpath } from "../../../../../../../../../shared/src/library/file/Path";
import type { IAborted } from "../../../../../../../../../shared/src/library/abort/IAborted";
import type { IError } from "../../../../../../../../../shared/src/library/error/IError";
import type { AbortableHelper } from "../../../../../../../../../shared/src/library/helpers/AbortableHelper";

const nameCategories:Array<string | {id:string, nested:SortedBucketCollection<any, ITreeTileData>}> = ['other_chars', '0-4', '5-9', 'a-d', 'e-h', 'i-l', 'm-p', 'q-t', 'u-z'];
const getNameCategoryByFirstLetter = (item:ITreeTileData) =>
{
    const char = item.sortID[0].toLowerCase();

    switch (char)
    {
        case '0': 
        case '1': 
        case '2': 
        case '3': 
        case '4': 
            return '0-4';
        case '5': 
        case '6': 
        case '7': 
        case '8': 
        case '9': 
            return '5-9';
        case 'a': 
        case 'b': 
        case 'c': 
        case 'd': 
            return 'a-d';
        case 'e': 
        case 'f': 
        case 'g': 
        case 'h': 
            return 'e-h';
        case 'i': 
        case 'j': 
        case 'k': 
        case 'l': 
            return 'i-l';
        case 'm': 
        case 'n': 
        case 'o': 
        case 'p': 
            return 'm-p';
        case 'q': 
            case 'r': 
            case 's': 
            case 't': 
            return 'q-t';
        case 'u': 
        case 'v': 
        case 'w': 
        case 'x': 
        case 'y': 
        case 'z': 
            return 'u-z';
        default: 
            return 'other_chars';
    }
}

class Elements
{   
    board!:HTMLElement;
}

@ComponentDecorator()
export class TreeView<A extends IApp<A>> extends View<A> //implements IInitializer
{
    private _board!:TreeBoard<A, ITreeTileData>;

    private _currentFolder?:IDriveFolder<A>;

    private _signalAssistant!:SignalAssistant<A>;

    private _dataProvider?:FilteredCollection<A, SortedBucketCollection<A, ITreeTileData>>;
    private _filter:((a:ITreeTileData) => boolean) | undefined;
    private _tileDataMap:Map<string, ITreeTileData> = new Map();

    private _serialHelper!:SerialHelper<A>;

    public readonly onCurrentFolderChangedSignal = new Signal<[View<A>, folderpath]>(this);

    private expandFolder!:(data:ITreeTileData) => Promise<void>;
    private collapseFolder!:(data:ITreeTileData) => void;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);
    }

    public override async init():Promise<void>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const elements = this._elements;

            this.set(elements);

            this._signalAssistant = new SignalAssistant(this._app, this, this);

            this._serialHelper = new SerialHelper(this._app, this, new AbortController(this._app, this));
            this.expandFolder = this._serialHelper.add(async (data:ITreeTileData):Promise<void> =>
            {
                if (data.isExpanded !== false) return;
                if (data.info?.type !== 'folder') return;
        
                const storageFileSystem = this._app.userManager.systemDrive;
                const folder = storageFileSystem.getFolder(data.info.path);
        
                const treeData = _.value(await this.#getTreeData(folder, this.abortableHelper, this));

                data.isExpanded = true;
                data.invalidated = true;
        
                this._dataProvider?.set.addAll(treeData);
            }, undefined);
        
            this.collapseFolder = this._serialHelper.add((data:ITreeTileData):void =>
            {
                if (data.isExpanded !== true) return;
                
                this.#removeDescendantsFromTree(data);
            }, undefined);

            this._board = elements.board.component as TreeBoard<A, ITreeTileData>;
            this._signalAssistant.subscribe(this._board.onTileDoubleClickedSignal, (board, tileData) => 
            {
                if (tileData.info?.type !== 'folder') return;

                this.onCurrentFolderChangedSignal.dispatch(this, tileData.info.path)
            });
            this._signalAssistant.subscribe(this._board.onTileClickedSignal, (board, tileData) => 
            {
                if (tileData.info?.type !== 'folder') return;

                if (tileData.isExpanded === true) this.collapseFolder(tileData);
                else this.expandFolder(tileData);
            });

            return super.init();
        }
        catch (error)
        {
            return this._app.rethrow(error, 'failed to initialize', [], {correctable:true});
        }
    }

    private getTileDataByStorageData(storageData:IDriveFileInfo | IDriveFolderInfo):ITreeTileData
    {
        const tileData = this._tileDataMap.get(storageData.path);
        if (tileData !== undefined) return tileData;
        
        //todo, set the proper indent level?
        return this._tileDataMap.set(storageData.path, {id:storageData.path, selected:false, info: storageData, indent:0, sortID:storageData.path, invalidated:true, isExpanded:false}).get(storageData.path)!;
    }

    #removeDescendantsFromTree = (data:ITreeTileData):void =>
    {
        data.isExpanded = false;
        data.invalidated = true;

        const baseSortID = data.sortID;
        const sortedBucketSet = this._dataProvider?.set;
        if (sortedBucketSet === undefined) return;

        const index = sortedBucketSet.indexOf(data);
        if (index === -1) return;

        const toDeleteArray:ITreeTileData[] = [];
        for (const eachData of sortedBucketSet.values(index + 1, undefined, {consistencyMode:2}))
        {
            if (eachData.sortID.startsWith(baseSortID) !== true) break;

            toDeleteArray.push(eachData);
        }

        sortedBucketSet.deleteAll(toDeleteArray);
    }

    //uses a transaction so we can pull live data from the storage folder, which is more performant (does not require splicing protentially very large arrays)
    //it also means there is a slight chance this live child data array will stay in memory long enough after this call to be reused by another call, which would be good.
    //since we use a transaction for all calls, it is safe. one thing to note is that the resulting tile tree data is somewhat live. the invidual child data objects are live
    //but not arrays, since we copy the data into a non-live array. so, we should be okay, even if we do something async before we use the data.
    //todo: we should revisit this to see if it makes any practical difference, if not, we should just use the non-live data, since it's simpler and easier to reason about.
    //but, stil use a transaction, since that will ensure we get a consistent view of the data.
    #getTreeData = async (folder:IDriveFolder<A>, _:AbortableHelper<A>, abortable:IAbortable):Promise<Array<ITreeTileData> | IAborted | IError> =>
    {
        try
        {
            _.throwIfAborted();

            const storageFileSystem = this._app.userManager.systemDrive;
            const data:Array<ITreeTileData> = [];
            //const result = await storageFileSystem.storage.transaction(async (batchAPI:ISyncTransactionAPI):Promise<boolean> => 
            //{
                const tileData = this._tileDataMap.get(folder.path.toString());
                const baseIndent = tileData?.indent !== undefined ? tileData.indent + 1 : 0;

                const childInfo:Array<IDriveFolderInfo | IDriveFileInfo> = []; //we want live data (it's more performant, and since we are in a transaction, it's safe)
                for await (const info of folder.getChildrenInfo(this)) childInfo.push(_.value(info));

                const cacheChildChildData = async ():Promise<Map<string, readonly (IDriveFolderInfo | IDriveFileInfo)[]>> =>
                {
                    const childDataCache = new Map<string, readonly (IDriveFolderInfo | IDriveFileInfo)[]>();
        
                    const innerCacheChildData = async (storageData:IDriveFolderInfo):Promise<void> =>
                    {
                        const folder = storageFileSystem.getFolder(storageData.path);
                        
                        let childInfo = childDataCache.get(storageData.path);
                        if (childInfo === undefined) 
                        {
                            childInfo = [];
                            for await (const info of folder.getChildrenInfo(this)) (childInfo as Array<IDriveFolderInfo | IDriveFileInfo>).push(_.value(info));
            
                            childDataCache.set(storageData.path, childInfo).get(storageData.path);
                        }
                        if (abortable?.aborted as boolean === true) return; //if aborted, return early
        
                        for (let j = 0; j < childInfo.length; j++)
                        {
                            const data = childInfo[j];
                            if (data.type !== 'folder') continue;
        
                            _.check(await innerCacheChildData(data));
                        }
                    }
        
                    const promises:Promise<void>[] = [];
                    for (let i = 0; i < childInfo.length; i++)
                    {
                        const data = childInfo[i];
        
                        if (data.type !== 'folder') continue;
        
                        promises.push(innerCacheChildData(data));
                    }
        
                    _.values(await Promise.all(promises));
        
                    return childDataCache;
                }
            
                const childDataCache = _.value(await cacheChildChildData());

                const createDataInner = (storageData:IDriveFolderInfo | IDriveFileInfo, indent:number) =>
                {
                    const tileData = this.getTileDataByStorageData(storageData);
                    tileData.indent = indent;
                    tileData.sortID = storageData.path;
                    data.push(tileData);

                    if (tileData.isExpanded === true && storageData.type === 'folder')
                    {
                        const childData = childDataCache.get(storageData.path);
                        if (childData === undefined) this._app.throw('childData is undefined', [], {correctable:true});

                        for (let j = 0; j < childData.length; j++) createDataInner(childData[j], indent + 1);
                    }

                    return true;
                }

                for (let i = 0; i < childInfo.length; i++) createDataInner(childInfo[i], baseIndent);
                
                //return true;
            //});

            return data;
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to get tree data', [], {names:[this.constructor, this.#getTreeData]});
        }
    }

    public setCurrentFolder = new DebounceAssistant(this, async (abortable:IAbortable, folder:IDriveFolder<A>):Promise<void | IAborted | IError> =>
    {
        try
        {
            const _ = this.createAbortableHelper(abortable).throwIfAborted();

            const abortController = new AbortController(this._app, [this, abortable]);

            if (this.initialized !== true) this._app.throw('setCurrentFolder called before initialized', [], {correctable:true});

            const currentFolder = this._currentFolder;
            const storageFileSystem = this._app.userManager.systemDrive;

            //if folder hasn't changed abort and return early
            if (currentFolder === folder) return abortController.abort('folder has not changed');
            
            const signalAssistant = this._signalAssistant;
            const drive = this._app.userManager.systemDrive;
            
            if (currentFolder !== undefined)
            {
                signalAssistant.unsubscribe(currentFolder.onChildModifiedSignal);
                signalAssistant.unsubscribe(currentFolder.onChildAddedSignal);
                signalAssistant.unsubscribe(currentFolder.onChildRemovedSignal);
            }
            this._currentFolder = folder;
            this._tileDataMap.clear();
            this._serialHelper.renew(abortController);

            signalAssistant.subscribe(folder.onChildRemovedSignal, async (folder, path) =>
            {
                const fileOrFolder = drive.getFileOrFolder(path.toString());
                
                const info = _.value(await fileOrFolder.getInfo());
                if (info.metadata.hidden === true) return;
                
                const tileData = this.getTileDataByStorageData(info);

                if (tileData.isExpanded === true) this.collapseFolder(tileData);

                this._dataProvider?.set.delete(tileData);
            });
            signalAssistant.subscribe(folder.onChildAddedSignal, async (folder, path) =>
            {
                const fileOrFolder = drive.getFileOrFolder(path.toString());

                const info = _.value(await fileOrFolder.getInfo());
                if (info.metadata.hidden === true) return;

                const tileData = this.getTileDataByStorageData(info);

                this._dataProvider?.set.add(tileData);
            });
            signalAssistant.subscribe(folder.onChildModifiedSignal, async (folder, path) => 
            {
                const tileData = this._tileDataMap.get(path.toString());
                if (tileData === undefined) return;

                tileData.sortID = ''; //todo

                tileData.invalidated = true;
                this._dataProvider?.set.invalidate(tileData);
            });
            signalAssistant.subscribe(folder.onChildRenamedSignal, async(folder, fromPath, toPath) =>
            {
                const tileData = this._tileDataMap.get(fromPath.toString());
                if (tileData === undefined) return;
                
                const toFileOrFolder = storageFileSystem.getFileOrFolder(toPath.toString());

                const toInfo = _.value(await toFileOrFolder.getInfo());

                if (tileData.info?.path !== fromPath.toString()) return;
                
                this._tileDataMap.delete(fromPath.toString());
                this._tileDataMap.set(toPath.toString(), tileData);

                tileData.info = toInfo;
                tileData.invalidated = true;
                this._dataProvider?.set.invalidate(tileData);
            });

            const data = _.value(await this.#getTreeData(folder, _, abortController));

            const compare = (a:ITreeTileData, b:ITreeTileData) => this._app.textUtil.compare(a.sortID, b.sortID);
            const sortedBucketSet = new SortedBucketCollection(this._app, nameCategories, getNameCategoryByFirstLetter, compare, data); //using the data here, which will be copied into a non-live array, so we are good now
            const filteredSet = new FilteredCollection(this._app, sortedBucketSet, this._filter);
            const dataProvider = this._dataProvider = filteredSet;

            _.check(await this._board.setDataProvider(dataProvider));
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to set current folder', [], {names:[this.constructor, 'setCurrentFolder']});
        }
    }, {throttle:true, delay:true, id:'setCurrentFolder'});
    
    public setFilter(filter?:((a:ITileData) => boolean) | undefined)
    {
        this._filter = filter;

        if (this._dataProvider === undefined) return;

        this._dataProvider.filter = filter;
    }

    public override get transparent():boolean { return false; } //need to override this again, since view sets this to true

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}