/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from '../../IApp.ts';
import { ErrorJSONObject } from '../../../../../../../shared/src/app/json/ErrorJSONObject.ts';
import type * as UserJSON from '../../../../../../../shared/src/app/json/UserJSON.ts';

export class UserAPI<A extends IApp<A>> 
{
    private _app:A;

    constructor(app:A)
    {
        this._app = app;
    }

    public async ping(json:UserJSON.PingRequestJSON):Promise<UserJSON.PingResponseJSON | ErrorJSONObject>
    {
        const app = this._app;
        const response = await this._app.networkManager.apiClient.call<UserJSON.PingRequestJSON, UserJSON.PingResponseJSON>(app.apiUtil.names.user, app.apiUtil.endpoints.user.ping, json);
        return (response instanceof ErrorJSONObject) ? response : response.json;
    }

    public async register(json:UserJSON.RegisterRequestJSON):Promise<UserJSON.RegisterResponseJSON | ErrorJSONObject>
    {
        const app = this._app;
        const response = await this._app.networkManager.apiClient.call<UserJSON.RegisterRequestJSON, UserJSON.RegisterResponseJSON>(app.apiUtil.names.user, app.apiUtil.endpoints.user.register, json);
        return (response instanceof ErrorJSONObject) ? response : response.json;
    }

    public async login(json:UserJSON.LoginRequestJSON):Promise<UserJSON.LoginResponseJSON | ErrorJSONObject>
    {
        const app = this._app;
        const response = await this._app.networkManager.apiClient.call<UserJSON.LoginRequestJSON, UserJSON.LoginResponseJSON>(app.apiUtil.names.user, app.apiUtil.endpoints.user.login, json);
        return (response instanceof ErrorJSONObject) ? response : response.json;
    }

    public async createSession(json:UserJSON.SessionCreateRequestJSON):Promise<UserJSON.SessionCreateResponseJSON | ErrorJSONObject>
    {
        const app = this._app;
        const response = await this._app.networkManager.apiClient.call<UserJSON.SessionCreateRequestJSON, UserJSON.SessionCreateResponseJSON>(app.apiUtil.names.user, app.apiUtil.endpoints.user.session.create, json);
        return (response instanceof ErrorJSONObject) ? response : response.json;       
    }

    public async resumeSession(json:UserJSON.SessionResumeRequestJSON):Promise<UserJSON.SessionResumeResponseJSON | ErrorJSONObject>
    {
        const app = this._app;
        const response = await this._app.networkManager.apiClient.call<UserJSON.SessionResumeRequestJSON, UserJSON.SessionResumeResponseJSON>(app.apiUtil.names.user, app.apiUtil.endpoints.user.session.resume, json);
        return (response instanceof ErrorJSONObject) ? response : response.json;       
    }
}