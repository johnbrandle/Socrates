/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Screen } from '../../../library/components/Screen.ts';
import type { IApp } from '../../IApp.ts';
import html from './Explorer.html';
import { Desktop } from './desktop/Desktop.ts';
import { AppBar } from './appbar/AppBar.ts';
import type { ControlBar } from './controlbar/ControlBar.ts';
import type { IWindowable } from './window/IWindowable.ts';
import type { IStorage } from '../../../../../../../shared/src/library/storage/IStorage.ts';
import { SingleWindowManager } from './SingleWindowManager.ts';
import { MultiWindowManager } from './MultiWindowManager.ts';
import type { WindowManager } from './WindowManager.ts';
import { SessionStorage } from '../../../library/storage/SessionStorage.ts';
import { IWindowableType } from './window/IWindowable.ts';
import { ComponentDecorator } from '../../../library/decorators/ComponentDecorator.ts';
import type { IComponent } from '../../../library/components/IComponent.ts';
import type { IInitializer } from '../../../library/components/IInitializer.ts';
import { IInitializerType } from '../../../library/components/IInitializer.ts';
import { TransitionState } from '../../../library/components/view/transition/Transition.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import { DestructableEntity } from '../../../../../../../shared/src/library/entity/DestructableEntity.ts';
import { SignalAssistant } from '../../../library/assistants/SignalAssistant.ts';
import { Starlight } from './background/starlight/Starlight.ts';
import { FileType } from '../../../../../../../shared/src/library/file/drive/IDrive.ts';
import { DriveStorage } from '../../../../../../../shared/src/library/storage/DriveStorage.ts';
import { type uid } from '../../../library/utils/UIDUtil.ts';
import { ImplementsDecorator } from '../../../../../../../shared/src/library/decorators/ImplementsDecorator.ts';

class Elements 
{
    desktopArea!:HTMLElement;
    controlBar!:HTMLElement;
    desktop!:HTMLElement;
    appBar!:HTMLElement;

    selectionSVG!:SVGElement;

    windowContainer!:HTMLElement;

    background!:HTMLElement;
}

class Transient<A extends IApp<A>> extends DestructableEntity<A>
{
    elements:Elements;

    signalAssistant:SignalAssistant<A>;

    desktopComponent:Desktop<A>;
    appBarComponent:AppBar<A>;
    controlBarComponent:ControlBar<A>;

    storage!:DriveStorage<A>;
    //localStorage!:ISyncStorage<A>;
    sessionStorage!:IStorage<A>;

    windowManager!:WindowManager<A>;

    constructor(app:A, destructor:IDestructor<A>, elements:Elements)
    {
        super(app, destructor);

        this.elements = elements;

        this.signalAssistant = new SignalAssistant(app, this, destructor);

        this.desktopComponent = elements.desktop.component as Desktop<A>;
        this.appBarComponent = elements.appBar.component as AppBar<A>;
        this.controlBarComponent = elements.controlBar.component as ControlBar<A>; 
    }

