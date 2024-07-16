/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 * 
 */

import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IBaseApp } from '../IBaseApp.ts';

export const enum BrowserType 
{
    Chrome,
    Firefox,
    Edge,
    Safari,
    Opera,
    Unknown,
}

@SealedDecorator()
export class BrowserUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public getType()
    {
        const userAgent = navigator.userAgent;
        if (userAgent.includes("OPR") || userAgent.includes("Opera")) return BrowserType.Opera;
        if (userAgent.indexOf("Firefox") > -1) return BrowserType.Firefox;
        if (userAgent.indexOf("Edge") > -1 || userAgent.indexOf("Edg") > -1) return BrowserType.Edge;
        if (userAgent.indexOf("Chrome") > -1) return BrowserType.Chrome;
        if (userAgent.indexOf("Safari") > -1) return BrowserType.Safari;
        
        return BrowserType.Unknown;
    }

    public isChromiumBased()
    {
        const userAgent = navigator.userAgent; 
        return userAgent.indexOf("Chrome") > -1;
    }

    public isFirefox()
    {
        const userAgent = navigator.userAgent; 
        return userAgent.indexOf("Firefox") > -1;
    }

    public isSafari()
    {
        const userAgent = navigator.userAgent; 
        return this.isChromiumBased() === false && userAgent.indexOf("Safari") > -1;
    }
}