/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { CreateGiftRequestJSON, WalletCashGiftCardValue } from "../../../../../shared/src/app/json/WalletJSON.ts";
import { IApp } from "../../../shared/src/app/IApp.ts";

const EXPECTED_PROPERTY_COUNT = 2;

export function validateCreateGiftRequestJSON<A extends IApp<A>>(app:IApp<A>, json:CreateGiftRequestJSON):Response | CreateGiftRequestJSON
{
    const ValidatorUtil = app.validatorUtil;

    let result = ValidatorUtil.notNull(json)
    ?? ValidatorUtil.hasPropertyCount(json, EXPECTED_PROPERTY_COUNT)
    ?? ValidatorUtil.isEnum(json.activationValue, WalletCashGiftCardValue)
    ?? ValidatorUtil.isCurrency(json.activationValue, 1, 100000); //we don't allow zero values when creating a gift
    if (app.stringUtil.isEmpty(json.onActivationTransferToWalletID) === false) result ??= ValidatorUtil.isID(json.onActivationTransferToWalletID); //optional

    return result ?? json;
}