/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from '../../IBaseApp.ts';
import { ComponentDecorator } from '../../decorators/ComponentDecorator.ts';
import { View } from './View.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import { IViewerType, type IViewer } from './IViewer.ts';
import type { uid } from '../../utils/UIDUtil.ts';

@ComponentDecorator()
export class TransientView<A extends IBaseApp<A>> extends View<A>
{
    private _fullDnitCalled = false;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement, html?:string, uid?:uid) 
    {
        super(app, destructor, element, html, uid);
    }

    /**
     * @forceSuperTransformer_forceSuperCall
     */
    public override pnit(...args:any):void
    {
        super.pnit();
    }

    public override async init():Promise<void>
    { 
        await super.init();

        if (this._app.typeUtil.is<IViewer<A>>(this.parent, IViewerType) !== true) this._app.throw('a transient view\'s parent must be a viewer', []);
    }

    public override async ready():Promise<void>
    {
        //NOTE:
        //be careful with transient views, they try to load themselves in load, which calls fnit...so
        //if fnit is waiting on load to finish, and load is waiting on fnit to finish, you will have a deadlock
        //we are checking if the showPromise and loadPromise are undefined to prevent this, but we may need to make this more robust
        //possibly by disallowing transient views from loading themselves in fnit, and instead, requiring them to be loaded by their parent
        //a potential robust solution would be to disallow transient views from being base views (views with no parent view)
        //for now the promise check seems sufficent, but will need to revisit this if we run into issues

        super.ready(); //see the parent ready method for why this is a concern
    }

    protected override async doLoad():Promise<void> 
    {
        if (this.isTransient === true) await this._app.componentFactory.loadTransientComponent(this); //set the inner html, create the components within, verify this component, and initialize this component (note: child components will be verified and initialized automatically by createComponentsWithinElement unless the child is transient, in which case, it is expected to handle this itself at the corrent moment)
    }

    protected override async doUnload():Promise<void> 
    {
        if (this._fullDnitCalled === true) return; //we are already dniting, don't do it again, otherwise we will be calling dnitpartial after dnit full, which is not allowed
        if (this.isTransient === true) await this.dnit(true);
    }

    public override async dnit(partial:boolean):Promise<boolean>
    {
        if (partial !== true) this._fullDnitCalled = true;
        if (await super.dnit(partial) !== true) return false;

        return true;
    }

    public get isTransient():boolean { return this._element.hasAttribute(this._app.componentUtil.transientAttributeName); }
}