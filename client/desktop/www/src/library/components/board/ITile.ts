/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IComponent } from '../IComponent.ts';
import type { ITileData } from './ITileData.ts';
import type { ISignal } from '../../../../../../../shared/src/library/signal/ISignal.ts';
import type { ITileable } from './ITileable.ts';
import type { IBaseApp } from '../../IBaseApp.ts';
import type { IDraggable } from '../IDraggable.ts';
import type { IAbortable } from '../../../../../../../shared/src/library/abort/IAbortable.ts';

export const ITileType = Symbol("ITile");

export interface ITile<A extends IBaseApp<A>, D extends ITileData> extends IComponent<A>, IDraggable
{
    renew(data:D | undefined, abortable:IAbortable):Promise<any>;

    setPosition(x:number, y:number):void;
    setScale(scale:number):void;
    setSize(width:number, height:number):void;

    get id():string;
    
    get x():number;
    get y():number;
    
    get width():number;
    get height():number;
    
    get scale():number;
    get scaledWidth():number;
    get scaledHeight():number;
    
    set selected(val:boolean);
    get selected():boolean;

    get element():HTMLElement;
    get data():D;

    get tileable():ITileable<A, D, any>;

    get onClickedSignal():ISignal<[this, Event]>;
    get onDoubleClickedSignal():ISignal<[this, Event]>;
    get onRightClickedSignal():ISignal<[this, Event]>;
    
    get onDragStartSignal():ISignal<[this, dragEvent:DragEvent]>;
    get onDragSignal():ISignal<[this, dragEvent:DragEvent]>;
    get onDragEndSignal():ISignal<[this, dragEvent:DragEvent]>;

    get onDragEnterSignal():ISignal<[this, dragEvent:DragEvent]>;
    get onDragOverSignal():ISignal<[this, dragEvent:DragEvent]>;
    get onDragLeaveSignal():ISignal<[this, dragEvent:DragEvent]>;
    get onDropSignal():ISignal<[this, dragEvent:DragEvent]>;
}