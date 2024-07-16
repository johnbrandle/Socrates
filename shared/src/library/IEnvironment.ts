/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export enum DevEnvironment
{
    Dev = 'dev',
    Test = 'test',
    Prod = 'prod'
}

export interface IFrozenEnvironment
{
    isPlainTextMode:boolean;

    isLocalhost:boolean;
    config:Config;

    devEnvironment:DevEnvironment;
    isDebug:boolean;
}

export interface IEnvironment
{
    frozen:IFrozenEnvironment;

    isDevToolsOpen:boolean | undefined; //undefined if unknown
}