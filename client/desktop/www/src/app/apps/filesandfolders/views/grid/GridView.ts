/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { View } from "../../../../../library/components/view/View";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import type { IApp } from "../../../../IApp";
import type { IGridTileData } from "./IGridTileData";
import html from './GridView.html';
import type { GridBoard } from "./GridBoard";
import { DebounceAssistant } from "../../../../../library/assistants/DebounceAssistant";
import type { IStorageTileData } from "../../../../../library/components/board/IStorageTileData";
import { SortedBucketCollection } from "../../../../../../../../../shared/src/library/collection/SortedBucketCollection";
import { SignalAssistant } from "../../../../../library/assistants/SignalAssistant";
import { Signal } from "../../../../../../../../../shared/src/library/signal/Signal";
import { FilteredCollection } from "../../../../../../../../../shared/src/library/collection/FilteredCollection";
import type { ITileData } from "../../../../../library/components/board/ITileData";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import type { IDriveFolder } from "../../../../../../../../../shared/src/library/file/drive/IDriveFolder";
import type { IDriveFileInfo, IDriveFolderInfo } from "../../../../../../../../../shared/src/library/file/drive/IDrive";
import type { folderpath } from "../../../../../../../../../shared/src/library/file/Path";
import type { IAbortable } from "../../../../../../../../../shared/src/library/abort/IAbortable";
import type { IAborted } from "../../../../../../../../../shared/src/library/abort/IAborted";
import type { IError } from "../../../../../../../../../shared/src/library/error/IError";
import { AbortController } from "../../../../../../../../../shared/src/library/abort/AbortController";

const nameCategories:Array<string | {id:string, nested:SortedBucketCollection<any, IStorageTileData>}> = ['other_chars', '0-4', '5-9', 'a-d', 'e-h', 'i-l', 'm-p', 'q-t', 'u-z'];
const getNameCategoryByFirstLetter = (item:IStorageTileData) =>
{
    const char = ((item.info!.name ?? '') + (item.info!.extension ? `.${item.info!.extension}` : ''))[0].toLowerCase();

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
const nameCompare = (a:IStorageTileData, b:IStorageTileData) => 
{
    const nameA = ((a.info!.name ?? '') + (a.info!.extension ? `.${a.info!.extension}` : ''));
    const nameB = ((b.info!.name ?? '') + (b.info!.extension ? `.${b.info!.extension}` : ''));
    
    return nameA.localeCompare(nameB);
}

class Elements
{   
    board!:HTMLElement;
}

@ComponentDecorator()
export class GridView<A extends IApp<A>> extends View<A>
{
    private _board!:GridBoard<A, IGridTileData>;

    private _currentFolder?:IDriveFolder<A>;

    private _signalAssistant!:SignalAssistant<A>;

    private _dataProvider?:FilteredCollection<A, SortedBucketCollection<A, IGridTileData>>;
    private _filter:((a:IGridTileData) => boolean) | undefined;
    private _tileDataMap:Map<string, IGridTileData> = new Map();

    public readonly onCurrentFolderChangedSignal = new Signal<[View<A>, folderpath]>(this);

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);
    }

    public override async init():Promise<void>
    {
        const elements = this._elements;

        this.set(elements);

        this._signalAssistant = new SignalAssistant(this._app, this);

        this._board = elements.board.component as GridBoard<A, IGridTileData>;
        this._signalAssistant.subscribe(this._board.onTileDoubleClickedSignal, (board, tileData) => 
        {
            if (tileData.info?.type !== 'folder') return;

            this.onCurrentFolderChangedSignal.dispatch(this, tileData.info.path)
        });

        return super.init();
    }

    private getTileDataByStorageData(storageData:IDriveFileInfo | IDriveFolderInfo):IGridTileData
    {
        const tileData = this._tileDataMap.get(storageData.path);
        if (tileData !== undefined) return tileData;

        return this._tileDataMap.set(storageData.path, {id:storageData.path, selected:false, info: storageData, invalidated:true}).get(storageData.path)!;
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

            if (currentFolder !== undefined)
            {
                signalAssistant.unsubscribe(currentFolder.onChildModifiedSignal);
                signalAssistant.unsubscribe(currentFolder.onChildAddedSignal);
                signalAssistant.unsubscribe(currentFolder.onChildRemovedSignal);
            }
            this._currentFolder = folder;
            this._tileDataMap.clear();

            signalAssistant.subscribe(folder.onChildRemovedSignal, async (folder, path) =>
            {
                const fileOrFolder = storageFileSystem.getFileOrFolder(path.toString());
                
                const info = _.value(await fileOrFolder.getInfo());
                if (info.metadata.hidden === true) return;
                const tileData = this.getTileDataByStorageData(info);

                this._tileDataMap.delete(path.toString());

                this._dataProvider?.set.delete(tileData);
            });
            signalAssistant.subscribe(folder.onChildAddedSignal, async (folder, path) =>
            {
                const fileOrFolder = storageFileSystem.getFileOrFolder(path.toString());
                
                const info = _.value(await fileOrFolder.getInfo());
                if (info.metadata.hidden === true) return;
                const tileData = this.getTileDataByStorageData(info);

                this._dataProvider?.set.add(tileData);
            });
            signalAssistant.subscribe(folder.onChildModifiedSignal, async (folder, path) => 
            {
                const tileData = this._tileDataMap.get(path.toString());
                if (tileData === undefined) return;

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

            const childInfo:Array<IDriveFolderInfo | IDriveFileInfo> = [];
            for await (const info of folder.getChildrenInfo(abortController)) childInfo.push(_.value(info));
            
            const tileData:Array<IStorageTileData> = [];
            for (const child of childInfo) tileData.push(this.getTileDataByStorageData(child)); //have the appropriate view create the tile data given the storage data
            
            const sortedBucketSet = new SortedBucketCollection(this._app, nameCategories, getNameCategoryByFirstLetter, nameCompare, tileData);
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