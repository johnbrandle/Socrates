/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { base64 } from "../../library/utils/BaseUtil";
import type { hex_256, hex_512 } from "../../library/utils/HashUtil";
import type { emptystring } from "../../library/utils/StringUtil";
import type { totp, totpsecret } from "../utils/TOTPUtil";

export interface PingRequestJSON
{
}

export interface PingResponseJSON
{
}

export interface LoginRequestJSON extends CredentialsJSON
{
}

export interface LoginResponseJSON extends UserResponseJSON
{
    loginToken:hex_256;
    encrypted:base64;
}

export interface RegisterRequestJSON extends CredentialsJSON
{
    totpSecret:totpsecret;
    encrypted:base64;
}

export interface RegisterResponseJSON extends UserResponseJSON
{
    loginToken:hex_256 | emptystring;
}

export interface UserResponseJSON extends UserJSON
{
}

export interface CredentialsJSON
{
    epoch:number; //so we can check if their system time is more or less correct

    key:hex_512;
    totp:totp;
}

export interface UserJSON
{
    id:hex_256 | emptystring, 
    attempts:number,
    admin:boolean,
}

export interface SessionCreateRequestJSON
{
    userID:hex_256;
    loginToken:hex_256;
}

export interface SessionCreateResponseJSON
{
    id:hex_256 | emptystring;
    expires:number;
}

export interface SessionExtendRequestJSON
{
    id:hex_256;
    userID:hex_256;
}

export interface SessionExtendResponseJSON
{
    id:hex_256;
    expires:number;
}

export interface SessionResumeRequestJSON
{
    id:hex_256;
    userID:hex_256;
}

export interface SessionResumeResponseJSON extends UserJSON
{
    sessionID:hex_256 | emptystring;
    expires:number;
}