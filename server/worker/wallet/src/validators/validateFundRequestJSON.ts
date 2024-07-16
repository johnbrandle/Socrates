/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { FundRequestJSON } from "../../../../../shared/src/app/json/WalletJSON.ts";
import { IApp } from "../../../shared/src/app/IApp.ts";

const EXPECTED_PROPERTY_COUNT = 2;

export function validateFundRequestJSON<A extends IApp<A>>(app:IApp<A>, json:FundRequestJSON):Response | FundRequestJSON
{
    const ValidatorUtil = app.validatorUtil;

    return ValidatorUtil.notNull(json)
    ?? ValidatorUtil.hasPropertyCount(json, EXPECTED_PROPERTY_COUNT)
    ?? ValidatorUtil.isCurrency(json.fundValue, 0, 100000) //zero means this transaction isn't real (no money was involved)
    ?? ValidatorUtil.isID(json.id)
    ?? json;
}