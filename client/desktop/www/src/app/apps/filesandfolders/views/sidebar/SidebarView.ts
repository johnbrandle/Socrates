/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { View } from "../../../../../library/components/view/View";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import type { IApp } from "../../../../IApp";
import type { ISidebarTileData } from "./ISidebarTileData";

import html from './SidebarView.html';
import type { SidebarBoard } from "./SidebarBoard";
import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";

class Elements
{   
    board!:HTMLElement;
}

@ComponentDecorator()
export class SidebarView<A extends IApp<A>> extends View<A>
{
    private _board!:SidebarBoard<A, ISidebarTileData>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element, html)
    }

    public override async init():Promise<void>
    {
        const elements = this._elements;

        this.set(elements);

        this._board = elements.board.component as SidebarBoard<A, ISidebarTileData>;

        return super.init();
    }

    public setData(data:ISidebarTileData[]):void
    {
        //this._board.replace(data);
    }

    public override get transparent():boolean { return false; } //need to override this again, since view sets this to true

    protected override get _elements():Elements { return this.__elements ?? (this.__elements = new Elements()); }
}