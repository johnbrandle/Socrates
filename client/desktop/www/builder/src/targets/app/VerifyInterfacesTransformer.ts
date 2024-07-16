/**
 * @license		UNLICENSED
 * @date		04.01.2023
 * @copyright   Untitled.io
 * @author      John Brandle
 */

const path = require('path');
const ts = require('typescript');

class VerifyInterfacesTransformer 
{
    _program:any;

    _context:any;
    _currentFile:any;

    _pending:any[] = [];
    _interfaces:Map<string, any> = new Map();
    _classes:Map<string, any> = new Map();

    _typeChecker:any;

    constructor(program:any) 
    {
        this._program = program;

        this._typeChecker = this._program.getTypeChecker();
    }

    renew()
    {
        if (this._pending.length)
        {
            console.warn('');
            console.warn('WARNING: VerifyInterfacesTransformer.renew() called with pending items');
            console.warn('----------------------------------------');


            //loop through _interfaces map and print out keys
            console.warn('INTERFACES FOUND: ');
            this._interfaces.forEach((value:any, key:string) => console.warn(key));
            console.warn('');

            //loop through _classes map and print out keys
            console.warn('CLASSES FOUND: ');
            this._classes.forEach((value:any, key:string) => console.warn(key));
            console.warn('');

            this.#processPending(true)


            this._pending.forEach((item:any) => console.warn(item.node.parent.fileName + ':' + item.node.name.text));

            console.warn('----------------------------------------');
            console.warn('');

            this._pending = [];
            this._interfaces = new Map();
            this._classes = new Map();
        }
    }

