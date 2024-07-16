/**
 * @license		UNLICENSED
 * @date		04.01.2023
 * @copyright   Untitled.io
 * @author      John Brandle
 */

const ts = require('typescript');
import path from 'path';
import { FileUtil } from '../../utils/FileUtil';

class GetComponentsTransformer 
{
    _program:any;
    _basePath:string;

    _context:any;
    _currentFile:any;

    _names:Array<string> = [];

    constructor(program:any, basePath:string) 
    {
        this._program = program;
        this._basePath = FileUtil.convertBackslashesToForwardSlashes(basePath);
    }

    renew()
    {
        let names = this._names;
        this._names = [];

        return names;
    }

    visitSourceFile(context:any, fileNode:any) 
    {
        this._context = context;
        this._currentFile = fileNode;

        return ts.visitNode(fileNode, this.#visitNode.bind(this));
    }

    #visitNode(node:any):any
    {
        if (ts.isClassDeclaration(node)) 
        {
            let decorators = this.#getDecorators(node);

            //check if any of the decorators is the "ComponentDecorator"
            const componentDecorator = decorators.find((decorator:any) => 
            {
                return ts.isCallExpression(decorator.expression) && decorator.expression.expression.getText() === "ComponentDecorator";
            });

            if (componentDecorator) 
            {
                const fullyQualifiedClassName = FileUtil.convertBackslashesToForwardSlashes(this._currentFile.fileName).split(FileUtil.convertBackslashesToForwardSlashes(this._basePath))[1].split('.ts')[0];
            
                this._names.push(fullyQualifiedClassName);
            }
        }
        
        return ts.visitEachChild(node, this.#visitNode.bind(this), this._context);
    }

    #getDecorators(node:any)
    {
        const modifiers = node.modifiers;
        if (!modifiers) return [];

        return modifiers.filter((modifier:any) => modifier.kind === ts.SyntaxKind.Decorator);
    }
}

let transformer:GetComponentsTransformer;

export default (program:any, basePath?:string) =>
{
    if (!program) //renew all transfomers
    {
        return transformer.renew();
    }

    transformer = new GetComponentsTransformer(program, basePath || '');

    return (context:any) => (node:any) => transformer.visitSourceFile(context, node);
}
