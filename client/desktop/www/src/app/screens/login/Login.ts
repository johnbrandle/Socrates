/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Screen } from '../../../library/components/Screen.ts';
import type { IApp } from '../../IApp.ts';
import html from './Login.html';
import { AppRouter } from '../../router/AppRouter.ts';
import type { KeyView } from './views/KeyView.ts';
import type { TOTPView } from './views/TOTPView.ts';
import { ComponentDecorator } from '../../../library/decorators/ComponentDecorator.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import { DestructableEntity } from '../../../../../../../shared/src/library/entity/DestructableEntity.ts';

class Elements 
{
    viewer!:HTMLDivElement;

    keyView!:HTMLDivElement;
    totpView!:HTMLDivElement;
}

class Transient<A extends IApp<A>> extends DestructableEntity<A>
{
    elements:Elements;

    keyView:KeyView<A>;
    totpView:TOTPView<A>;

    constructor(app:A, destructor:IDestructor<A>, elements:Elements)
    {
        super(app, destructor);

        this.elements = elements;

        this.keyView = elements.keyView.component as KeyView<A>;
        this.totpView = elements.totpView.component as TOTPView<A>;
    }
}

@ComponentDecorator()
export class Login<A extends IApp<A>> extends Screen<A, Transient<A>>
{
	constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
	{
		super(app, destructor, element, html);
	}

    public override async init(...args:any):Promise<void>
	{
        const elements = this._elements;

        this.set(elements);

        const transient = this._transient = new Transient(this._app, this, elements);
        
        await super.init();

        transient.keyView.login = this;
        transient.totpView.login = this;
	}

    public async gotoNextScreen():Promise<void>
    {
        await this._app.router.goto(AppRouter.ROUTE_CREATE);
    }

    public get keyView():KeyView<A>
    {
        return this._transient.keyView;
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}