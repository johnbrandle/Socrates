/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IDestructor } from "../../../../../../../../../shared/src/library/IDestructor";
import { Component } from "../../../../../library/components/Component";
import { ComponentDecorator } from "../../../../../library/decorators/ComponentDecorator";
import type { IApp } from "../../../../IApp";
import type { SpaceOptions } from "../../../../workers/desktop/background/starlight/Options";
import { StarlightBackgroundWorkerController } from "../../../../workers/desktop/background/starlight/StarlightBackgroundWorkerController";
import { GlobalEvent } from "../../../../../library/managers/GlobalListenerManager";
import type { Performance } from "../../../../../library/managers/IPerformanceManager";

@ComponentDecorator()
export class Starlight<A extends IApp<A>> extends Component<A>
{
    private _canvas:HTMLCanvasElement | undefined;

    private _starlightBackgroundWorkerController!:StarlightBackgroundWorkerController<A>;

    constructor(app:A, destructor:IDestructor<A>, element:HTMLElement) 
    {
        super(app, destructor, element);

        element.style.width = '100%';
        element.style.height = '100%';

        this._starlightBackgroundWorkerController = new StarlightBackgroundWorkerController(app, this, this);
    }

    protected override async onShow(initial:boolean, entry:IntersectionObserverEntry, style:CSSStyleDeclaration):Promise<void>
    {
        if (initial === false) return;

        const spaceOptions:SpaceOptions = {motionBlur:.40, isMobile:self.environment.frozen.isMobile};

        const element = this._element;
        const canvas = this._canvas = document.createElement('canvas');
        canvas.width = element.offsetWidth;
        canvas.height = element.offsetHeight;
        element.append(canvas);

        const offscreen = canvas.transferControlToOffscreen();
        
        const worker = this._starlightBackgroundWorkerController;

        await worker.init(offscreen, spaceOptions, document.visibilityState, document.hasFocus(), this._app.performanceManager.recommended);
        
        if (self.environment.frozen.isMobile) this._app.globalListenerManager.subscribe(this, GlobalEvent.DeviceOrientation, (event:DeviceOrientationEvent) => worker.beta(event.beta ?? 0, event.gamma ?? 0));
        this._app.globalListenerManager.subscribe(this, GlobalEvent.VisibilityChange, (event:Event) => worker.visibilityState(document.visibilityState));

        this._app.performanceManager.onRecommendedSignal.subscribe(this, (performance:Performance) => worker.performance(performance));

        this._app.globalListenerManager.subscribe(this, GlobalEvent.Blur, (event:Event) => this._starlightBackgroundWorkerController.hasFocus(false));
        this._app.globalListenerManager.subscribe(this, GlobalEvent.Focus, (event:Event) => this._starlightBackgroundWorkerController.hasFocus(true));
        this._app.globalListenerManager.subscribe(this, GlobalEvent.Resize, (event:Event) => this._starlightBackgroundWorkerController.size(this._element.offsetWidth, this._element.offsetHeight));
        this._app.globalListenerManager.subscribe(this, GlobalEvent.Move,(event:PointerEvent) => this._starlightBackgroundWorkerController.page(event.pageX, event.pageY));

        await worker.add(
        {
            type:'random',
            density:200000,
            proximity:100,
            parallax:.0175,
            
            color:"255, 255, 255",
            opacity:1,
            radius:{min:2, max:3},

            speed:{min:0.02, max:0.03},
        });
        
        await worker.add(
        {
            type:'random',
            density:15000,
            proximity:100,
            parallax:.015,
             
            color:"255, 255, 255",
            opacity:.55,
            radius:{min:1.25, max:2},

            speed:{min:0.01, max:0.02},
        });

        await worker.add(
        {
            type:'random',
            density:3000,
            proximity:50,
            parallax:.0125,

            color:"255, 255, 255",
            opacity:.55,
            radius:{min:.50, max:1.25},

            speed:{min:0.002, max:0.01},
        });

        /* todo, maybe do this, and maybe add random shooting star field type
        worker.add(
        {
            type:'constellation',
            density:3000,
            proximity:50,
            parallax:.0125,

            color:"255, 255, 255",
            opacity:.55,
            radius:{min:.50, max:1.25},
            
            lineColor:"255, 255, 255",
            lineOpacity:0.105,
            lineWidth:.5,

            speed:{min:0.002, max:0.01},
        });
        */

        await worker.fadeIn(15);
    }

    #init(options:SpaceOptions)
    {
    }

    public shift(x:number, y:number)
    {
        this._starlightBackgroundWorkerController.shift(x, y);
    }

    public rotate(degrees:number)
    {
        this._starlightBackgroundWorkerController.rotate(degrees);
    }

    public fadeIn(frames:number)
    {
        this._starlightBackgroundWorkerController.fadeIn(frames);
    }

    public fadeOut(frames:number)
    {
        this._starlightBackgroundWorkerController.fadeOut(frames);
    }

    public setPerformance(performance:Performance)
    {
        this._starlightBackgroundWorkerController.performance(performance);
    }
}