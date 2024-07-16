/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../IApp.ts';
import html from './FilesAndFolders.html';
import { Window, type IWindowDisplayOptions, type IWindowStorage } from '../../screens/explorer/window/Window.ts';
import { ComponentDecorator } from '../../../library/decorators/ComponentDecorator.ts';
import { WindowElements } from '../../screens/explorer/window/WindowElements.ts';
import { DragAssistant } from '../../assistants/DragAssistant.ts';
import { DebounceAssistant } from '../../../library/assistants/DebounceAssistant.ts';
import { ButtonGroupAssistant } from '../../../library/assistants/ButtonGroupAssistant.ts';
import type { IViewer } from '../../../library/components/view/IViewer.ts';
import type { RowView } from './views/row/RowView.ts';
import type { GridView } from './views/grid/GridView.ts';
import type { SidebarView } from './views/sidebar/SidebarView.ts';
import type { HMultiSlider } from '../../../library/components/slider/HMultiSlider.ts';
import type { TreeView } from './views/tree/TreeView.ts';
import { SignalAssistant } from '../../../library/assistants/SignalAssistant.ts';
import type { PromiseTransition } from '../../../library/components/view/transition/PromiseTransition.ts';
import type { ITileData } from '../../../library/components/board/ITileData.ts';
import type { IStorageTileData } from '../../../library/components/board/IStorageTileData.ts';
import { easeOutQuad } from '../../../library/assistants/TweenAssistant.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import { IntervalAssistant } from '../../../library/assistants/IntervalAssistant.ts';
import type { IDriveFolder } from '../../../../../../../shared/src/library/file/drive/IDriveFolder.ts';
import type { ISystemDrive } from '../../../library/file/drive/ISystemDrive.ts';
import type { IFileInfo } from '../../../../../../../shared/src/library/file/storage/IFileStorage.ts';
import type { FolderPath, folderpath } from '../../../../../../../shared/src/library/file/Path.ts';
import type { IAbortable } from '../../../../../../../shared/src/library/abort/IAbortable.ts';
import type { IAborted } from '../../../../../../../shared/src/library/abort/IAborted.ts';
import type { IError } from '../../../../../../../shared/src/library/error/IError.ts';
import { AbortController } from '../../../../../../../shared/src/library/abort/AbortController.ts';
import type { IDriveFileInfo, IDriveFolderInfo } from '../../../../../../../shared/src/library/file/drive/IDrive.ts';

class Elements extends WindowElements
{   
    homeButton!:HTMLElement;
    backButton!:HTMLElement;
    forwardButton!:HTMLElement;
    upButton!:HTMLElement;
    pathTextField!:HTMLInputElement;
    
    filterOptionsButton!:HTMLElement;
    filterOptionsPanel!:HTMLElement;
    typeButtons!:Array<HTMLButtonElement>;
    bytesSlider!:HTMLElement;
    lastModifiedSlider!:HTMLElement;
    resetButton!:HTMLElement;

    displayOptionButtons!:Array<HTMLButtonElement>;

    sidebar!:HTMLElement;
    sidebarView!:HTMLElement;

    resizeDivider!:HTMLElement;

    boardViewer!:HTMLElement;
    gridView!:HTMLElement;
    rowView!:HTMLElement;
    treeView!:HTMLElement;

    footer!:HTMLElement;
}

@ComponentDecorator()
export class FilesAndFolders<A extends IApp<A>> extends Window<A>
{
    private _sidebarView!:SidebarView<A>;

    private _gridView!:GridView<A>;
    private _rowView!:RowView<A>;
    private _treeView!:TreeView<A>;
    private _boardViewer!:IViewer<A, PromiseTransition<A>>;

    private _drive!:ISystemDrive<A>;

    private _homeFolder!:IDriveFolder<A>;

    private _backStack:Array<IDriveFolder<A>> = [];
    private _forwardStack:Array<IDriveFolder<A>> = [];
    private _currentFolder?:IDriveFolder<A>;

    private _signalAssistant!:SignalAssistant<A>;