    visitSourceFile(context:any, fileNode:any) 
    {
        this._context = context;
        this._currentFile = fileNode;

        return ts.visitNode(fileNode, this.#visitNode.bind(this));
    }

    #getDecorators(node:any)
    {
        const modifiers = node.modifiers;
        if (!modifiers) return [];

        return modifiers.filter((modifier:any) => modifier.kind === ts.SyntaxKind.Decorator);
    }

    #doesClassImplementInterfaces(classNode:any):boolean 
    {
        if (!classNode.heritageClauses) return false;
      
        for (const clause of classNode.heritageClauses) 
        {
            if (clause.token === ts.SyntaxKind.ImplementsKeyword) return true;
        }
      
        return false;
    }
    
    #getFullyQualifiedName(type:any, debug:boolean=false):string 
    {
        const getNameFromModuleSpecifier = (symbol:any, declaration:any, moduleSpecifier:any) =>
        {
            const basepath = path.dirname(declaration.getSourceFile().fileName);
            const relativeFilePath = moduleSpecifier.text.replace('.ts', '') + '.ts';
            const extendsFilePath = path.join(basepath, relativeFilePath);
            const parentName = this._typeChecker.getFullyQualifiedName(symbol);
            return `${extendsFilePath}:${parentName}`;
        }

        const symbol = this._typeChecker.getSymbolAtLocation(type.expression);
        if (!symbol || !symbol.declarations || !symbol.declarations[0]) return '';
      
        let fullyQualifiedName:string = '';
        const declaration = symbol.declarations[0];
        if (declaration.parent?.moduleSpecifier) 
        {
            fullyQualifiedName = getNameFromModuleSpecifier(symbol, declaration, declaration.parent.moduleSpecifier);

            if (debug) console.log('#getFullyQualifiedName (1): ', fullyQualifiedName);
        }
        else 
        {
            const sourceFile = declaration.getSourceFile();
            for (const statement of sourceFile.statements) 
            {
                if (!ts.isImportDeclaration(statement)) continue;
                
                const importDeclaration = statement;
                const importClause = importDeclaration.importClause;

                if (!importClause || !importClause.namedBindings || !ts.isNamedImports(importClause.namedBindings)) continue;

                const namedImports = importClause.namedBindings;

                let found = false;
                for (const element of namedImports.elements) 
                {
                    if (element.name.text !== symbol.escapedName) continue;
                    
                    found = element;
                    break;
                }

                if (found === false) continue;
                
                fullyQualifiedName = getNameFromModuleSpecifier(symbol, declaration, importDeclaration.moduleSpecifier);
                break;
            }
  
            if (!fullyQualifiedName) //could not find import. probably because the interface is declared in the same source file 
            {
                fullyQualifiedName = declaration.getSourceFile().fileName + ':' + symbol.escapedName;
            }

            if (debug) console.log('#getFullyQualifiedName (1): ', fullyQualifiedName);
        }

        return fullyQualifiedName;
    }
      
    #processHeritageClauses(heritageClauses:Array<any>, targetToken:any, debug:boolean=false):Array<string> | false 
    {
        const interfaces: string[] = [];
        for (const clause of heritageClauses) 
        {
            if (clause.token !== targetToken) continue;
            for (let type of clause.types) 
            {
                if (!ts.isIdentifier(type.expression)) continue;

                const fullyQualifiedName = this.#getFullyQualifiedName(type, debug);

                if (debug) console.log('#processHeritageClauses: fullyQualifiedName of heritage clause type ', fullyQualifiedName);

                if (!this._interfaces.has(fullyQualifiedName)) 
                {
                    if (debug) console.log('#processHeritageClauses: missing interface for ', fullyQualifiedName);
                    return false;
                }

                const node = this._interfaces.get(fullyQualifiedName);
                let result = this.#getExtendedInterfaces(node, debug);

                if (debug && result === false) console.log('#processHeritageClauses: missing a class or interface that ', node.name.text, ' implements or extends');

                if (result === false) return false;

                if (debug) console.log('#processHeritageClauses: success', fullyQualifiedName);

                interfaces.push(...result);
                interfaces.push(fullyQualifiedName);
            }
        }

        return interfaces;
    }
      
    #getExtendedInterfaces(interfaceNode:any, debug:boolean=false): string[] | false 
    {
        if (!interfaceNode.heritageClauses) return [];
        
        let result = this.#processHeritageClauses(interfaceNode.heritageClauses, ts.SyntaxKind.ExtendsKeyword, debug);

        if (debug && result === false) console.log('#getExtendedInterfaces: ', interfaceNode.name.text, ' missing an interface that it extends');

        return result;
    }
    
    #getImplementedInterfaces(classNode:any, debug:boolean=false): string[] | false 
    {
        if (!classNode.heritageClauses) return [];
        
        let result = this.#processHeritageClauses(classNode.heritageClauses, ts.SyntaxKind.ImplementsKeyword, debug);

        if (debug && result === false) console.log('#getImplementedInterfaces: ', classNode.name.text, ' missing a class or interface that it implements or extends');

        return result;
    }

    #getExtendedInterfacesRecursive(classNode:any, debug:boolean=false): string[] | false
    {
        if (!classNode.heritageClauses) return [];

        //if this class extends another class, we need to get all interfaces implemented by that class (and its super classes)
        let superInterfaces:Array<string> = [];

        const getExtendedClass = (classNode:any) =>
        {
            if (!classNode.heritageClauses) return undefined;

            for (const clause of classNode.heritageClauses)
            {
                if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
                
                for (let type of clause.types) 
                {
                    if (!ts.isIdentifier(type.expression)) continue;

                    const fullyQualifiedName = this.#getFullyQualifiedName(type);
                    if (!this._classes.has(fullyQualifiedName)) 
                    {
                        if (debug) console.log('#getExtendedInterfacesRecursive: missing class for ', fullyQualifiedName);
                        return false;
                    }

                    return this._classes.get(fullyQualifiedName);
                }
            }

            return undefined;
        }

        let currentClass = getExtendedClass(classNode);
        do
        {
            if (currentClass === false) return false;
            if (currentClass === undefined) break;

            let result = this.#getImplementedInterfaces(currentClass, debug);
            if (result === false) return false;

            superInterfaces.push(...result);

            currentClass = getExtendedClass(currentClass);
        }
        while (true);

        //remove any duplicates from the superInterfaces array
        superInterfaces = [...new Set(superInterfaces)];

        return superInterfaces;
    }

    #processPending(debug:boolean = false)
    {
       for (let i = this._pending.length; i--;)
        {
            if (debug) i = 0;

            const {node, implementsDecorator} = this._pending[i];

            const fullyQualifiedName = (node.parent.fileName || '') + ':' + node.name.text;

            if (debug) console.log('processing: ', fullyQualifiedName);

            const interfaces = this.#getImplementedInterfaces(node, debug);
            if (interfaces === false) continue;

            if (debug) console.log('got interfaces: ', interfaces);

            //if this class extends another class, we need to get all interfaces implemented by that class (and its super classes)
            const superInterfaces = this.#getExtendedInterfacesRecursive(node, debug);
            if (superInterfaces === false) 
            {
                if (debug) console.log('failed to get super interfaces for: ', fullyQualifiedName);
                continue;
            }
            if (debug) console.log('got super interfaces: ', superInterfaces);

            //remove anything for the interfaces array that is in the superInterfaces array (because if a super class implements an interface, the child class does not need to implement it directly)
            let interfacesToCheck = interfaces.filter((interfaceName:string) => !superInterfaces.includes(interfaceName));

            this._pending.splice(i, 1);

            //extract the arguments passed to the decorator
            const decoratorArgs = implementsDecorator.expression.arguments;
            const argNames = decoratorArgs.map((arg: any) => arg.getText());

            //loop through the intefaces and see if they have a matching decorator argument
            let interfaceNames = [];
            for (const fullyQualifiedName of interfacesToCheck) 
            {
                let interfaceName = fullyQualifiedName.split(':')[1];
                interfaceNames.push(interfaceName);

                if (!argNames.includes(interfaceName + 'Type')) 
                {
                    throw new Error(`Class ${node.name.text} implements interface ${interfaceName}, but does not have a matching decorator argument`);
                }
            }

            //next loop through the argNames and verify there is an interface for each
            for (const argName of argNames) 
            {
                if (!interfaceNames.includes(argName.replace('Type', ''))) 
                {
                    throw new Error(`Class ${node.name.text} has the decorator argument ${argName.replace('Type', '')} but does not implement the interface`);
                }
            }
        }
    }

    hasJsdocTag(node:any, tagName:any) 
    {
        if (!node.jsDoc) return false;
        for (let jsdoc of node.jsDoc) 
        {
            for (let tag of jsdoc.tags || []) 
            {
                if (tag.tagName.escapedText === tagName) return true;
            }
        }
    
        return false;
    }

    #visitNode(node:any):any
    {
        const getFullyQualifiedName = (node:any) => (node.parent.fileName || '') + ':' + node.name.text;

        if (ts.isInterfaceDeclaration(node)) 
        {
            this._interfaces.set(getFullyQualifiedName(node), node);
        
            this.#processPending();
        }
        if (ts.isClassDeclaration(node)) 
        {
            this._classes.set(getFullyQualifiedName(node), node);

            let decorators = this.#getDecorators(node);

            //check if any of the decorators is the "ImplementsDecorator"
            const implementsDecorator = decorators.find((decorator:any) => 
            {
                return ts.isCallExpression(decorator.expression) && decorator.expression.expression.getText() === "ImplementsDecorator";
            });

            if (implementsDecorator) 
            {
                //if there are no arguments, that means we are wanting to purposely skip it (for example, if we are extending a class that implements interfaces, but we don't want to create a type for it)
                if (implementsDecorator.expression.arguments.length) 
                {
                    if (this.hasJsdocTag(node, "verifyInterfacesTransformer_ignore") !== true) this._pending.push({node:node, implementsDecorator:implementsDecorator});
                }
            }
            else if (this.#doesClassImplementInterfaces(node)) throw new Error(`Class ${node.name.text} implements interfaces, but does not have the ImplementsDecorator`);

            this.#processPending();
        }
        
        return ts.visitEachChild(node, this.#visitNode.bind(this), this._context);
    }
}

let transformer:VerifyInterfacesTransformer;

export default (program:any) =>
{
    if (!program) //renew all transfomers
    {
        return transformer.renew();
    }

    transformer = new VerifyInterfacesTransformer(program);

    return (context:any) => (node:any) => transformer.visitSourceFile(context, node);
}
