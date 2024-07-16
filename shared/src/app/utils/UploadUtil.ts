/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from "../../library/decorators/SealedDecorator";
import { IBaseApp } from "../../library/IBaseApp";

export enum Tag
{
    PHOTO,
    VIDEO,
    MEDIA,
}

export enum PartSizeVersion
{
    Zero = 0
}

@SealedDecorator()
export class UploadUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public getMaxBytesPerPart(version:number, bytes:number):number
    {
        let minBlockSizeBytes:number;
        let maxBlockSizeBytes:number;

        const config = this._app.configUtil.get(true).classes.UploadUtil;

        switch(version)
        {
            case PartSizeVersion.Zero:
                minBlockSizeBytes = config.minBlockSize;
                maxBlockSizeBytes = config.maxBlockSize;

                const ratio = bytes / minBlockSizeBytes;
                const a = 1000000;

                let partSize = minBlockSizeBytes + (a * ratio);
            
                partSize = Math.min(maxBlockSizeBytes, Math.max(minBlockSizeBytes, partSize));
            
                return Math.floor(partSize);
        }

        throw new Error('invalid part size version');
    }

    public getUploadCost(bytes:number, parts:number, expiration:number, payForTillExpiration:number=0):number
    {
        const days = Math.max(1, expiration / 1000 * 60 * 60 * 24);

        if (days <= 7 && parts == 1) return 0;

        const gigabytes = Math.max(1, bytes / 1024 * 1024 * 1024);
        const payForTillDays = Math.max(2, payForTillExpiration / 1000 * 60 * 60 * 24);

        let result = parts + (Math.max(1, days - 6) * gigabytes); //7 days free
        if (payForTillExpiration > 0) result *= payForTillDays;

        return Math.ceil(result);
    }

    public getDownloadCost(bytes:number, parts:number, paidForTillExpiration:number):number
    {
        if (parts == 1) return 0;

        if (Date.now() - paidForTillExpiration > 0) return 0;

        return parts;
    }
}