    private _files = 0;
    private _folders = 0;
    private _archives = 0;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, appID:string, windowID:string, storage:IWindowStorage<A>, displayOptions?:IWindowDisplayOptions) 
    {
        super(app, destructor, element, appID, windowID, storage, displayOptions);
    }

	protected override preprocessHTML(element:HTMLElement):HTMLElement
	{ 
        element = super.preprocessHTML(element);
        
        const contentContainer = this.get<HTMLElement>('windowContent', element, false);
        if (!contentContainer) this._app.throw('Could not find window content container', [], {correctable:true});

        contentContainer.innerHTML = html;

        return element;
	}

    public override async init(...args:any):Promise<void>
    {
        const elements = this._elements;

        this.set(elements);

        this._signalAssistant = new SignalAssistant(this._app, this);

        this._drive = this._app.userManager.systemDrive;
        this._homeFolder = this._drive.desktopFolder;

        this._sidebarView = this._elements.sidebarView.component as SidebarView<A>;

        this._gridView = this._elements.gridView.component as GridView<A>;
        this._rowView = this._elements.rowView.component as RowView<A>;
        this._treeView = this._elements.treeView.component as TreeView<A>;

        const setCurrentFolder = (_view:any, folderID:folderpath) =>
        {
            this._backStack.push(this._currentFolder!);

            this.#setCurrentFolder(this._drive.getFolder(folderID));
        }
        this._gridView.onCurrentFolderChangedSignal.subscribe(this, setCurrentFolder);
        this._rowView.onCurrentFolderChangedSignal.subscribe(this, setCurrentFolder);
        this._treeView.onCurrentFolderChangedSignal.subscribe(this, setCurrentFolder);

        this._boardViewer = elements.boardViewer.component as IViewer<A, PromiseTransition<A>>;

        this.title = this.appName; //set window title

        this.#initNavigationButtons();
        this.#initFilterOptionsPanel();
        this.#initDisplayButtons();
        this.#initResizeDivider();

        return super.init();
    }

    public override async ready():Promise<void>
    {
        this.#setCurrentFolder(this._homeFolder);

        return super.ready();
    }

    #initNavigationButtons():void
    {
        const elements = this._elements;

        const eventListenerAssistant = this._eventListenerAssistant;

        eventListenerAssistant.subscribe(elements.homeButton, 'click', async() => this.#setCurrentFolder(this._homeFolder));
        eventListenerAssistant.subscribe(elements.backButton, 'click', async() =>
        {
            if (this._backStack.length === 0) return;

            let folder = this._backStack.pop();
            if (folder === undefined) return;

            this._forwardStack.push(this._currentFolder!);
            await this.#setCurrentFolder(folder, false);
        });

        eventListenerAssistant.subscribe(elements.forwardButton, 'click', async() =>
        {
            if (this._forwardStack.length === 0) return;

            let folder = this._forwardStack.pop();
            if (folder === undefined) return;

            this._backStack.push(this._currentFolder!);
            await this.#setCurrentFolder(folder, false);
        });

        eventListenerAssistant.subscribe(elements.upButton, 'click', async() =>
        {
            let parentFolder = await this._currentFolder!.getParent();
            if (!parentFolder) return;

            this.#setCurrentFolder(parentFolder);
        });
    }

    private _filter?:(tileData:ITileData) => boolean;
    private _intervalAssistant:IntervalAssistant<A> = new IntervalAssistant(this._app, this, this);
    private _filterType?:'file'|'folder';

    #applyFilter = new DebounceAssistant(this, async(abortable:IAbortable):Promise<void | IAborted | IError> => 
    {
        try
        {
            const _ = this.createAbortableHelper(abortable).throwIfAborted();

            this._intervalAssistant.stop();

            let useFilter = false;

            const elements = this._elements;
            const bytesSlider = elements.bytesSlider.component as HMultiSlider<A>;
            const lastModifiedSlider = elements.lastModifiedSlider.component as HMultiSlider<A>;

            const filterType = this._filterType;
            if (filterType !== undefined) useFilter = true;

            const [bytesPercentMin, bytesPercentMax] = bytesSlider.getValues();

            const minBytesData = this.#getBytesDataByPercent(bytesPercentMin);
            const maxBytesData = this.#getBytesDataByPercent(bytesPercentMax);

            const [lastModifiedPercentMin, lastModifiedPercentMax] = lastModifiedSlider.getValues();

            const minLastModifiedData = this.#getLastModifiedDataByPercent(lastModifiedPercentMin);
            const maxLastModifiedData = this.#getLastModifiedDataByPercent(lastModifiedPercentMax);

            const minBytes = this.#getBytesByBytesData(minBytesData);
            const maxBytes = this.#getBytesByBytesData(maxBytesData);

            if (minBytes > this.#getBytesByBytesData(this.#getBytesDataByPercent(0)) || maxBytes < this.#getBytesByBytesData(this.#getBytesDataByPercent(100))) useFilter = true;

            let minLastModified = this.#getLastModifiedByLastModifiedData(minLastModifiedData);
            let maxLastModified = this.#getLastModifiedByLastModifiedData(maxLastModifiedData);

            let setupTimeout = false;
            if (minLastModified > this.#getLastModifiedByLastModifiedData(this.#getLastModifiedDataByPercent(0)) || maxLastModified < this.#getLastModifiedByLastModifiedData(this.#getLastModifiedDataByPercent(100))) 
            {
                setupTimeout = true;
                useFilter = true;
            }

            let now = Date.now();
            minLastModified = now - minLastModified;
            maxLastModified = now - maxLastModified;

            let filter;
            if (useFilter === false) filter = this._filter = undefined;
            else filter = this._filter = (tileData:IStorageTileData):boolean =>
            {
                const storageData = tileData.info!;

                if (filterType !== undefined && storageData.type !== filterType) return false;

                const lastModified = storageData.modified;
                if (lastModified > minLastModified || lastModified < maxLastModified) return false;

                if (storageData.type === 'folder') return true;

                const storageFileData = storageData as IFileInfo;

                const bytes = storageFileData.data.bytes.decrypted;
                if (bytes < minBytes || bytes > maxBytes) return false;

                return true;
            };

            const viewer = this._boardViewer;
            const view = viewer.current as GridView<A> | RowView<A> | TreeView<A>;
            view.setFilter(filter);

            if (setupTimeout === true)
            {
                this._intervalAssistant.start(() => 
                {
                    _.throwIfAborted();

                    this.log('Filter re-applied');

                    this.#applyFilter.execute();
                }, 1000 * 60, true);
            }
        }
        catch (error)
        {
            this._intervalAssistant.stop();

            return this._app.warn(error, 'Failed to apply filter', [], {names:[this.constructor, '#applyFilter']});
        }
    }, {throttle:125, delay:125, id:'applyFilter'});

    #getBytesDataByPercent = (percent:number):[number, string] =>
    {
        let data:[number, string];
        if (percent <= 33)
        {
            const kb = Math.round((percent / 33) * 1023);
            data = [kb, 'KBs'];
        }
        else if (percent <= 66)
        {
            const mb = Math.round(((percent - 33) / 33) * 1023);
            data = [mb, 'MBs'];
        }
        else if (percent <= 99)
        {
            const gb = Math.round(((percent - 66) / 33) * 1023);
            data = [gb, 'GBs'];
        }
        else data = [1, 'TBs'];

        return data;
    }

    #getBytesByBytesData = (data:[number, string]):number =>
    {
        if (data[1] === 'KBs') return data[0] * 1024;
        if (data[1] === 'MBs') return data[0] * 1024 * 1024;
        if (data[1] === 'GBs') return data[0] * 1024 * 1024 * 1024;
        
        return data[0] * 1024 * 1024 * 1024 * 1024;
    }

    #getLastModifiedDataByPercent = (percent:number):[number, string] =>
    {
        let data:[number, string];
        if (percent <= 20)
        {
            const minutes = Math.round((percent / 20) * 59);
            data = [minutes, 'minutes'];
        }
        else if (percent <= 40)
        {
            const hours = Math.round(((percent - 20) / 20) * 23);
            data = [hours, 'hours'];
        }
        else if (percent <= 60)
        {
            const days = Math.round(((percent - 40) / 20) * 29);
            data = [days, 'days'];
        }
        else if (percent <= 80)
        {
            const months = Math.round(((percent - 60) / 20) * 11);
            data = [months, 'months'];
        }
        else 
        {
            const years = Math.round(((percent - 80) / 20) * 10);
            data = [years, 'years'];
        }

        return data;
    }

    #getLastModifiedByLastModifiedData = (data:[number, string]):number =>
    {
        if (data[1] === 'minutes') return data[0] * 60 * 1000;
        if (data[1] === 'hours') return data[0] * 60 * 60 * 1000;
        if (data[1] === 'days') return data[0] * 24 * 60 * 60 * 1000;
        if (data[1] === 'months') return data[0] * 30 * 24 * 60 * 60 * 1000;
        
        return data[0] * 365 * 24 * 60 * 60 * 1000;
    }

    #initFilterOptionsPanel():void
    {
        const elements = this._elements;

        this._eventListenerAssistant.subscribe(elements.filterOptionsPanel, 'click', () =>
        {
            if (elements.filterOptionsPanel.classList.contains('open')) elements.filterOptionsPanel.classList.remove('open');
            else elements.filterOptionsPanel.classList.add('open');
        });

        new ButtonGroupAssistant(this._app, this, this._elements.typeButtons, async (button, index) => 
        {
            let filterType:typeof this._filterType;
            if (index === 0) filterType = undefined;
            if (index === 1) filterType = 'folder';
            if (index === 2) filterType = 'file';

            this._filterType = filterType;
            this.#applyFilter.execute();
        });

        const getPercentByData = (data:[number, string]):number =>
        {
            if (data[1] === 'KBs') return (data[0] / 1023) * 33;
            if (data[1] === 'MBs') return ((data[0] / 1023) * 33) + 33;
            if (data[1] === 'GBs') return ((data[0] / 1023) * 33) + 66;
            
            return 100;
        }

        const calculateNewPercent = (percent:number, direction:number):number|undefined =>
        {
            const data = this.#getBytesDataByPercent(percent);
            if (direction === -1) //left
            {
                if (data[1] === 'TBs')
                {
                    data[0] = 1023;
                    data[1] = 'GBs';
                    return getPercentByData(data);
                }

                if (data[0] > 1) 
                {
                    data[0] -= 1;
                    return getPercentByData(data);
                }

                switch (data[1])
                {
                    case 'KBs':
                        return undefined;
                    case 'MBs':
                        data[0] = 1023;
                        data[1] = 'KBs';
                        break;
                    case 'GBs':
                        data[0] = 1023;
                        data[1] = 'MBs';
                        break;
                    case 'TBs':
                        data[0] = 1023;
                        data[1] = 'GBs';
                        break;
                }

                return getPercentByData(data);
            }
            
            //right
            
            if (data[0] < 1023) 
            {
                data[0] += 1;
                return getPercentByData(data);
            }

            switch (data[1])
            {
                case 'KBs':
                    data[0] = 1;
                    data[1] = 'MBs';
                    break;
                case 'MBs':
                    data[0] = 1;
                    data[1] = 'GBs';
                    break;
                case 'GBs':
                    data[0] = 1;
                    data[1] = 'TBs';
                    break;
                case 'TBs':
                    return undefined;
            }

            return getPercentByData(data);
        }

        const bytesSlider = elements.bytesSlider.component as HMultiSlider<A>;
        const onThumbArrowSignal = (bytesSlider:HMultiSlider<A>, direction:number, percent:number, event:KeyboardEvent) =>
        {
            let count = event.shiftKey ? 10 : 1;
            let result:number | undefined = percent;
            let lastResult = undefined;

            while (count--)
            {
                result = calculateNewPercent(result, direction);

                if (result === undefined) return lastResult;

                lastResult = result;
            }
            
            return result;
        }
        bytesSlider.onThumbLeftArrowSignal.subscribe(this, onThumbArrowSignal);
        bytesSlider.onThumbRightArrowSignal.subscribe(this, onThumbArrowSignal);
        bytesSlider.onSlideSignal.subscribe(this, (bytesSlider, percentLeft, percentRight) =>
        {
            const format = (data:[number, string]):string =>
            {
                const [count, units] = data;

                if (count > 1) return units;

                return units.substring(0, units.length - 1);
            }

            const leftData = this.#getBytesDataByPercent(percentLeft);
            const rightData = this.#getBytesDataByPercent(percentRight);

            if (leftData.toString() === rightData.toString() && percentLeft !== 0 && percentRight !== 100)
            {
                if (leftData[0] <= 1) rightData[0] += 1;
                else leftData[0] -= 1;
            }

            let texts;

            //determining the text to display
            if (percentLeft === 0 && percentRight === 100) texts = ['Min', 'Max'];
            else if (percentRight === 100) texts = [`More than ${leftData[0] || 1} ${format(leftData)}`, ''];
            else if (percentLeft === 0) texts = [`Less than ${rightData[0] || 1} ${format(rightData)}`, ''];
            else if (leftData[1] === rightData[1]) texts = [`Between ${leftData[0] || 1} and ${rightData[0] || 1} ${format(leftData)}`, ''];
            else texts = [`Between ${leftData[0] || 1} ${format(leftData)} and ${rightData[0] || 1} ${format(rightData)}`, ''];

            bytesSlider.setLabels(texts[0], texts[1]);

            this.#applyFilter.execute();
        });

        const getPercentByData2 = (data:[number, string]):number =>
        {
            if (data[1] === 'minutes') return (data[0] / 59) * 20;
            if (data[1] === 'hours') return ((data[0] / 23) * 20) + 20;
            if (data[1] === 'days') return ((data[0] / 29) * 20) + 40;
            if (data[1] === 'months') return ((data[0] / 11) * 20) + 60;
            
            return ((data[0] / 10) * 20) + 80;
        }

        const calculateNewPercent2 = (percent:number, direction:number):number|undefined =>
        {
            const data = this.#getLastModifiedDataByPercent(percent);
            if (direction === -1) //left
            {
                if (data[0] > 1) 
                {
                    data[0] -= 1;
                    return getPercentByData2(data);
                }

                switch (data[1])
                {
                    case 'minutes':
                        return undefined;
                    case 'hours':
                        data[0] = 59;
                        data[1] = 'minutes';
                        break;
                    case 'days':
                        data[0] = 23;
                        data[1] = 'hours';
                        break;
                    case 'months':
                        data[0] = 29;
                        data[1] = 'days';
                        break;
                    case 'years':
                        data[0] = 11;
                        data[1] = 'months';
                        break;
                }

                return getPercentByData2(data);
            }
            
            //right
            data[0] += 1;

            switch (data[1])
            {
                case 'minutes':
                    if (data[0] > 59)
                    {
                        data[0] = 1;
                        data[1] = 'hours';
                    }
                    break;
                case 'hours':
                    if (data[0] > 23)
                    {
                        data[0] = 1;
                        data[1] = 'days';
                    }
                    break;
                case 'days':
                    if (data[0] > 29)
                    {
                        data[0] = 1;
                        data[1] = 'months';
                    }
                    break;
                case 'months':
                    if (data[0] > 11)
                    {
                        data[0] = 1;
                        data[1] = 'years';
                    }
                    break;
                case 'years':
                    if (data[0] > 10) return undefined;
            }

            return getPercentByData2(data);
        }
        
        const lastModifiedSlider = elements.lastModifiedSlider.component as HMultiSlider<A>;
        const onThumbArrowSignal2 = (lastModifiedSlider:HMultiSlider<A>, direction:number, percent:number, event:KeyboardEvent) =>
        {
            let count = event.shiftKey ? 10 : 1;
            let result:number | undefined = percent;
            let lastResult = undefined;
            
            while (count--)
            {
                result = calculateNewPercent2(result, direction);
               
                if (result === undefined) return lastResult;

                lastResult = result;
            }

            return result;
        };

        lastModifiedSlider.onThumbLeftArrowSignal.subscribe(this, onThumbArrowSignal2);
        lastModifiedSlider.onThumbRightArrowSignal.subscribe(this, onThumbArrowSignal2);
        lastModifiedSlider.onSlideSignal.subscribe(this, (lastModifiedSlider, percentLeft, percentRight) =>
        {   
            const format = (data:[number, string]):string =>
            {
                let [count, units] = data;

                switch (units)
                {
                    case 'minutes':
                        units = 'mins';
                        break;
                    case 'hours':
                        units = 'hrs';
                        break;
                    case 'years':
                        units = 'yrs';
                        break;
                }

                if (count > 1) return units;

                return units.substring(0, units.length - 1);
            }

            const leftData:[number, string] = this.#getLastModifiedDataByPercent(percentLeft);
            const rightData:[number, string] = this.#getLastModifiedDataByPercent(percentRight);

            if (leftData.toString() === rightData.toString() && percentLeft !== 0 && percentRight !== 100)
            {
                if (leftData[0] <= 1) rightData[0] += 1;
                else leftData[0] -= 1;
            }

            let texts;

            if (percentLeft === 0 && percentRight === 100) texts = ['Min', 'Max'];
            else if (percentRight === 100) texts =[`More than ${leftData[0] || 1} ${format(leftData)} ago`, ''];
            else if (percentLeft === 0) texts = [`Less than ${rightData[0] || 1} ${format(rightData)} ago`, ''];
            else if (leftData[1] === rightData[1]) texts = [`Between ${leftData[0] || 1} and ${rightData[0] || 1} ${format(rightData)} ago`, ''];
            else texts = [`Between ${leftData[0] || 1} ${format(leftData)} and ${rightData[0] || 1} ${format(rightData)} ago`, ''];

            lastModifiedSlider.setLabels(texts[0], texts[1]);

            this.#applyFilter.execute();
        });

        this._eventListenerAssistant.subscribe(elements.resetButton, 'click', () =>
        {
            this._filterType = undefined;

            bytesSlider.setValues(0, 100);
            lastModifiedSlider.setValues(0, 100);

            this.#applyFilter.execute();
        });
    }

    #initDisplayButtons():void
    {
        new ButtonGroupAssistant(this._app, this, this._elements.displayOptionButtons, async (button, index) => 
        {
            const viewer = this._boardViewer;

            const view = viewer.at(index) as GridView<A> | RowView<A> | TreeView<A>;
            view.setFilter(this._filter);

            await viewer.transition!.goto(view, () => view.setCurrentFolder.execute(this._currentFolder!));
        });
    }

    async #setCurrentFolder(folder:IDriveFolder<A>, clearForwardStack:boolean=true):Promise<void>
    {
        const _ = this.abortableHelper.throwIfAborted();

        const oldFolder = this._currentFolder;
        if (oldFolder === folder) return;

        const elements = this._elements;

        if (clearForwardStack) 
        {
            this._forwardStack = [];
            if (oldFolder !== undefined) this._backStack.push(oldFolder);
        }

        if (!this._forwardStack.length) elements.forwardButton.classList.add('disabled');
        else elements.forwardButton.classList.remove('disabled');

        if (!this._backStack.length) elements.backButton.classList.add('disabled');
        else elements.backButton.classList.remove('disabled');

        if (folder === this._drive.rootFolder) elements.upButton.classList.add('disabled');
        else elements.upButton.classList.remove('disabled');

        if (folder === this._homeFolder) elements.homeButton.classList.add('disabled');
        else elements.homeButton.classList.remove('disabled');

        const signalAssistant = this._signalAssistant;

        if (oldFolder)
        {
            signalAssistant.unsubscribe(oldFolder.onChildAddedSignal);
            signalAssistant.unsubscribe(oldFolder.onChildRemovedSignal);
        }
        this._currentFolder = folder;

        signalAssistant.subscribe(folder.onChildAddedSignal, async(folder, path) => 
        {
            const currentFolder = this._currentFolder;

            const info = _.value(await this._drive.getFileOrFolder(path.toString()).getInfo());
            if (info.metadata.hidden === true) return;

            if (currentFolder !== this._currentFolder) return; //if folder has changed, return early

            if (info.type === 'folder') 
            {
                if (info.compressed === true) this._archives++;
                else this._folders++;
            }
            else this._files++;

            this.#updateFooter();
        });
        signalAssistant.subscribe(folder.onChildRemovedSignal, async(folder, path) => 
        {
            const currentFolder = this._currentFolder;

            const info = _.value(await this._drive.getFileOrFolder(path.toString()).getInfo());
            if (info.metadata.hidden === true) return;

            if (currentFolder !== this._currentFolder) return; //if folder has changed, return early

            if (info.type === 'folder') 
            {
                if (info.compressed === true) this._archives--;
                else this._folders--;
            }
            else this._files--;

            this.#updateFooter();
        });

        const view = this._boardViewer.current as GridView<A> | RowView<A> | TreeView<A>;
        view.setCurrentFolder.execute(this._currentFolder!);
        
        await this.#updateContents.execute();
    }
    
    #updateContents = new DebounceAssistant(this, async(abortable:IAbortable):Promise<void | IAborted | IError> =>
    {
        try
        {
            if (this.initialized !== true) this._app.throw('Window not initialized', [], {correctable:true});

            const _ = this.createAbortableHelper(abortable).throwIfAborted();

            const abortController = new AbortController(this._app, [this, abortable]);

            const folder = this._currentFolder!;
            const path = folder.path;

            const childInfo:Array<IDriveFolderInfo | IDriveFileInfo> = [];
            for await (const info of folder.getChildrenInfo(abortController)) childInfo.push(_.value(info));

            if (this._currentFolder !== folder) return; //if folder has changed, return early

            this.#updatePath(path);

            let files = 0;
            let folders = 0;
            let archives = 0;
            for (const child of childInfo) 
            {
                if (child.type === 'folder') 
                {
                    if (child.compressed === true) archives++;
                    else folders++;
                }
                else files++;
            }

            this._files = files;
            this._folders = folders;
            this._archives = archives;

            this.#updateFooter();
        }
        catch (error)
        {
            return this._app.warn(error, 'Failed to update contents', [], {names:[this.constructor, '#updateContents']});
        }
    }, {throttle:true, delay:true, id:'updateContents'});

    #updatePath(path:FolderPath):void
    {
        const elements = this._elements;

        elements.pathTextField.value = path.toString();
    }

    #updateFooter():void
    {
        const folders = this._folders;
        const archives = this._archives;
        const files = this._files;
        const elements = this._elements;

        const folderString = (folders === 1) ? 'folder' : 'folders';
        const archiveString = (archives === 1) ? 'archive' : 'archives';
        const fileString = (files === 1) ? 'file' : 'files';

        let text = '';
        if (folders > 0) 
        {
            text = `${folders} ${folderString}`;
            if (archives > 0 && files > 0) text += ', ';
            else if (archives > 0 || files > 0) text += ' and ';
        }
        if (archives > 0)
        {
            text += `${archives} ${archiveString}`;
            if (files > 0) text += ' and ';
        }
        if (files > 0) text += `${files} ${fileString}`;

        if (text === '') text = '0 folders and 0 files';

        elements.footer.innerText = text;
    }

    #initResizeDivider():void
    {
        const elements = this._elements;

        new DragAssistant(this._app, this, elements.resizeDivider, () => {}, 
        () => 
        {
            return {momentum:{multiplier:50, threshold:5, max:40, duration:500, ease:easeOutQuad}};
        }, (dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number, deltaX:number, deltaY:number) => 
        { 
            let currentWidth = elements.sidebar.offsetWidth;

            let newWidth = currentWidth + deltaX;
            elements.sidebar.style.width = newWidth + 'px';
        }, () => {}, 0);
    }

    public override get appName() { return 'Files & Folders'; }
    public override get minWidth():number { return 525; }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}