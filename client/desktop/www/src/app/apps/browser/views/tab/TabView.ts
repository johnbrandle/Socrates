/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { View } from "../../../../../library/components/view/View";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import type { IApp } from "../../../../IApp";
import type { ITabTileData } from "./ITabTileData";
import html from './TabView.html';
import type { TabBoard } from "./TabBoard";
import { SignalAssistant } from "../../../../../library/assistants/SignalAssistant";
import { Signal } from "../../../../../../../../../shared/src/library/signal/Signal";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import { Collection } from "../../../../../../../../../shared/src/library/collection/Collection";
import { Browser } from "../../Browser";
import type { IDriveFileInfo, IDriveFolderInfo } from "../../../../../../../../../shared/src/library/file/drive/IDrive";
import type { IDriveFolder } from "../../../../../../../../../shared/src/library/file/drive/IDriveFolder";

class Elements
{   
    board!:HTMLElement;
}

@ComponentDecorator()
export class TabView<A extends IApp<A>> extends View<A>
{
    private _board!:TabBoard<A, ITabTileData>;

    private _currentFolder?:IDriveFolder<A>;

    private _signalAssistant!:SignalAssistant<A>;

    private _dataProvider!:Collection<A, ITabTileData>;
    private _filter:((a:ITabTileData) => boolean) | undefined;
    private _tileDataMap:Map<string, ITabTileData> = new Map();

    public readonly onCurrentFolderChangedSignal = new Signal<[View<A>, string]>(this);

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);
    }

    public override async init():Promise<void>
    {
        const elements = this._elements;

        this.set(elements);

        this._signalAssistant = new SignalAssistant(this._app, this);

        this._board = elements.board.component as TabBoard<A, ITabTileData>;


        this._dataProvider = new Collection(this._app, []);

        /*
        this._signalAssistant.subscribe(this._board.onTileDoubleClickedSignal, (board, tileData) => 
        {
            if (tileData.storageData?.type !== 'folder') return;

            this.onCurrentFolderChangedSignal.dispatch(this, tileData.id)
        });
        */
       
        return super.init();
    }

    public override async fnit():Promise<void>
    {
        await super.fnit();

        const _ = this.abortableHelper.throwIfAborted();

        const browser = this._app.componentUtil.getParent(this, Browser<A>)!;
        const signalAssistant = this._signalAssistant;

        signalAssistant.subscribe(browser.onTabCreatedSignal, async (browser, id, webview) => 
        {
            this.log('tab created');
        });
        signalAssistant.subscribe(browser.onTabUpdatedSignal, async (browser, id, webview, storageFolder) => 
        {
            const childInfo:Array<IDriveFolderInfo | IDriveFileInfo> = [];
            for await (const info of storageFolder.getChildrenInfo(this)) childInfo.push(_.value(info));
           
            for (const child of childInfo) 
            {
                const tileData = this.getTileDataByStorageData(child);

                if (this._dataProvider.has(tileData) !== true) this._dataProvider.add(tileData);
                
                tileData.invalidated = true;
           
                this._dataProvider.invalidate(tileData);
            }
        });
        signalAssistant.subscribe(browser.onTabDestroyedSignal, (browser, id, webview) => 
        {
        });
    }

    public override async ready():Promise<void>
    {
        await super.ready();

        await this._board.setDataProvider(this._dataProvider);
    }
    
    private getTileDataByStorageData(storageData:IDriveFileInfo | IDriveFolderInfo):ITabTileData
    {
        const tileData = this._tileDataMap.get(storageData.path);
        if (tileData !== undefined) return tileData;

        this._tileDataMap.set(storageData.path, {id:storageData.path, selected:false, info:storageData, invalidated:true});

        return this._tileDataMap.get(storageData.path)!;
    }
/*
    public setCurrentFolder = new DebounceAssistant(this, async(abortController:IAbortController, folder:IStorageFolder):Promise<void> =>
    {
        if (this.initialized !== true) return; //if not initialized, return

        const currentFolder = this._currentFolder;
        const storageFileSystem = this._app.userManager.fileSystem;

        //if folder hasn't changed abort and return early
        if (currentFolder === folder)
        {
            abortController.abort('folder has not changed');
            return; 
        }

        const signalAssistant = this._signalAssistant;

        if (currentFolder !== undefined)
        {
            signalAssistant.unsubscribe(currentFolder.onChildModifiedSignal);
            signalAssistant.unsubscribe(currentFolder.onChildAddedSignal);
            signalAssistant.unsubscribe(currentFolder.onChildRemovedSignal);
        }
        this._currentFolder = folder;
        this._tileDataMap.clear();

        signalAssistant.subscribe(folder.onChildRemovedSignal, async (folder, id) =>
        {
            const fileOrFolder = storageFileSystem.getFileOrFolder(id);
            const data = await fileOrFolder.getData();

            if (abortController.aborted === true) return; //if aborted, return early

            const tileData = this.getTileDataByStorageData(data);

            this._dataProvider?.set.delete(tileData);
        });
        signalAssistant.subscribe(folder.onChildAddedSignal, async (folder, id) =>
        {
            const fileOrFolder = storageFileSystem.getFileOrFolder(id);
            const data = await fileOrFolder.getData();

            if (abortController.aborted === true) return; //if aborted, return early

            const tileData = this.getTileDataByStorageData(data);

            this._dataProvider?.set.add(tileData);
        });
        signalAssistant.subscribe(folder.onChildModifiedSignal, async (folder, id) => 
        {
            const tileData = this._tileDataMap.get(id);
            if (tileData === undefined) return;

            tileData.invalidated = true;
            this._dataProvider?.set.invalidate(tileData);
        });

        const childData = await folder.getChildData();

        if (abortController.aborted === true) return; //if aborted, return early

        const tileData:Array<IStorageTileData> = [];
        for (const child of childData) tileData.push(this.getTileDataByStorageData(child)); //have the appropriate view create the tile data given the storage data

        const dataProvider = this._dataProvider = new Collection(this._app, this, tileData);

        await this._board.setDataProvider(dataProvider);
    }, {throttle:true, delay:true, id:'setCurrentFolder'});
    */

    public override get transparent():boolean { return false; } //need to override this again, since view sets this to true

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}