/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { Main } from "../../Main";
import path from 'path';
import fs, { readFile } from 'fs-extra';
import sass from 'sass';
import cheerio, { CheerioAPI } from 'cheerio';
import crypto_js from 'crypto-js';
import { DevEnvironment } from '../../core/DevEnvironment';
import { FileUtil } from '../../utils/FileUtil';
import { CSSUtil } from '../../utils/CSSUtil';
import { HTMLTemplateStringReplacer } from './processors/HTMLTemplateStringReplacer';
import SharedOptions from "../../core/SharedOptions";
import { YAMLtoJSONConverter } from "./processors/YAMLtoJSONConverter";
import { StyleProcessor } from "./processors/StyleProcessor";
import { HTMLIncludeAndReplaceProcessor } from './processors/HTMLIncludeAndReplace';
import { IConfig } from "../../core/IConfig";
import webpack from 'webpack';
import { globSync } from 'glob';

import getComponentsTransformer from "./GetComponentsTransformer";
import verifyInterfacesTransformer from "./VerifyInterfacesTransformer";
import stripStringTransformer from "./StripStringTransformer";
import boundedScopeTransformer from "./BoundedScopeTransformer";
const addManglePropsTransformer = require('ts-loader-addmanglepropcommentstransformer');
const forceSuperTransformer = require('ts-loader-forcesupertransformer');

import ExcludeConfig from '../../../../.exclude.json';
import { get } from "cheerio/lib/api/traversing";

function filePathsToJson(filePaths:string[], base:string):Record<string, any> 
{
    let json:Record<string, any> = {};
  
    filePaths.forEach(filePath => 
    {
        filePath = filePath.split(base).join('');
      
        let parts:string[] = FileUtil.convertBackslashesToForwardSlashes(filePath).split('/');
        let last:string = parts.pop() as string;
        let pointer:Record<string, any> = json;
  
        parts.forEach(part => 
        {
            if (!pointer[part]) pointer[part] = {};
        
            pointer = pointer[part];
        });
  
        pointer[last] = filePath;
    });
  
    return json;
}

export class AppConfig implements IConfig
{
    _styleProcessor!:StyleProcessor;
    _etag:string = '';
    _prebuildHTML!:CheerioAPI;

    constructor()
    {
    }

    getPreBuild = async () =>
    {
        console.log('');
        console.log('------------------------Doing Pre Build------------------------');
        console.log('');

        ////creates an imports.ts file with all the ts files in the app and library directories (no longer needed)
        //const results = globSync([Main.WWW_SOURCE_PATH + "/app/**/*.ts", Main.WWW_SOURCE_PATH + "/library/**/*.ts"]);
        //const imports = [];
        //for (let i = results.length; i--;)
        //{
        //    const file = results[i];
        //    imports.push(`import * as a${i} from '${file.split(Main.WWW_SOURCE_PATH).join('./')}';`);
        //}
        //FileUtil.writeIfModified(path.join(Main.WWW_SOURCE_PATH, './imports.ts'), imports.join('\n'));

        const indexHTML = fs.readFileSync(path.join(Main.WWW_PATH, './index.template.html'), {encoding:'utf8'});
        const $ = this._prebuildHTML = cheerio.load(indexHTML);

        $('html').attr('data-env', Main.environment);

        //convert all yaml files to json
        new YAMLtoJSONConverter().convert(Main.WWW_PATH);

        //update the etag value
        let uri = path.join(Main.WWW_PATH, './data/config.json');
        let config = fs.readJSONSync(uri);        
        this._etag = config.global.etag = Main.environment === DevEnvironment.Dev ? '1234567890' : Math.floor(Date.now() / 1000).toString();
        FileUtil.writeIfModified(uri, JSON.stringify(config));

        //reinit
        this._styleProcessor = new StyleProcessor();

        //compile bootstrap scss
        uri = path.join(Main.WWW_PATH, './css/bootstrap.scss');
        let bootstrapStyleString = sass.compile(uri).css;
        FileUtil.writeIfModified(path.join(Main.WWW_PATH, './css/thirdparty/bootstrap.bundle.css'), bootstrapStyleString);
   
        //create css min files
        CSSUtil.minifyCSS(path.join(Main.WWW_PATH, './css'));

        //update data with integrity values
        uri = path.join(Main.WWW_PATH, './data/loader.json');
        let obj = fs.readJSONSync(uri);
        let styles = obj.styles;
        for (let i = 0, length = styles.length; i < length; i++)
        {
            let obj = styles[i];
    
            let css = fs.readFileSync(path.join(Main.WWW_PATH, obj.src), {encoding:'utf8'})
            let hash = crypto_js.SHA256(css).toString(crypto_js.enc.Base64);
            this._styleProcessor.styleIntegrityHashes.push(hash);
            obj.integrity = `sha256-${hash}`;
        }
        FileUtil.writeIfModified(uri, JSON.stringify(obj));

        //deploy the config.json to the shared dir
        fs.copyFileSync(path.join(Main.WWW_PATH, './data/config.json'), path.join(Main.SHARED_PATH, './config.json')); //we need this config json in the shared directory as well

        //replace html template strings
        new HTMLTemplateStringReplacer().replace($, Main.WWW_PATH);
    }

