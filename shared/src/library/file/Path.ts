/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { __isString } from "../utils/__internal/__is";

export type path = string & { _pathBrand: 'path' };
export type folderpath = path & { _brand: 'folderpath' };;
export type filepath = path & { _brand: 'filepath' };

export abstract class Path
{
    protected _path:string;
    public toString():path { return this._path as path; }

    protected _name:string;
    public get name():string { return this._name; }

    protected _ancestorParts:string[];
    public get ancestorParts():string[] { return this._ancestorParts; }

    protected _parts:string[];
    public get parts():string[] { return this._parts; }

    private _parentPath:string | undefined;
    protected _parent:FolderPath | undefined;
    public get parent():FolderPath | undefined 
    {
        if (this._parent !== undefined || this._parentPath === undefined) return this._parent;

        return this._parent = new FolderPath(this._parentPath); //create parent on demand
    }
    
    constructor(path:string)
    {
        if (this.validate(path) !== true) new Error(`Invalid path, ${path}`);

        if (path === '/')
        {
            this._path = '/';
            this._parts = [];
            this._name = '';
            this._ancestorParts = [];
            this._parentPath = undefined;
            return;
        }

        const parts = path.split('/').filter(part => part.length > 0);
        
        this._path = path;
        this._parts = parts.slice();
        this._name = parts.pop() ?? '';
        this._ancestorParts = parts;

        //if the path consists of no parts, the parent path is the root
        if (parts.length === 0) this._parentPath = '/';
        
        //if the path consists of at least one part, the parent path is the path without the last part
        else if (parts.length > 0) this._parentPath = `/${parts.join('/')}/`;
    }

    public static from(path:path):FolderPath | FilePath
    {
        return path[path.length - 1] === '/' ? new FolderPath(path) : new FilePath(path);
    }

    protected validate(path:string):boolean
    {
        //this checks:
        //1. The path begins with a '/'
        //2. The path does not contain consecutive '/' characters.
        //3. The path does not contain '..' characters.

        //check if the path begins with '/'
        const startsWithSlash = path.startsWith('/');
        if (startsWithSlash !== true) return false;

        //check if the path contains consecutive '/' characters, or '..' characters
        const hasConsecutiveSlashesOrDoubleDots = /(\/\/+|\.\.)/.test(path);
        if (hasConsecutiveSlashesOrDoubleDots === true) return false;

        return true;
    }

    public equals(path:Path):boolean { return path.toString() === this.toString(); }

    public static type(path:path):'folder' | 'file'
    {
        return path[path.length - 1] === '/' ? 'folder' : 'file';
    }
}

export class FolderPath extends Path
{
    constructor(path:string);
    constructor(folderPath:FolderPath, name:string);
    constructor(...args:any[])
    {
        if (__isString(args[0]) === true) 
        {
            const path = args[0] as string;

            super(path);
        }
        else
        {
            const folderPath = args[0] as FolderPath;
            const name = args[1] as string;

            //they passed in a folder path and a name, so we need to create a new folder path with the same parent and the new name
            super(folderPath.parent !== undefined ? folderPath.parent.toString() + `${name}/` : `/${name}/`);
        }
    }

    public getSubFolder(name:string | FolderPath):FolderPath
    {
        if (__isString(name) === true) return new FolderPath(`${this._path}${name}/`);

        return new FolderPath(`${this._path.substring(0, this._path.length - 1)}${name.toString()}`);
    }

    public getSubFile(name:string | FilePath):FilePath
    {
        if (__isString(name) === true) return new FilePath(`${this._path}${name}`);

        return new FilePath(`${this._path.substring(0, this._path.length -1)}${name.toString()}`);
    }

    public isParentOf(path:FolderPath | FilePath):boolean
    {
        return path.toString().startsWith(this._path) === true;
    }

    protected override validate(path:string):boolean
    {
        if (path.endsWith('/') !== true) return false;
        
        return super.validate(path);
    }

    public get type():'folder'
    {
        return 'folder';
    }

    public toString():folderpath { return this._path as folderpath; }

    public static override from(path:folderpath):FolderPath
    {
        return super.from(path) as FolderPath;
    }

    public static normalize(path:string):folderpath
    {
        //replace all backslashes with forward slashes
        path = path.split('\\').join('/');

        //check if there is any ./ in the path, and if so remove it
        if (path.includes('./') === true) path = path.replace('./', '');

        //remove any consecutive slashes
        path = path.replace(/\/\/+/g, '/');

        //check if there are any .. in the path, and if so throw an error
        if (path.includes('..') === true) new Error(`Invalid path, ${path}`);

        if (path === '/') return path as folderpath;

        //add a trailing slash if there isn't one
        if (path.endsWith('/') === false) path += '/';

        //if the path does not start with a /, add it
        if (path.startsWith('/') === false) path = `/${path}`;

        return path as folderpath;
    }
}

export class FilePath extends Path
{
    private _extension:string = '';
    public get extension():string { return this._extension; }

    private _nameWithoutExtension:string;
    public get nameWithoutExtension():string { return this._nameWithoutExtension; }

    constructor(path:string);
    constructor(fileOrFolderPath:FilePath | FolderPath, name:string);
    constructor(...args:any[])
    {
        if (__isString(args[0]) === true) 
        {
            const path = args[0] as string;

            super(path);

            const parts = this._name.split('.');
            if (parts.length > 1) this._extension = parts.pop()!;
            this._nameWithoutExtension = parts.join('.');
        }
        else 
        {
            const fileOrFolderPath = args[0] as FilePath | FolderPath;
            const name = args[1] as string;

            super(fileOrFolderPath.parent !== undefined ? `${fileOrFolderPath.parent.toString()}${name}` : `/{name}`);

            const parts = this._name.split('.');
            if (parts.length > 1) this._extension = parts.pop()!;

            //if there is no extension, this will be the same as the name
            this._nameWithoutExtension = parts.join('.'); 
        }
    }

    protected override validate(path:string):boolean
    {
        if (path.endsWith('/') === true) return false;
        
        return super.validate(path);
    }

    public get type():'file'
    {
        return 'file';
    }

    public toString():filepath { return this._path as filepath; }

    public static override from(path:filepath):FilePath
    {
        return super.from(path) as FilePath;
    }

    public static normalize(path:string):filepath
    {
        //replace all backslashes with forward slashes
        path = path.split('\\').join('/');
        
        //check if there is any ./ in the path, and if so remove it
        if (path.includes('./') === true) path = path.replace('./', '');

        //remove any consecutive slashes
        path = path.replace(/\/\/+/g, '/');

        //check if there are any .. in the path, and if so throw an error
        if (path.includes('..') === true) new Error(`Invalid path, ${path}`);

        if (path.length === 0 || path === '/') new Error(`Invalid path, ${path}`);

        //remove any trailing slashes
        if (path.endsWith('/') === true) path = path.substring(0, path.length - 1);

        //if the path does not start with a /, add it
        if (path.startsWith('/') === false) path = `/${path}`;

        return path as filepath;
    }
}