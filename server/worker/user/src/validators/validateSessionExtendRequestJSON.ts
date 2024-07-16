/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SessionExtendRequestJSON } from "../../../../../shared/src/app/json/UserJSON.ts";
import { IApp } from "../../../shared/src/app/IApp.ts";

const EXPECTED_PROPERTY_COUNT = 2;

export function validateSessionExtendRequestJSON<A extends IApp<A>>(app:IApp<A>, json:SessionExtendRequestJSON, expectedPropertyCount:number=EXPECTED_PROPERTY_COUNT):Response | SessionExtendRequestJSON
{
    return app.validatorUtil.notNull(json)
    ?? app.validatorUtil.hasPropertyCount(json, expectedPropertyCount)
    ?? app.validatorUtil.isID(json.id)
    ?? app.validatorUtil.isID(json.userID)
    ?? json;
}