    getPostBuild = async () =>
    {   
        console.log('');
        console.log('------------------------Doing Post Build------------------------');
        console.log('');
        
        const $ = this._prebuildHTML;
    
        //renew the transformers
        forceSuperTransformer(null); //renew for another compilation round
        verifyInterfacesTransformer(null); //renew for another compilation round
        let components = getComponentsTransformer(null) as string[]; //get the components

        //write generated components json
        let json = filePathsToJson(components, Main.COMPONENTS_PATH);
        FileUtil.writeIfModified(path.join(Main.WWW_PATH, './data/components.json'), JSON.stringify(json, null, 4));

        //inline script tags with src attribute
        let scriptIntegrityHashes:Array<string> = [];
        let scripts = $('script');
        scripts.each((index:number, script:any) => 
        {
            script = $(script);

            if (!script.attr('src')) return;

            let uri = path.join(Main.WWW_PATH, script.attr('src'));
            let js = fs.readFileSync(uri, {encoding:'utf8'});
            script.text(js);
            let hash = crypto_js.SHA256($(script).text()).toString(crypto_js.enc.Base64);
            scriptIntegrityHashes.push(hash);
            script.attr('integrity', `sha256-${hash}`);
            script.attr('crossorigin', `anonymous`);
            script.removeAttr('src'); //remove the src attribute
        });
        
        //inline style tags with src attribute
        let styles = $('style');
        styles.each((index:number, style:any) => 
        {
            style = $(style);

            if (!style.attr('src')) return;

            let uri = path.join(Main.WWW_PATH, style.attr('src'));
            let css = fs.readFileSync(uri, {encoding:'utf8'});
            style.text(css);
            let hash = crypto_js.SHA256($(style).text()).toString(crypto_js.enc.Base64);
            this._styleProcessor.styleIntegrityHashes.push(hash);
            style.attr('integrity', `sha256-${hash}`);
            style.attr('crossorigin', `anonymous`);
            style.removeAttr('src'); //remove the src attribute
        });

        //remove inline styles
        let elementsWithStyle = $('[style]');
        let styleString = '';
        elementsWithStyle.each((index:number, element:any) => 
        {
            //create a new CSS class with the styles
            let className = this._styleProcessor.generateClassName();
            styleString += `.${className} { ${$(element).attr('style')} }\n`;
    
            //update the class attribute of the element
            let existingClass = $(element).attr('class') || '';
            let classes = existingClass ? existingClass + ' ' + className : className;
            $(element).attr('class', `${classes}`);
    
            //remove the style attribute
            $(element).removeAttr('style');
        });

        //formerly inline css
        $('head').append(`<style id="f7c5b1cf-24fe-4d75-bd5e-767615013c4b">${styleString}</style>`);
        let style = $('#f7c5b1cf-24fe-4d75-bd5e-767615013c4b');
        let hash = crypto_js.SHA256($(style).text()).toString(crypto_js.enc.Base64);
        this._styleProcessor.styleIntegrityHashes.push(hash);
        $(style).attr('integrity', `sha256-${hash}`);
        $(style).attr('crossorigin', `anonymous`);
    
        //component css
        styleString = this._styleProcessor.getStylesString(true);
        $('body').append(`<style id="e4961c06-d490-4d78-ac89-0362e7999f56">${styleString}</style>`);
        style = $('#e4961c06-d490-4d78-ac89-0362e7999f56');
        hash = crypto_js.SHA256($(style).text()).toString(crypto_js.enc.Base64);
        this._styleProcessor.styleIntegrityHashes.push(hash);
        $(style).attr('integrity', `sha256-${hash}`);
        $(style).attr('crossorigin', `anonymous`);
    
        //set the content header
        let contentSecurityPolicy = $('#f543910d-c297-4aed-84e6-1cf231badeef');
        let content = $(contentSecurityPolicy).attr('content')!;
    
        let hashes = '';
        this._styleProcessor.styleIntegrityHashes.forEach((hash) => { hashes += ` 'sha256-${hash}'`});
        content = content.replace('__STYLES_INTEGRITY__', hashes.trim());
    
        hashes = '';
        scriptIntegrityHashes.forEach((hash) => { hashes += ` 'strict-dynamic' 'sha256-${hash}'`});
        content = content.replace('__SCRIPTS_INTEGRITY__', hashes.trim());
    
        //let dev = `'self' *`;
        //let prod = `self http://localhost/`;
        //content = content.replace('__CONNECT_SRC__', Main.environment === DevEnvironment.Dev ? dev : prod);
    
        $(contentSecurityPolicy).attr('content', content);
    
        FileUtil.writeIfModified(path.join(Main.WWW_PATH, './index.html'), $.html());

        if (Main.OUT_PATH) FileUtil.copyContentsTo(Main.WWW_PATH, path.join(Main.OUT_PATH, `/${this._etag}/`), ExcludeConfig); //copy the files to the specified location, minus any excluded files if out path is specified
    }

