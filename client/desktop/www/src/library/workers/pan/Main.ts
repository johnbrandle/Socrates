/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { BaseApp } from "../BaseApp.ts";
import type { IBaseApp } from "../IBaseApp.ts";
import { Worker, type Task } from "../Worker.ts";
import { PanDrawTask } from "./Shared.ts";

const app = new (class extends BaseApp<IBaseApp<any>> 
{
})();
type A = typeof app;

class Main extends Worker<A>
{
    private _canvasLarge!:OffscreenCanvas;
    private _canvasSmall!:OffscreenCanvas;

    protected async execute(task:Task):Promise<any>
    {    
        try
        {
            switch (task.name)
            {
                case PanDrawTask.init:
                    this._canvasLarge = task.args.largeCanvas;
                    this._canvasSmall = task.args.smallCanvas;

                    task.result = true;
                    break;
                case PanDrawTask.draw:
                {
                    const widthLarge = task.args.widthLarge as number;
                    const heightLarge = task.args.heightLarge as number;
                    const widthSmall = task.args.widthSmall as number;
                    const heightSmall = task.args.heightSmall as number;
                    const tileMargin = task.args.tileMargin as number;
                    const zoom = task.args.zoom as number;
                    const visibleTileInfo = task.args.visibleTileInfo as Record<string, any>;
                    const gridCanvasNavigationViewScaleFactor = task.args.gridCanvasNavigationViewScaleFactor as number;

                    this.#draw(widthLarge, heightLarge, widthSmall, heightSmall, tileMargin, zoom, visibleTileInfo, gridCanvasNavigationViewScaleFactor);
                    
                    task.result = true;
                    break;
                }
                default:
                    console.warn('Unknown task:', task.name);
            }
        }
        catch(error) 
        {
            console.warn(error);
        }
        finally
        {
            this.end(task);
        }
    }

    #draw(widthLarge:number, heightLarge:number, widthSmall:number, heightSmall:number, tileMargin:number, zoom:number, visibleTileInfo:Record<string, any>, gridCanvasNavigationViewScaleFactor:number):void
    {
        if (!widthLarge || !heightLarge) return;
        
        //draw the large zoomed out master canvas first (we use this to draw the other canvases, but we will need to scale/crop for them)
        let canvas = new OffscreenCanvas(widthLarge, heightLarge);
        let context = canvas.getContext('2d', {alpha:true});

        if (!context) return;

        context.fillStyle = "#fff";
        context.imageSmoothingEnabled = false;
        context.fillRect(0, 0, canvas.width, canvas.height);
        let pixelOffset = Math.round(tileMargin * zoom);
        
        for (let i = visibleTileInfo.length; i--;)
        {
            let info = visibleTileInfo[i];
        
            let metaData = info.metaData ?? {};
            if (metaData.primaryColor) context.fillStyle = metaData.primaryColor;
            else context.fillStyle = "#fcfcfc";
            
            let x = info.x + (pixelOffset / 2);
            let y = info.y + (pixelOffset / 2);
            let width = info.width - pixelOffset;
            let height = info.height - pixelOffset;

            context.fillRect(Math.round(x / gridCanvasNavigationViewScaleFactor), Math.round(y / gridCanvasNavigationViewScaleFactor), Math.round(width / gridCanvasNavigationViewScaleFactor), Math.round(height / gridCanvasNavigationViewScaleFactor)); //expensive operation, round to prevent aliasing issues
        }	

        requestAnimationFrame(() => 
        {
            let bitmap:ImageBitmap;
            try
            {
                bitmap = canvas.transferToImageBitmap(); //very expensive operation, so do this in a requestAnimationFrame
            }
            catch(e) 
            {
                return;
            }

            ///this is the large canvas, we need to crop it, so it is the correct zoom level
            canvas = this._canvasLarge;	
            if (canvas.width != widthLarge) canvas.width = widthLarge;
            if (canvas.height != heightLarge) canvas.height = heightLarge;
            context = canvas.getContext('2d', {alpha:true});

            if (!context) return;

            context.imageSmoothingEnabled = false;
        
            let virtualBox = {x:0, y:0, width:0, height:0};
            virtualBox.x = (canvas.width - (canvas.width / gridCanvasNavigationViewScaleFactor)) / 2;
            virtualBox.y = (canvas.height - (canvas.height / gridCanvasNavigationViewScaleFactor)) / 2;
            virtualBox.width = canvas.width / gridCanvasNavigationViewScaleFactor;
            virtualBox.height = canvas.height / gridCanvasNavigationViewScaleFactor;
            context.drawImage(bitmap, Math.round(virtualBox.x), Math.round(virtualBox.y), Math.round(virtualBox.width), Math.round(virtualBox.height), 0, 0, canvas.width, canvas.height);
        
            ///this is the small navigator canvas, we need only scale this
            canvas = this._canvasSmall;	
            if (canvas.width != widthSmall) canvas.width = widthSmall;
            if (canvas.height != heightSmall) canvas.height = heightSmall;
            context = canvas.getContext('2d', {alpha:false});

            if (!context) return;

            context.imageSmoothingEnabled = false;
            context.save();
            context.scale(widthSmall / widthLarge, heightSmall / heightLarge);
            context.drawImage(bitmap, 0, 0);
            context.restore();

            ///figure out where the normal size canvas would be, and draw a dotted line to show where it is
            virtualBox.x = (canvas.width - (canvas.width / gridCanvasNavigationViewScaleFactor)) / 2;
            virtualBox.y = (canvas.height - (canvas.height / gridCanvasNavigationViewScaleFactor)) / 2;
            virtualBox.width = canvas.width / gridCanvasNavigationViewScaleFactor;
            virtualBox.height = canvas.height / gridCanvasNavigationViewScaleFactor;	
            context.strokeStyle = "#bbb";
            context.setLineDash([6, 8]);
            context.strokeRect(virtualBox.x, virtualBox.y, virtualBox.width, virtualBox.height);
        });	
    }
}

new Main(app);