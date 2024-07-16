/**
 * @license		UNLICENSED
 * @date		04.01.2023
 * @copyright   Untitled.io
 * @author      John Brandle
 */

import path from 'path';
import fs from 'fs-extra';
import { DevEnvironment } from './core/DevEnvironment';
import { AppConfig } from './targets/app/AppConfig';
import { Compiler } from './core/Compiler';
import { InlineConfig } from './targets/inline/InlineConfig';
import { LoaderConfig } from './targets/loader/LoaderConfig';
import { ProgressConfig } from './targets/progress/ProgressConfig';
import { WorkerConfig } from './targets/workers/WorkerConfig';

export class Main
{
    public static readonly ROOT_PATH = path.join(__dirname, '/../../../../../');
    public static readonly WWW_PATH = path.join(__dirname, '/../../');
    public static readonly SHARED_PATH = path.join(__dirname, '/../../../../../shared/');
    
    public static readonly BUILDER_PATH = path.join(this.WWW_PATH, '/builder/');
    public static readonly BUILDER_SOURCE_PATH = path.join(this.BUILDER_PATH, '/src/');
    public static readonly WWW_SOURCE_PATH = path.join(this.WWW_PATH, '/src/');
    public static readonly COMPONENTS_PATH = path.join(this.WWW_SOURCE_PATH, '/app/components/');
    
    public static readonly LIBRARY_SOURCE_PATH = path.join(this.WWW_SOURCE_PATH, '/library/');

    public static readonly APP_SOURCE_PATH = path.join(this.WWW_SOURCE_PATH, '/app/');

    public static readonly PRE_SOURCE_PATH = path.join(this.WWW_SOURCE_PATH, '/pre/');
    public static readonly INLINE_SOURCE_PATH = path.join(this.PRE_SOURCE_PATH, '/inline/');
    public static readonly PROGRESS_SOURCE_PATH = path.join(this.PRE_SOURCE_PATH, '/progress/');
    public static readonly LOADER_SOURCE_PATH = path.join(this.PRE_SOURCE_PATH, '/loader/');

    public static OUT_PATH:string;

    public static environment:DevEnvironment;

    private _compiling:boolean = false;
    private _compileMap:Map<number, Compiler> = new Map();

    constructor(environment:DevEnvironment)
    {
        Main.environment = environment;

        //check to see if an out param exists, if so, that means we are going to copy the compiled result somwhere else 
        let index = process.argv.findIndex(arg => arg.includes('--out'));
        if (index !== -1)
        {
            if (!process.argv[index + 1]) throw new Error('out path not defined');

            Main.OUT_PATH = path.join(Main.ROOT_PATH, process.argv[index + 1]);
            if (!fs.existsSync(Main.OUT_PATH)) throw new Error('supplied out path does not exist');
        }
    }

    async init()
    {          
        this.compileAll();

        return this;
    }

    async compileAll()
    {        
        let watch = Main.environment === DevEnvironment.Dev;

        this.#add(new Compiler(new InlineConfig(), watch));
        this.#add(new Compiler(new LoaderConfig(), watch));
        this.#add(new Compiler(new ProgressConfig(), watch));

        const compileWorkersInPath = (workersPath:string) =>
        {
            let files = fs.readdirSync(workersPath);
        
            //find any folder with a tsconfigfile and compile it
            for (let i = 0, length = files.length; i < length; i++)
            {
                let file = files[i];
                let filePath = path.join(workersPath, file);
                let stat = fs.statSync(filePath);
                if (stat.isDirectory() !== true) continue;
    
                let tsconfigPath = path.join(filePath, 'tsconfig.json');
                if (fs.existsSync(tsconfigPath) === false) 
                {
                    compileWorkersInPath(filePath);
                    continue;
                }
    
                let config = new Compiler(new WorkerConfig(file, filePath, 'Main.ts'), watch);
                this.#add(config);
            }
        }

        compileWorkersInPath(Main.LIBRARY_SOURCE_PATH + '/workers/');
        compileWorkersInPath(Main.APP_SOURCE_PATH + '/workers/');
 
        this.#add(new Compiler(new AppConfig(), watch));
    }

    #add(compiler:Compiler)
    {
        compiler.once(Compiler.EVENT_READY, () => 
        {
            this._compileMap.set(compiler.id, compiler);
            this.#readyRunBatch();
        });

        compiler.on(Compiler.EVENT_CHANGE, () => 
        {
            this._compileMap.set(compiler.id, compiler);
            this.#readyRunBatch();
        });
    }

    #readyRunBatch()
    {
        if (this._compiling) return;
        this._compiling = true;

        setTimeout(async () => 
        {
            console.log(`compiling batch of ${this._compileMap.size}`);

            let map = this._compileMap;
            this._compileMap = new Map();

            let keys = Array.from(map.keys()).sort();
            for (let i = 0, length = keys.length; i < length; i++) //pre
            {
                let compiler = map.get(keys[i])!;
                await compiler.doPre();
            }

            let promises = [];
            for (let i = 0, length = keys.length; i < length; i++) //compile
            {
                let compiler = map.get(keys[i])!;
                let promise = compiler.compile();
                promises.push(promise);
            }
            await Promise.all(promises);

            for (let i = 0, length = keys.length; i < length; i++) //post
            {
                let compiler = map.get(keys[i])!;
                await compiler.doPost();
            }

            console.log('complation complete');

            this._compiling = false;
            if (this._compileMap.size) this.#readyRunBatch();
        }, 50); //give x milliseconds for files to be saved and chokidar to be triggered, and then run the batch
    }
}