    getOptions():webpack.Configuration
    {
        let getCustomTransformers:Function;
        if (Main.environment === DevEnvironment.Dev) 
        {
            getCustomTransformers = (program:any) => (
            {
                before: 
                [
                    verifyInterfacesTransformer(program),
                    getComponentsTransformer(program, this.sourcePath),
                    //addManglePropsTransformer(program),
                    forceSuperTransformer(program),
                    boundedScopeTransformer(program),
                    //stripStringTransformer(program), //prod only
                ]
            });
        }
        else
        {
            getCustomTransformers = (program:any) => (
            {
                before: 
                [
                    verifyInterfacesTransformer(program),
                    getComponentsTransformer(program, this.sourcePath),
                    //addManglePropsTransformer(program),
                    forceSuperTransformer(program),
                    boundedScopeTransformer(program),
                    stripStringTransformer(program),
                ]
            });
        }

        const options =
        {
            entry:
            {
                app:path.join(this.sourcePath, "./Main.ts"),
            },
            node:{__filename:true, __dirname:true},
            module:
            {
                rules:
                [
                    {
                        test:(path:string) => 
                        {
                            //these exist in the src directory to prevent visual studio from complaining. 
                            //however, the build will fail with these present, so we need to exclude them
                            //note: the visual studio issue appears to be caused by the ts configs in the workers directory. 
                            //i believe it is overriding the base tsconfig with the one in the workers directory, which is why it is complaining
                            if (path.endsWith('ts.d.ts')) return false;

                            if (Main.environment === DevEnvironment.Dev) return path.endsWith('.ts');
                            return path.endsWith('.ts') && !path.endsWith('.test.ts');
                        },
                        use:
                        [
                            {
                                loader:path.resolve(__dirname, './custom-loader.js')
                            },
                            {
                                loader:'ts-loader',
                                options: 
                                {
                                    transpileOnly:true,
                                    getCustomTransformers:getCustomTransformers,
                                    instance:'app',
                                    configFile:path.join(Main.WWW_PATH, (Main.environment === DevEnvironment.Dev) ? 'tsconfig.json' : 'tsconfig.prod.json'),
                                }
                            }
                        ],
                        exclude:[/node_modules/, Main.PROGRESS_SOURCE_PATH, Main.LOADER_SOURCE_PATH, Main.INLINE_SOURCE_PATH, Main.BUILDER_SOURCE_PATH]
                    },
                    {
                        test:/\.html$/,
                        exclude:[/node_modules/, Main.PROGRESS_SOURCE_PATH, Main.LOADER_SOURCE_PATH, Main.INLINE_SOURCE_PATH, Main.BUILDER_SOURCE_PATH],
                        include:[this.sourcePath],
                        use:
                        [{
                            loader:'html-loader',
                            options:
                            {
                                preprocessor:async (content:string, loaderContext:any) => 
                                {                                    
                                    const $ = cheerio.load(content);
        
                                    await HTMLIncludeAndReplaceProcessor.process($, loaderContext);
                                    new HTMLTemplateStringReplacer().replace($, path.dirname(loaderContext.resourcePath));
                                    await this._styleProcessor.htmlStyleLoader.process($, loaderContext.resourcePath.split('.html').join(''));
                                    
                                    return $('head').html()! + $('body').html()!;
                                },
                            },
                        }],
                    },
                    {
                        test:/\.scss$/,
                        exclude:[/node_modules/, Main.PROGRESS_SOURCE_PATH, Main.LOADER_SOURCE_PATH, Main.INLINE_SOURCE_PATH, Main.BUILDER_SOURCE_PATH],
                        include:[this.sourcePath],
                        use:['style-loader', 'css-loader', 'sass-loader'],
                    },
                    {
                        test:/\.css$/,
                        exclude:[/node_modules/, Main.PROGRESS_SOURCE_PATH, Main.LOADER_SOURCE_PATH, Main.INLINE_SOURCE_PATH, Main.BUILDER_SOURCE_PATH],
                        include:[this.sourcePath],
                        use:["style-loader", "css-loader"],
                    },
                    {
                        test:/\.ya?ml$/,
                        exclude:[/node_modules/, Main.PROGRESS_SOURCE_PATH, Main.LOADER_SOURCE_PATH, Main.INLINE_SOURCE_PATH, Main.BUILDER_SOURCE_PATH],
                        include:[this.sourcePath],
                        use:'yaml-loader'
                    },
                    { 
                        test:/\.json$/, 
                        exclude:[/node_modules/, Main.PROGRESS_SOURCE_PATH, Main.LOADER_SOURCE_PATH, Main.INLINE_SOURCE_PATH, Main.BUILDER_SOURCE_PATH],
                        include:[this.sourcePath],
                        type:'json' 
                    },
                ]
            }
        };
        
        let shared = SharedOptions(() => {}, () => {});

        return {...options, ...shared};
    }

    get sourcePath()
    {
        return Main.WWW_SOURCE_PATH;
    }

    get watchFiles()
    {
        return [Main.WWW_SOURCE_PATH, Main.SHARED_PATH];
    }

    get watchIgnored():Array<string|RegExp>
    {
        return [/config.json/];
    }
}