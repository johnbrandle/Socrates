import type webpack from 'webpack';

export interface IConfig
{
    getOptions():webpack.Configuration;
    getPreBuild():Promise<void>;
    getPostBuild():Promise<void>;

    get watchFiles():Array<string>;
    get watchIgnored():Array<string|RegExp>;
}