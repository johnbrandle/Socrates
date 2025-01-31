/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Screen } from '../../../library/components/Screen.ts';
import type { IApp } from '../../IApp.ts';
import html from './Experiment.html';
import { ComponentDecorator } from '../../../library/decorators/ComponentDecorator.ts';
import type { IDestructor } from '../../../../../../../shared/src/library/IDestructor.ts';
import { DestructableEntity } from '../../../../../../../shared/src/library/entity/DestructableEntity.ts';

class Elements 
{
}

class Transient<A extends IApp<A>> extends DestructableEntity<A>
{
    elements:Elements;

    constructor(app:A, destructor:IDestructor<A>, elements:Elements)
    {
        super(app, destructor);

        this.elements = elements;
    }
}

@ComponentDecorator()
export class Experiment<A extends IApp<A>> extends Screen<A, Transient<A>>
{
	constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
	{
		super(app, destructor, element, html);
	}
	
    public override async init(...args:any):Promise<void>
	{
        const elements = this._elements;

        this.set(elements);

        this._transient = new Transient(this._app, this, elements); 

        await super.init();
    }

    public override async ready():Promise<void>
	{
        await super.ready();

        //code here

        //CorrectableError.throw('testkljfd');

        //console.log('object', object);

        //object.test();
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}