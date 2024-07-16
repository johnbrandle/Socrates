/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 */

import type { IBaseApp } from "../IBaseApp.ts";
import { OnDestruct } from "../../../../../../shared/src/library/IDestructable.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import type { IObservable } from "../../../../../../shared/src/library/IObservable.ts";
import { SignalAssistant } from "../assistants/SignalAssistant.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";
import type { IDrive } from "../../../../../../shared/src/library/file/drive/IDrive.ts";
import { IFileSystemManagerType, type IFileSystemManager } from "./IFileSystemManager.ts";
import { ImplementsDecorator } from "../../../../../../shared/src/library/decorators/ImplementsDecorator.ts";

@ImplementsDecorator(IFileSystemManagerType)
export class FileSystemManager<A extends IBaseApp<A>> extends DestructableEntity<A> implements IFileSystemManager<A>
{
    private _mountedDrives:Set<IDrive<A>> = new Set();

    private _signalAssistant:SignalAssistant<A> = new SignalAssistant(this.app, this, this);

    constructor(app:A, destructor:IDestructor<A>)
    {
        super(app, destructor);
    }

    public async mount(drive:IDrive<A>):Promise<boolean>
    {
        for (const mountedDrive of this._mountedDrives)
        {
            //ensure we don't mount the same uid twice
            //we could just check the reference, but this is much safer
            if (mountedDrive.uid !== drive.uid) continue;
            
            this._app.throw('Drive with uid is already mounted', [drive.uid]);
            return false;
        }

        this._mountedDrives.add(drive);
        this._signalAssistant.subscribe(drive.onChangeSignal, this.onDriveChange, true); //listen for the drive to be dnited so we can auto-unmount it

        return true;
    }

    public async unmount(drive:IDrive<A>):Promise<boolean>
    {
        if (this._mountedDrives.has(drive) === false)
        {
            this._app.throw('Drive with uid is not mounted', [drive.uid]);
            return false;
        }
        
        this._mountedDrives.delete(drive);
        this._signalAssistant.unsubscribe(drive.onChangeSignal);

        return true;
    }

    private onDriveChange(observable:IObservable<A>, type:Symbol, changed:JsonObject | undefined):void
    {
        if (type !== OnDestruct) return;

        this._mountedDrives.delete(observable as IDrive<A>);
    }
}