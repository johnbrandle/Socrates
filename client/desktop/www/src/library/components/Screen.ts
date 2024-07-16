/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from '../IBaseApp.ts';
import type { IScreen } from './IScreen.ts';
import { ComponentDecorator } from '../decorators/ComponentDecorator.ts';
import { IScreenType } from './IScreen.ts';
import { TransientView } from './view/TransientView.ts';
import type { IDestructor } from '../../../../../../shared/src/library/IDestructor.ts';
import type { uid } from '../utils/UIDUtil.ts';
import { ImplementsDecorator } from '../../../../../../shared/src/library/decorators/ImplementsDecorator.ts';
import type { IDestructableEntity } from "../../../../../../shared/src/library/entity/IDestructableEntity.ts";
import type { IAbortable } from '../../../../../../shared/src/library/abort/IAbortable.ts';

@ComponentDecorator()
@ImplementsDecorator(IScreenType)
export abstract class Screen<A extends IBaseApp<A>, T extends IDestructableEntity<A>> extends TransientView<A> implements IScreen<A>
{
    protected _transient!:T;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, html?:string, uid?:uid) 
    {
        super(app, destructor, element, html, uid)

        this._element.setAttribute(app.componentUtil.transientAttributeName, '');
    }

    public override get isTransient():boolean { return true; }
    public override get transparent():boolean { return false; } //need to override this again, since view sets this to true

    public async dnit(partial:boolean):Promise<boolean>
    {
        if (await super.dnit(partial) !== true) return false; //if partial is true, this should never return false, as false is only returned if the obj has already been fully dnited

        //very important to call dnit, then clear the transient (otherwise the screen will be unloaded, but _transient, and everything it contains, will be held in memory)
        await this._transient?.dnit();
        this._transient = undefined!;

        return true;
    }

    protected override createAbortableHelper(_abortable:IAbortable):never
    {
        this._app.throw('Screens should not use abortables directly. Use then through transients instead.', [], {correctable:true});
    }
}