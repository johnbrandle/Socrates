/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../IApp.ts';
import { ErrorJSONObject } from '../../../../../../../shared/src/app/json/ErrorJSONObject.ts';
import type * as WalletJSON from '../../../../../../../shared/src/app/json/WalletJSON.ts';

export class WalletAPI<A extends IApp<A>> 
{
    private _app:A;

    constructor(app:A)
    {
        this._app = app;
    }

    public async createStandard(json:WalletJSON.CreateRequestJSON):Promise<WalletJSON.CreateResponseJSON | ErrorJSONObject>
    {
        const app = this._app;
        const response = await this._app.networkManager.apiClient.call<WalletJSON.CreateRequestJSON, WalletJSON.CreateResponseJSON>(app.apiUtil.names.wallet, app.apiUtil.endpoints.wallet.create.standard, json);
        
        return (response instanceof ErrorJSONObject) ? response : response.json;
    }

    public async createGift(json:WalletJSON.CreateGiftRequestJSON):Promise<WalletJSON.CreateGiftResponseJSON | ErrorJSONObject>
    {
        const app = this._app;
        const response = await this._app.networkManager.apiClient.call<WalletJSON.CreateGiftRequestJSON, WalletJSON.CreateGiftResponseJSON>(app.apiUtil.names.wallet, app.apiUtil.endpoints.wallet.create.gift, json);
        
        return (response instanceof ErrorJSONObject) ? response : response.json;
    }
}