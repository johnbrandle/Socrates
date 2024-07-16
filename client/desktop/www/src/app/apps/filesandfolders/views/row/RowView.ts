/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { DebounceAssistant } from "../../../../../library/assistants/DebounceAssistant";
import { EventListenerAssistant } from "../../../../../library/assistants/EventListenerAssistant";
import { SignalAssistant } from "../../../../../library/assistants/SignalAssistant";
import type { IStorageTileData } from "../../../../../library/components/board/IStorageTileData";
import { View } from "../../../../../library/components/view/View";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import { Signal } from "../../../../../../../../../shared/src/library/signal/Signal";
import { SortedBucketCollection } from "../../../../../../../../../shared/src/library/collection/SortedBucketCollection";
import { FilteredCollection } from "../../../../../../../../../shared/src/library/collection/FilteredCollection";
import type { IApp } from "../../../../IApp";
import { DragAssistant } from "../../../../assistants/DragAssistant";
import type { IRowTileData } from "./IRowTileData";
import type { RowBoard } from "./RowBoard";
import html from './RowView.html';
import type { ITileData } from "../../../../../library/components/board/ITileData";
import { easeOutQuad } from "../../../../../library/assistants/TweenAssistant";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import type { IDriveFolder } from "../../../../../../../../../shared/src/library/file/drive/IDriveFolder";
import type { IDriveFileInfo as IDriveFileInfo, IDriveFolderInfo as IDriveFolderInfo } from "../../../../../../../../../shared/src/library/file/drive/IDrive";
import type { folderpath, path } from "../../../../../../../../../shared/src/library/file/Path";
import type { IAbortable } from "../../../../../../../../../shared/src/library/abort/IAbortable";
import type { IError } from "../../../../../../../../../shared/src/library/error/IError";
import type { IAborted } from "../../../../../../../../../shared/src/library/abort/IAborted";
import { AbortController } from "../../../../../../../../../shared/src/library/abort/AbortController";

const nameCategories:Array<string | {id:string, nested:SortedBucketCollection<any, IStorageTileData>}> = ['other_chars', '0-4', '5-9', 'a-d', 'e-h', 'i-l', 'm-p', 'q-t', 'u-z'];
const getNameCategory = (item:IStorageTileData) =>
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
const lastModifiedCategories:Array<string | {id:string, nested:SortedBucketCollection<any, IStorageTileData>}> = ['folder', '-2023', '2024', '2025', '2026', '2027', '2028', '2029-'];
const getLastModifiedCategory = (item:IStorageTileData) =>
{
    if (item.info!.type === 'folder') return 'folder';

    const year = new Date(item.info!.modified).getFullYear();

    if (year <= 2023) return '-2023';
    if (year >= 2029) return '2029-';

    return year.toString();
}
const lastModifiedCompare = (a:IStorageTileData, b:IStorageTileData) => 
{
    const modifiedA = a.info!.modified;
    const modifiedB = b.info!.modified;

    if (modifiedA === modifiedB) return 0;

    return modifiedA > modifiedB ? 1 : -1;
}
const sizeCategories:Array<string | {id:string, nested:SortedBucketCollection<any, IStorageTileData>}> = ['folder', 'bytes', 'KB', 'MB', 'GB-'];
const getSizeCategory = (item:IStorageTileData) =>
{
    if (item.info!.type === 'folder') return 'folder';

    let size = item.info!.data.bytes.decrypted; //size is in bytes, determine which category it belongs to
    if (size < 1024) return 'bytes';
    if (size < 1024 * 1024) return 'KB';
    if (size < 1024 * 1024 * 1024) return 'MB';
    return 'GB-';
}
const sizeCompare = (a:IStorageTileData, b:IStorageTileData) => 
{
    if (a.info!.type === 'folder') return 0;
    if (b.info!.type === 'folder') return 0;

    const bytesA = a.info!.data.bytes.decrypted;
    const bytesB = b.info!.data.bytes.decrypted;

    if (bytesA === bytesB) return 0;
    return bytesA > bytesB ? 1 : -1;
}

const kindCategories:Array<string | {id:string, nested:SortedBucketCollection<any, IStorageTileData>}> = ['folder', 'other'];
const kindCategory = (item:IStorageTileData) =>
{
    if (item.info!.type === 'folder') return 'folder';

    return 'other';
}
const kindCompare = (a:IStorageTileData, b:IStorageTileData) => 
{
    if (a.info!.type === 'folder') return 0;
    if (b.info!.type === 'folder') return 0;

    const kindA = a.info!.metadata.mimeType ?? '';
    const kindB = b.info!.metadata.mimeType ?? '';

    return kindA.localeCompare(kindB);
}

class Elements
{   
    board!:HTMLElement;
    columns!:Array<HTMLElement>;
    columnsContainer!:HTMLElement;
}

@ComponentDecorator()
export class RowView<A extends IApp<A>> extends View<A>
{
    private _board!:RowBoard<A, IRowTileData>;

    private _currentFolder?:IDriveFolder<A>;

    private _signalAssistant!:SignalAssistant<A>;
    private _eventListenerAssistant!:EventListenerAssistant<A>;

