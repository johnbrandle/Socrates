/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Component } from '../../Component.ts';
import type { IBaseApp } from '../../../IBaseApp.ts';
import { ComponentDecorator } from '../../../decorators/ComponentDecorator.ts';
import html from './Info.html';
import { DrawLineAssistant } from '../../../assistants/DrawLineAssistant.ts';
import type { IDestructor } from '../../../../../../../../shared/src/library/IDestructor.ts';
import type { IComponent } from '../../IComponent.ts';
import type { uid } from '../../../utils/UIDUtil.ts';

class Elements
{
    canvas!:HTMLCanvasElement;
}

@ComponentDecorator()
export class Info<A extends IBaseApp<A>> extends Component<A>
{
    #_drawLineAssistant!:DrawLineAssistant<A>;

    #_finalizationRegistry!:FinalizationRegistry<string>;
    #_componentMap:Map<uid, {values:{id:string, value:string}[], showing:boolean}> = new Map();

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html);
    }

    public override async init(...args:any[]):Promise<void> 
    {
        const elements = this._elements;

        this.set(elements);

        let promise = super.init();

        if (this._app.debugUtil.isDebug !== true)
        {
            this._element.style.display = 'none';
            return promise;
        }

        const componentMap = this.#_componentMap;
        this.#_finalizationRegistry = new FinalizationRegistry((uid:uid) => 
        {
            const componentData = componentMap.get(uid);
            if (componentData === undefined) return;

            const values = componentData.values;
            for (const value of values) this.#_drawLineAssistant.removeLine(uid + value.id);

            componentMap.delete(uid);
        });
       
        this.#_drawLineAssistant = new DrawLineAssistant(this._app, this, elements.canvas);

        return promise;
    }

    public show(component:IComponent<A>):void
    {
        if (this._app.debugUtil.isDebug !== true) return;

        const componentMap = this.#_componentMap;
        const drawLineAssistant = this.#_drawLineAssistant;

        if (componentMap.has(component.uid) === false) this.#addComponentToMap(component);

        const componentData = componentMap.get(component.uid)!;
        if (componentData.showing === true) return;

        componentData.showing = true;

        this.#_finalizationRegistry.register(component, component.uid, component);

        const values = componentData.values;
        for (const value of values) 
        {
            drawLineAssistant.addLine(component.uid + value.id);
            if (value.id) drawLineAssistant.write(component.uid + value.id, `${value.id}: ${value.value}`);
        }
    }

    public hide(component:IComponent<A>)
    {
        if (this._app.debugUtil.isDebug !== true) return;

        const componentMap = this.#_componentMap;
        const drawLineAssistant = this.#_drawLineAssistant;

        if (componentMap.has(component.uid) === false) this.#addComponentToMap(component);

        const componentData = componentMap.get(component.uid)!;
        if (componentData.showing === false) return;

        componentData.showing = false;

        this.#_finalizationRegistry.unregister(component.uid);

        const values = componentData.values;
        for (const value of values) drawLineAssistant.removeLine(component.uid + value.id);
    }

    public update(component:IComponent<A>, id:string, value:string)
    {
        if (this._app.debugUtil.isDebug !== true) return;

        const componentMap = this.#_componentMap;
        const drawLineAssistant = this.#_drawLineAssistant;

        if (componentMap.has(component.uid) === false) this.#addComponentToMap(component);

        const componentData = componentMap.get(component.uid)!;

        const values = componentData.values;
        const ids = values.map(value => value.id);
        const index = ids.indexOf(id);
        if (index === -1)
        {
            for (const id of ids) drawLineAssistant.removeLine(component.uid + id);

            values.push({id, value});

            for (const value of values) 
            {
                this.#_drawLineAssistant.addLine(component.uid + value.id);

                if (componentData.showing === false) continue;

                if (value.id) drawLineAssistant.write(component.uid + value.id, `${value.id}: ${value.value}`);
            }
        }
        else values[index].value = value;

        if (componentData.showing === false) return;

        drawLineAssistant.write(component.uid + id, id ? `${id}: ${value}` : '');
    }

    #addComponentToMap(component:IComponent<A>)
    {
        const componentMap = this.#_componentMap;

        const values = [{id:'component', value:component.className}];
        const componentData = {values, showing:false};
        componentMap.set(component.uid, componentData);
        for (const value of values) this.#_drawLineAssistant.addLine(component.uid + value.id);
    }

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}