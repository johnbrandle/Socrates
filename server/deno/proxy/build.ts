import { parse } from "https://deno.land/std@0.192.0/yaml/mod.ts";
//import * as _http from "./proxy";
import * as path from "https://deno.land/std@0.193.0/path/mod.ts";
import { CommandLineStringGenerator } from "../shared/src/deno/CommandLineStringGenerator.ts";
import { CMDOptions } from "../shared/src/deno/CommandLineStringGenerator.ts";

const contents = Deno.readTextFileSync('./config.yaml');
const config = parse(contents) as WebConfig;
if (!config) throw new Error('unable to read yaml file');
Deno.writeTextFileSync('./config.json', JSON.stringify(config, null, 4));

const OUT_PATH = './_out/';
const NAME = 'proxy';

enum DevEnvironment
{
    Dev = 'dev',
    Prod = 'prod'
}

enum Mode
{
    Run = 'run',
    Compile = 'compile'
}

enum Target
{
    Linux = 'linux',
    Mac = 'mac'
}

export default (() =>
{
    const environment = Deno.args[0] as DevEnvironment;
    const mode = Deno.args[1] as Mode;
    const target = Deno.args[2] as Target;
    const localConfig = environment === DevEnvironment.Dev ? config.local : config.remote;

    const options:Partial<CMDOptions> =
    {
        allowNet:true,  
        allowRead:[localConfig.cert, localConfig.key],
        noNPM:true,
        nodeModulesDir:false,
        source:'src/Main.ts', 
        args:[(environment === DevEnvironment.Dev).toString()]
    };

    let prepend = 'run ';
    if (mode === Mode.Compile)
    {
        let t = 'x86_64-unknown-linux-gnu';
        if (target !== Target.Linux)
        {
            t = Deno.build.arch === 'aarch64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin';
        }
        
        prepend = `compile --output ${OUT_PATH}${NAME}_${t} --target ${t} `;
    }
    else options.watch = true;

    options.unstable = true; //temp, should not need this once deno updates (fixes a bug)

    //clear non-relevant config data
    if (environment === DevEnvironment.Dev) (config.remote as unknown) = null;
    else (config.local as unknown) = null;

    Deno.writeTextFileSync(path.join(OUT_PATH, `./config.json`), JSON.stringify(config, null, 4));
    (options.allowRead as Array<string>).push(`./config.json`);

    const commandLineString = prepend + CommandLineStringGenerator.generate(options);

    console.error(commandLineString); //so we can see the result
    console.log(commandLineString); //so it can be piped into next command (see deno.jsonc)

    return commandLineString;

})();