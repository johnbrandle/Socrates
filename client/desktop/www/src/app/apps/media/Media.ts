/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../IApp.ts';

import html from './Media.html';
import { Window, type IWindowDisplayOptions, type IWindowStorage } from '../../screens/explorer/window/Window.ts';
import { ComponentDecorator } from '../../../library/decorators/ComponentDecorator.ts';
import { WindowElements } from '../../screens/explorer/window/WindowElements.ts';
import { DragAssistant } from '../../assistants/DragAssistant.ts';
import { SignalAssistant } from '../../../library/assistants/SignalAssistant.ts';
import { easeOutQuad } from '../../../library/assistants/TweenAssistant.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import type { GridView } from './views/grid/GridView.ts';
import { Path, type filepath, type folderpath } from '../../../../../../../shared/src/library/file/Path.ts';
import type { IDriveFolder } from '../../../../../../../shared/src/library/file/drive/IDriveFolder.ts';
import type { ISystemDrive } from '../../../library/file/drive/ISystemDrive.ts';
import type { PreviewView } from './views/preview/PreviewView.ts';

class Elements extends WindowElements
{   
    //homeButton!:HTMLElement;
    //backButton!:HTMLElement;
    //forwardButton!:HTMLElement;
    //upButton!:HTMLElement;
    pathTextField!:HTMLInputElement;
    
    filterOptionsButton!:HTMLElement;
    filterOptionsPanel!:HTMLElement;
    typeButtons!:Array<HTMLButtonElement>;
    bytesSlider!:HTMLElement;
    lastModifiedSlider!:HTMLElement;
    resetButton!:HTMLElement;

    displayOptionButtons!:Array<HTMLButtonElement>;

    grid!:HTMLElement;
    gridView!:HTMLElement;

    resizeDivider!:HTMLElement;

    previewView!:HTMLElement;

    /*
    boardViewer!:HTMLElement;
    gridView!:HTMLElement;
    rowView!:HTMLElement;
    treeView!:HTMLElement;
    */

    footer!:HTMLElement;
}

@ComponentDecorator()
export class Media<A extends IApp<A>> extends Window<A>
{
    private _gridView!:GridView<A>;
    private _previewView!:PreviewView<A>;

    private _signalAssistant!:SignalAssistant<A>;

    private _drive!:ISystemDrive<A>;

    private _homeFolder!:IDriveFolder<A>;

    private _backStack:Array<IDriveFolder<A>> = [];
    private _forwardStack:Array<IDriveFolder<A>> = [];
    private _currentFolder?:IDriveFolder<A>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, appID:string, windowID:string, storage:IWindowStorage<A>, displayOptions?:IWindowDisplayOptions) 
    {
        super(app, destructor, element, appID, windowID, storage, displayOptions);
    }

	protected override preprocessHTML(element:HTMLElement):HTMLElement
	{ 
        element = super.preprocessHTML(element);
        
        const contentContainer = this.get<HTMLElement>('windowContent', element, false);
        if (!contentContainer) throw new Error('Could not find window content container');

        contentContainer.innerHTML = html;

        return element;
	}

    public override async init(..._args:any):Promise<void>
    {
        const elements = this._elements;

        this.set(elements);

        this._signalAssistant = new SignalAssistant(this._app, this);

        this._drive = this._app.userManager.systemDrive;
        this._homeFolder = this._drive.desktopFolder;

        this._gridView = this._elements.gridView.component as GridView<A>;
        this._previewView = this._elements.previewView.component as PreviewView<A>;

        const onTileClicked = (_view:any, fileOrFolderPath:folderpath | filepath) =>
        {
            if (Path.type(fileOrFolderPath) !== 'file') return;

            this._previewView.preview.execute(fileOrFolderPath as filepath);
        }
        this._gridView.onTileClickedSignal.subscribe(this, onTileClicked);

        this.title = this.appName; //set window title

        this.#initResizeDivider();

        return super.init();
    }

    public override async ready():Promise<void>
    {
        this.#setCurrentFolder(this._homeFolder);

        return super.ready();
    }

    #initResizeDivider():void
    {
        const elements = this._elements;

        new DragAssistant(this._app, this, elements.resizeDivider, () => {}, 
        () => 
        {
            return {momentum:{multiplier:50, threshold:5, max:40, duration:500, ease:easeOutQuad}};
        }, (_dragAssistant:DragAssistant<A>, event:PointerEvent, startX:number, startY:number, deltaX:number, deltaY:number) => 
        { 
            let currentWidth = elements.grid.offsetWidth;

            let newWidth = currentWidth + deltaX;
            elements.grid.style.width = newWidth + 'px';
        }, () => {}, 0);
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


        });
        signalAssistant.subscribe(folder.onChildRemovedSignal, async(folder, path) => 
        {
            const currentFolder = this._currentFolder;

            const info = _.value(await this._drive.getFileOrFolder(path.toString()).getInfo());
            if (info.metadata.hidden === true) return;

            if (currentFolder !== this._currentFolder) return; //if folder has changed, return early


        });

        const view = this._gridView;
        view.setCurrentFolder.execute(this._currentFolder!);
        
        //await this.#updateContents.execute();
    }

    public override get appName() { return 'Media'; }
    public override get minWidth():number { return 525; }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}