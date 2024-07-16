/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from "../IApp.ts";
import type * as WalletJSON from '../../../../../../shared/src/app/json/WalletJSON.ts';
import { ErrorJSONObject } from "../../../../../../shared/src/app/json/ErrorJSONObject.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";

export class WalletManager<A extends IApp<A>> extends DestructableEntity<A>
{
    constructor(app:A, destructor:IDestructor<A>) 
    {
        super(app, destructor);
    }

    public async walletCreateStandard():Promise<string | ErrorJSONObject>
    {
        let response = await this._app.networkManager.apiClient.wallet.createStandard({});
        if (response instanceof ErrorJSONObject) return response;

        return response.id;
    }

    public async walletCreateGift(json:WalletJSON.CreateGiftRequestJSON):Promise<WalletJSON.CreateGiftResponseJSON | ErrorJSONObject>
    {
        return this._app.networkManager.apiClient.wallet.createGift(json);
    }
}