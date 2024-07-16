/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../../../../../../shared/src/library/decorators/SealedDecorator";
import type { IBaseApp } from "../../library/IBaseApp";

@SealedDecorator()
export class DataUtil<A extends IBaseApp<A>> 
{   
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public download(fileName:string, data:string):void
    {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data));
        element.setAttribute('download', fileName);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    public print(title:string, element:HTMLElement, callback?:(window:Window) => void) 
    {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.head.innerHTML = document.head.innerHTML;
        printWindow.document.head.getElementsByTagName('title')[0].textContent = title;
        printWindow.document.body.style.minHeight = 'unset';
        printWindow.document.body.appendChild(element);
        
        let styles = document.body.getElementsByTagName('style');
        const domUtil = this._app.domUtil;
        for (let i = 0; i < styles.length; i++) printWindow.document.body.appendChild(domUtil.clone(styles[i], {clearIDs:false}));

        printWindow.document.close();

        //get all images in the body
        let images = printWindow.document.getElementsByTagName('img');
    
        if (images.length === 0) 
        {
            printWindow.print();
            if (callback) callback(printWindow);
            return;
        } 
        
        let imagesLoaded = 0;
        for (let i = 0; i < images.length; i++)
        {
            //add onload event to each image
            images[i].onload = () => 
            {
                imagesLoaded++;
                
                if(imagesLoaded !== images.length) return;
                
                printWindow.print(); //when all images have loaded, print the window
                if (callback) callback(printWindow);
            }
        }
    }
    
    public async copyToClipboard(data:string):Promise<boolean>
    {
        try 
        {
            await navigator.clipboard.writeText(data);

            return true;
        } 
        catch (error) 
        {
            return false; 
        }
    }
}