    private _dataProvider?:FilteredCollection<A, SortedBucketCollection<A, IRowTileData>>;
    private _filter:((a:IRowTileData) => boolean) | undefined;
    private _tileDataMap:Map<path, IRowTileData> = new Map();

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
        this._eventListenerAssistant = new EventListenerAssistant(this._app, this);

        this._board = elements.board.component as RowBoard<A, IRowTileData>;
        this._signalAssistant.subscribe(this._board.onTileDoubleClickedSignal, (board, tileData) => 
        {
            if (tileData.info?.type !== 'folder') return;

            this.onCurrentFolderChangedSignal.dispatch(this, tileData.info.path);
        });

        const [nameColumn, modifiedColumn, sizeColumn, kindColumn] = elements.columns;

        const getDirectionElement = (column:HTMLElement) => this.get<HTMLElement>('direction', column, false);

        let selectedColumn = nameColumn;
        getDirectionElement(selectedColumn).style.visibility = 'visible';
        for (const column of elements.columns)
        {
            let direction = 'asc';
            this._eventListenerAssistant.subscribe(column, 'click', () =>
            {
                const sortedBucketSet = this._dataProvider!.set;

                getDirectionElement(selectedColumn).style.visibility = 'hidden';

                if (column !== selectedColumn)
                {
                    let categories;
                    let getCategory;
                    let compare;

                    switch (column)
                    {
                        case nameColumn:
                            categories = nameCategories;
                            getCategory = getNameCategory;
                            compare = nameCompare;
                            break;
                        case modifiedColumn:
                            categories = lastModifiedCategories;
                            getCategory = getLastModifiedCategory;
                            compare = lastModifiedCompare;
                            break;
                        case sizeColumn:
                            categories = sizeCategories;
                            getCategory = getSizeCategory;
                            compare = sizeCompare;
                            break;
                        case kindColumn:
                            categories = kindCategories;
                            getCategory = kindCategory;
                            compare = kindCompare;
                            break;
                        default:
                            this._app.throw('unknown column', arguments);
                    }

                    if (categories === undefined) return;
                    if (sortedBucketSet === undefined) return;

                    sortedBucketSet.invalidate(categories, getCategory, compare, undefined, direction === 'asc' ? false : true);
                }
                else 
                {
                    direction = direction === 'asc' ? 'desc' : 'asc';

                    if (direction === 'asc' && sortedBucketSet.reversed === true) sortedBucketSet.reverse();
                    if (direction === 'desc' && sortedBucketSet.reversed === false) sortedBucketSet.reverse();
                }

                selectedColumn = column;

                const directionElement = getDirectionElement(column);
                directionElement.style.visibility = 'visible';
    
                directionElement.classList.remove('bi-caret-up');
                directionElement.classList.remove('bi-caret-down');
    
                directionElement.classList.add(direction === 'asc' ? 'bi-caret-up' : 'bi-caret-down');
            });
        }

        const updateGridColumnSizes = (sizes:Array<string>) => 
        {
            document.documentElement.style.setProperty('--col1-size', sizes[0]);
            document.documentElement.style.setProperty('--col2-size', sizes[1]);
            document.documentElement.style.setProperty('--col3-size', sizes[2]);
            document.documentElement.style.setProperty('--col4-size', sizes[3]);
            document.documentElement.style.setProperty('--col5-size', sizes[4]);
        }

        const minimumPercentages = [15, 10, 10];
        const percentages = [20, 15, 15];
        updateGridColumnSizes(['auto', 'minmax(0, 1fr)', `${percentages[0]}%`, `${percentages[1]}%`, `${percentages[2]}%`]);

        let i = 0;
        for (const column of this._elements.columns)
        {
            const dragHandle = this.get<HTMLElement>('dragHandle', column, true);

            if (dragHandle === undefined) continue;
            const index = i++;

            const onResize = (dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number, deltaX:number, deltaY:number):void => 
            {
                let availableWidth = this._elements.columnsContainer.clientWidth;
   
                let width = (percentages[index] * availableWidth) / 100;
                width -= deltaX;

                let percent = (width / availableWidth) * 100;

                if (percent < minimumPercentages[index]) percent = minimumPercentages[index];
                if (percent > 30) percent = 30;

                percentages[index] = percent;

                updateGridColumnSizes(['auto', 'minmax(0, 1fr)', `${percentages[0]}%`, `${percentages[1]}%`, `${percentages[2]}%`]);
            }
            const onResizeEnd = (dragAssistant:DragAssistant<A>):void => //handle end of drag handle resizing
            {
    
            }

            new DragAssistant(this._app, this, dragHandle, () => {}, 
            () => 
            {
                return {momentum:{multiplier:80, threshold:30, max:Math.max(window.innerHeight, window.innerWidth), duration:500, ease:easeOutQuad}};
            }, onResize, onResizeEnd, 5);
        }

        return super.init();
    }

    private getTileDataByStorageData(storageData:IDriveFileInfo | IDriveFolderInfo):IRowTileData
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
            
            const sortedBucketSet = new SortedBucketCollection(this._app, nameCategories, getNameCategory, nameCompare, tileData);
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