/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IBaseApp } from "../IBaseApp";
import type { ITile } from "../components/board/ITile";
import { ITileType } from "../components/board/ITile";
import type { ITileData } from "../components/board/ITileData";
import type { ITileable } from "../components/board/ITileable";
import { ITileableType } from "../components/board/ITileable";
import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';

@SealedDecorator()
export class TileUtil<A extends IBaseApp<A>>  
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public get<A extends IBaseApp<A>, D extends ITileData, T extends ITile<A, D>>(element:HTMLElement, tileable:ITileable<A, D, T> | undefined):T | undefined
    {
        let target = element;
        while (target.parentElement)
        {
            const component = target.component;
            if (this._app.typeUtil.is<ITile<any, any>>(component, ITileType))
            {
                if (tileable === undefined) return component as T;
                if (component.tileable === tileable) return component as T;
            }
            
            target = target.parentElement;
        }

        return undefined;
    }

    public getTileable = (element:HTMLElement):ITileable<IBaseApp<any>, ITileData, ITile<IBaseApp<any>, ITileData>> | undefined =>
    {
        let target = element;
        while (target.parentElement)
        {
            let component = target.component;
            if (this._app.typeUtil.is<ITileable<any, any, any>>(component, ITileableType)) return component;
            
            target = target.parentElement;
        }

        return undefined;
    }
}