    public async init()
    {
        const _ = this._.throwIfAborted();

        const explorer = this.destructor as Explorer<A>;
        const uid = explorer.uid;

        //syncing storage
        const explorerFolder = _.value(await this._app.userManager.systemDrive.systemFolder.createFolderIfNotExists('explorer',  {immutable:true, hidden:false, compressed:false, app:false, extra:{}}));

        const explorerJSONFile = _.value(await explorerFolder.createFileIfNotExists('explorer.json', {type:FileType.Other, immutable:false, hidden:false, compressed:false, app:false, extra:{}}, {}, this));
        if (explorerJSONFile === undefined) this._app.throw('Could not create explorer.json file', [], {correctable:true});

        const storage = this.storage = new DriveStorage(this._app, uid, this._app.userManager.systemDrive, explorerJSONFile.path);
        
        //local, non syncing storage, for storing window positions, etc. syncing storage, for storing settings, etc.
        //const localStorage = this.localStorage = this._app.userManager.getLocalStorage(this.uid); 

        //session storage, for storing temporary data, etc.
        const sessionStorage = this.sessionStorage = new SessionStorage(this._app, uid);

        const windowManagerUID = this._app.uidUtil.derive(uid, 'windowManager', true);

        //create window manager and storage for it. 
        const windowManagerStorage = new DriveStorage(storage, windowManagerUID);
        //const windowManagerLocalStorage = new DriveStorage(storage, this._uidUtil.generate(this._uid, 'windowManager', true);
        const windowManagerSessionStorage = new SessionStorage(sessionStorage, windowManagerUID);
        this.windowManager = await (this._app.environment.frozen.isSingleWindowMode === true ? new SingleWindowManager(this._app, this, windowManagerUID, explorer, windowManagerStorage, /*windowManagerLocalStorage*/ windowManagerSessionStorage) : new MultiWindowManager(this._app, this, windowManagerUID, explorer, windowManagerStorage, /*windowManagerLocalStorage,*/ windowManagerSessionStorage)).init();

        this.signalAssistant.subscribe(this.appBarComponent.onAppOpenSignal, this.#onAppOpen);
        this.signalAssistant.subscribe(this.controlBarComponent.onAppOpenSignal, this.#onAppOpen);

        const [backgroundComponent, promise] = this._app.componentFactory.createComponent(this, Starlight, [], [], [], {log:false});
        this.elements.background.appendChild(backgroundComponent.element);
        await promise;
    }

    public async ready()
    {
        await this.windowManager.ready();
    }

    #onAppOpen = async (_appbar:AppBar<A> | ControlBar<A>, id:string, x:number, y:number) => 
    {
        if (!id) this._app.throw('App id not found', []);

        this.windowManager.createWindow(id, undefined, {from:{left:x, top:y}, to:{}});
    }

    public get _()
    {
        return this.abortableHelper;
    }
}

let _singleton:Explorer<any> | undefined;

@ComponentDecorator()
@ImplementsDecorator(IWindowableType, IInitializerType)
export class Explorer<A extends IApp<A>> extends Screen<A, Transient<A>> implements IWindowable<A>, IInitializer
{
	constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
	{
        //verify that only one instance of Explorer is active. this is before super so we don't have an issue with this being added to the destructables set
        if (_singleton) app.throw('Only one Explorer instance can be active at a time', []);

        super(app, destructor, element, html, app.configUtil.get(true).classes.Explorer.frozen.uid as uid);

        //set this instance as the active instance
        _singleton = this;
	}

    public vnit():void
    {
        const elements = this._elements;

        this.set(elements);

        this._transient = new Transient<A>(this._app, this, elements);
    }
	
    public override async init(_this:IInitializer, component:IComponent<A>):Promise<void>; //this signature is used to initialize the child component, Desktop
    public override async init():Promise<void>;
	public override async init(...args:any):Promise<void>
	{
        try
        {
            if (args[0] === this) return (args[1] as Desktop<A>).init(this);

            await super.init();

            await this._transient.init();
        }
        catch (error)
        {
            this._app.rethrow(error, 'failed to initialize Explorer', [], {correctable:true});
        }
    }

    public override async fnit(_this:IInitializer, component:IComponent<A>):Promise<void>;
    public override async fnit():Promise<void>;
    public override async fnit(...args:any):Promise<void>
    {
        if (args[0] === this) return args[1].fnit();
        else return super.fnit();
    }

    public isInitializerForComponent(component:IComponent<A>):boolean 
    {
        return component === this._transient.desktopComponent;
    }

    public override async ready():Promise<void>
	{
        await super.ready();

        await this._transient.ready();
    }

    public getBounds():{left:number, top:number, right:number, bottom:number}
    {
        return {left:10, right:this._element.offsetWidth - 10, top:this._transient.controlBarComponent.element.offsetHeight, bottom:this._element.offsetHeight - this._transient.appBarComponent.element.offsetHeight - 10};
    }

    public get windowManager():WindowManager<A>
    {
        return this._transient.windowManager;
    }

    public get desktopArea():HTMLElement
    {
        return this._transient.elements.desktopArea;
    }

    public get windowContainer():HTMLElement
    {
        return this._transient.elements.windowContainer;
    }

    public get selectionSVG():SVGElement
    {
        return this._transient.elements.selectionSVG;
    }
    
    protected override onTransition(state:TransitionState):void
    {
        //fade in and out the stars
        //if (state === TransitionState.ToBefore) this._app.environment.progress.fadeOut(60);
        //else if (state === TransitionState.FromBefore) this._app.environment.progress.fadeIn(60);
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }

    public override async dnit(partial:boolean):Promise<boolean>
    {
        if (await super.dnit(partial) !== true) return false;

        _singleton = undefined; //so we can create another instance of Explorer

        return true;
    }
}