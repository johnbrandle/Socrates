/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export interface CMDOptions
{
    allowAll:boolean //--allow-all
    allowEnv:boolean //--allow-env
    allowHRTime:boolean //--allow-hrtime
    watch:boolean; //--watch
    allowPlugin:boolean; //--allow-plugin
    unstable:boolean //--unstable
    noRemote:boolean //--no-remote
    noNPM:boolean //--no-npm

    cert:string; //--cert ./certs/foo.pem

    allowNet:Array<string> | boolean; //--allow-net || allow-net=X Y Z
    allowRead:Array<string> | boolean; //--allow-read || allow-read=X Y Z
    allowWrite:Array<string> | boolean; //--allow-write || allow-write=X Y Z
    allowRun:Array<string> | boolean; //--allow-run
    allowFFI:Array<string> | boolean; //--allow-ffi

    nodeModulesDir:boolean //--node-modules-dir
    
    source:string; //src/Main.ts
    args:Array<string> //foo bar
}

type StringifiedCMDOptions = {[K in keyof CMDOptions]:string};

const singleOptionNames:Partial<StringifiedCMDOptions> =
{
    allowAll:'allow-all',
    allowEnv:'allow-env',
    allowHRTime:'allow-hrtime',
    watch:'watch',
    allowPlugin:'allow-plugin',
    allowRun:'allow-run',
    unstable:'unstable',
    noRemote:'no-remote',
    noNPM:'no-npm',
}

const singleValueOptionNames:Partial<StringifiedCMDOptions> =
{
    cert:'cert'
}

const multiValueOptionNames:Partial<StringifiedCMDOptions> = 
{
    allowNet:'allow-net',
    allowRead:'allow-read',
    allowWrite:'allow-write',
    allowRun:'allow-run',
    allowFFI:'allow-ffi'
}

export class CommandLineStringGenerator
{
    static generate(cmdOptions:Partial<CMDOptions>) 
    {
        const options: string[] = [];

        Object.entries(singleOptionNames).forEach(([key, value]) => 
        {
            if (cmdOptions[key as keyof CMDOptions]) options.push(`--${value}`);
        });

        Object.entries(singleValueOptionNames).forEach(([key, value]) => 
        {
            if (cmdOptions[key as keyof CMDOptions]) options.push(`--${value} ${cmdOptions[key as keyof CMDOptions]}`);
        });

        Object.entries(multiValueOptionNames).forEach(([key, value]) => 
        {
            const option = cmdOptions[key as keyof CMDOptions];
            if (!option) return;

            if (typeof option === 'boolean') options.push(`--${value}`);
            else if (Array.isArray(option) && option.length > 0) 
            {
                let first = true;
                let str = '';
                option.forEach(each => 
                {
                    each = each.trim();
                    if (!each) return;

                    if (first) str += `--${value}=${each}`;
                    else str += `,${each}`;

                    first = false;
                });

                if (str) options.push(str);
            }
        });

        if (cmdOptions.nodeModulesDir !== undefined) options.push(`--node-modules-dir=${cmdOptions.nodeModulesDir}`)
        if (cmdOptions.source) options.push(cmdOptions.source);
        if (cmdOptions.args) options.push(...cmdOptions.args);

        return options.join(' ');
    }
}