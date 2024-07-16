/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { IApp } from "../IApp.ts";
import { UserModel } from "../model/UserModel.ts";
import * as UserJSON from '../../../../../../shared/src/app/json/UserJSON.ts';
import { HardenOutputFormat, PasswordHelper } from "../helpers/PasswordHelper.ts";
import { DestructableEntity } from "../../../../../../shared/src/library/entity/DestructableEntity.ts";
import type { IDestructor } from "../../../../../../shared/src/library/IDestructor.ts";
import type { HKDFKey, HMACKey } from "../../library/utils/KeyUtil.ts";
import { SystemDrive } from "../../library/file/drive/SystemDrive.ts";
import { KeyType } from "../../../../../../shared/src/library/utils/KeyUtil.ts";
import { DataFormat, FileType, type IDrive } from "../../../../../../shared/src/library/file/drive/IDrive.ts";
import { DriveStorage } from "../../../../../../shared/src/library/storage/DriveStorage.ts";
import { SessionStorage } from "../../library/storage/SessionStorage.ts";
import { DriveFile } from "../../library/file/drive/DriveFile.ts";
import { DriveFolder } from "../../library/file/drive/DriveFolder.ts";
import type { ISystemDrive } from "../../library/file/drive/ISystemDrive.ts";
import { type uid } from "../../library/utils/UIDUtil.ts";
import { HMACOutputFormat } from "../../library/utils/HMACUtil.ts";
import { HashType, type hex_1024, type Hex_1024, type hex_128, type hex_256, type Hex_512, type hex_512 } from "../../library/utils/HashUtil.ts";
import { type totp, type totpsecret } from "../../../../../../shared/src/app/utils/TOTPUtil.ts";
import { FileStorage } from "../../../../../../shared/src/library/file/storage/FileStorage.ts";
import type { IFileStorageAdapter } from "../../../../../../shared/src/library/file/storage/adapters/IFileStorageAdapter.ts";
import type { IFileStorage } from "../../../../../../shared/src/library/file/storage/IFileStorage.ts";
import { OPFSFileStorageAdapter } from "../../library/file/storage/adapters/OPFSFileStorageAdapter.ts";
import { BridgeFileStorageAdapter } from "../file/storage/adapters/BridgeFileStorageAdapter.ts";
import { type emptystring } from "../../../../../../shared/src/library/utils/StringUtil.ts";
import { SealedDecorator } from "../../../../../../shared/src/library/decorators/SealedDecorator.ts";
import { FilePath, type FolderPath } from "../../../../../../shared/src/library/file/Path.ts";
import { DevEnvironment } from "../../../../../../shared/src/library/IEnvironment.ts";
import type { IProgressor } from "../../../../../../shared/src/library/progress/IProgressor.ts";
import type { IError } from "../../../../../../shared/src/library/error/IError.ts";
import { type IAborted } from "../../../../../../shared/src/library/abort/IAborted.ts";
import { type IFailure } from "../../../../../../shared/src/library/fail/IFailure.ts";
import { FailureCode } from "../../../../../../shared/src/library/fail/FailureCode.ts";
import { Failure } from "../../../../../../shared/src/library/fail/Failure.ts";
import type { Turn } from "../../../../../../shared/src/library/basic/Turner.ts";
import { Data } from "../../../../../../shared/src/library/data/Data.ts";
import { AbortController } from "../../../../../../shared/src/library/abort/AbortController.ts";
import type { AbortableHelper } from "../../../../../../shared/src/library/helpers/AbortableHelper.ts";

export enum RegisterLoginStatus
{
    HardenKey_Begin,
    HardenKey_Progress,
    Other,
    Aborted,
    Failed,
    Succeeded
}

interface RegistrationData extends JsonObject
{
    plainTextMode:boolean;
    id:hex_256 | emptystring;
    totpSecret:totpsecret;
    online:boolean;
}

interface SessionData extends JsonObject
{
    userID:hex_256 | emptystring;
    sessionID:hex_256 | emptystring;
    sessionExpires:number;

    hardenedKey:hex_512;
}

/**
 * The UserManager class is responsible for handling user registration, login, and session management.
 */
@SealedDecorator()
export class UserManager<A extends IApp<A>> extends DestructableEntity<A>
{   
    /**
     * Helps with password hashing.
     */
    #_passwordHelper:PasswordHelper<A> = new PasswordHelper<A>(this._app);

    /**
     * These are derived from the user's private key and are used for encryption, decryption, signing, and key derivation.
     */
    #_hkdfKey!:HKDFKey;
    #_hmacKey!:HMACKey<HashType.SHA_256>;

    /*
     * The system drive instance.
     */
    #_systemDrive?:ISystemDrive<A>;

    /**
     * The user model.
     */
    #_model:UserModel<A> = new UserModel<A>(this._app, this);

    /**
     * The session storage instance. Used to store session data.
     */
    #_sessionStorage:SessionStorage<A> = new SessionStorage(this._app, this.uid);

    #_config = this._app.configUtil.get(true);

    /**
     * @param app The app instance.
     * @param destructor The destructor instance.
     * @param uid The unique identifier for this entity. (must be the same every time)
     */
    constructor(app:A, destructor:IDestructor<A>, uid:uid)
    {
        super(app, destructor, uid);
    }

    /**
     * Registers a user with the given key, TOTP, and TOTP secret.
     * 
     * Handles the display of progress or error dialogs.
     * 
     * @param key The user's key.
     * @param totp The user's TOTP.
     * @param toptSecret The user's TOTP secret.
     * @returns A Promise that resolves to a boolean indicating whether the registration was successful.
     */
    public async register(key:string, totp:totp | emptystring, toptSecret:totpsecret | emptystring, progressor:IProgressor<A, {status:RegisterLoginStatus, details:string}>, options?:{rounds?:number, iterations?:number, memory?:number}):Promise<true | IFailure | IAborted | IError>
    {
        let turn:Turn<A> | undefined;

        try
        {
            //create abortable helper
            const _ = this.createAbortableHelper(progressor).throwIfAborted();

            //aquire a turn
            turn = _.value(await this.getTurn());
            
            //attempt to register the user
            return _.value(await this.#registerLoginHandler('register', turn, key, totp, toptSecret, progressor, options));
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to register', arguments, {names:[UserManager, this.register]});
        }
        finally
        {
            turn?.end();
        }
    }

    /**
     * Logs in the user with the given account key and TOTP code.
     * 
     * Handles the display of progress or error dialogs.
     * 
     * @param key - The account key to use for login.
     * @param totp - The TOTP code to use for login.
     * @returns A Promise that resolves to a boolean indicating whether the login was successful.
     */
    public async login(key:string, totp:totp | emptystring, progressor:IProgressor<A, {status:RegisterLoginStatus, details:string}>):Promise<true | IFailure | IAborted | IError>
    {
        let turn:Turn<A> | undefined;

        try
        {
            //create abortable helper
            const _ = this.createAbortableHelper(progressor).throwIfAborted();

            //aquire a turn
            turn = _.value(await this.getTurn());

            //attempt to login the user
            return _.value(await this.#registerLoginHandler('login', turn, key, totp, '', progressor));
        }
        catch (error) 
        {
            return this._app.warn(error, 'failed to login', arguments, {names:[UserManager, this.login]});
        }
        finally
        {
            turn?.end();
        }
    }

    /**
     * Registers or logs in a user with the provided key and TOTP code.
     * 
     * 1) Check if the user's key has any obvious issues. If so, fail.
     * 2) Check if a user is logged in. If so, log out first.
     * 3) Stretch the user's key.
     * 4) Derive the encryption keys (HKDF, GCM, CBC, and HMAC) from the stretched key.
     * 5) Create the user's local system drive.
     * 
     * @param key The user's key.
     * @param totp The TOTP code.
     * @param totpSecret The TOTP secret. Should only be empty if logging in.
     * @returns A promise that resolves to a boolean indicating whether the operation was successful.
     */
    async #registerLoginHandler(action:'register' | 'login', turn:Turn<A>, key:string, totp:totp | emptystring, totpSecret:totpsecret | emptystring, progressor:IProgressor<A, {status:RegisterLoginStatus, details:string}>, options?:{rounds?:number, iterations?:number, memory?:number}):Promise<true | IFailure | IAborted | IError>
    {
        const app = this._app;

        try
        {
            const debugMode = (app.environment.isDevToolsOpen && app.environment.frozen.devEnvironment !== DevEnvironment.Prod);

            //create abortable helper
            const _ = this.createAbortableHelper(progressor).throwIfAborted();

            //create abort controller for both the progressor and this object
            const abortController = new AbortController(app, [this, progressor]);

            //aquire a turn
            turn = _.value(await this.getTurn(turn));
            
            //slice the progressor for the different stages of the registration/login process
            const thisProgressor = progressor.slice(.01);
            const hardenProgressor = progressor.slice<undefined>(.95, (progress, _data, localProgress) => 
            {
                return progressor.setProgress(progress, {status:RegisterLoginStatus.HardenKey_Progress, details:(localProgress * 100).toFixed(2)});
            });
            const registerOrLoginProgressor = progressor.slice(1);

            //check if the user's key has any obvious issues. If so, fail.
            if (key.length < 15 || key !== key.trim()) app.throw('invalid key', [], {correctable:true});

            //check if a user is logged in. If so, log out first.
            if (this.#_model.loggedIn !== false) 
            {
                thisProgressor.setProgress(true, {status:RegisterLoginStatus.Other, details:'logging out'});

                _.check(await this.logout());
            }
            
            const usersFilePath = new FilePath('/users.json');
            const preFileStorage = _.value(await this.#createFileStorage(await this._app.keyUtil.import(new Uint8Array(64) as Hex_512, KeyType.HKDF))); //create unencrypted file storage for storing the users
            const exists = _.value(await preFileStorage.existsFile(usersFilePath));
            if (exists !== true && action === 'login') return new Failure({code:FailureCode.USER_UNRECOVERABLE, details:'no users found'});
            
            let salt:Hex_1024;
            let hardenOptions = {rounds:options?.rounds, iterations:options?.iterations, memory:options?.memory};
            if (action === 'login')
            {
                thisProgressor.setProgress(true, {status:RegisterLoginStatus.Other, details:'retrieving user entry'});

                const usersData = _.value(await preFileStorage.getFileData(usersFilePath, abortController));
                const stream = _.value(await usersData.get());
                const uint8Array = _.value(await this._app.streamUtil.toUint8Array(stream));
                const users = _.value(app.jsonUtil.parse<{default:{salt:hex_1024, rounds:number, iterations:number, memory:number, online:false}}>(app.textUtil.fromUint8Array(uint8Array)));

                if (users.default === undefined) return new Failure({code:FailureCode.USER_UNRECOVERABLE, details:'user does not exist'}); //we don't support multiple users just yet

                salt = app.baseUtil.fromHex<Hex_1024>(users.default.salt);
                hardenOptions = {rounds:users.default.rounds, iterations:users.default.iterations, memory:users.default.memory};
            }
            else 
            {
                if (exists === false)
                {
                    thisProgressor.setProgress(true, {status:RegisterLoginStatus.Other, details:'creating users file'});

                    _.check(await preFileStorage.createFile(usersFilePath));
                    _.check(await preFileStorage.setFileData(usersFilePath, new Data(app, async () => this._app.streamUtil.fromUint8Array(app.textUtil.toUint8Array(app.jsonUtil.stringify({})))), abortController));
                }

                thisProgressor.setProgress(true, {status:RegisterLoginStatus.Other, details:'generating 1024 bit salt'});

                salt = this._app.byteUtil.generate<Hex_1024>(128);
            }

            //harden the user's key
            thisProgressor.setProgress(true, {status:RegisterLoginStatus.HardenKey_Begin, details:''});
            let hardenedKey:Hex_512 | HKDFKey;
            if (debugMode === true) [hardenedKey, hardenOptions]  = _.value(await this.#_passwordHelper.harden(key, salt, hardenProgressor, HardenOutputFormat.Hex_512, {log:true, ...hardenOptions}));
            else [hardenedKey, hardenOptions] = _.value(await this.#_passwordHelper.harden(key, salt, hardenProgressor, HardenOutputFormat.HKDFKey, {log:false}));

            thisProgressor.setProgress(true, {status:RegisterLoginStatus.Other, details:'deriving keys'});

            //derive the encryption keys from the stretched key.
            _.check(await this.#deriveKeys(hardenedKey)); 
            
            thisProgressor.setProgress(true, {status:RegisterLoginStatus.Other, details:'creating file system'});

            //create the user's local system drive.
            const systemDrive = _.value(await this.#mountSystemDrive());
              
            //if totpsecret has a value, register the user, otherwise, login
            const response = _.value(await (action === 'register' ? this.#registerOffline(_, abortController, systemDrive, totp as totp, totpSecret as totpsecret, registerOrLoginProgressor) : this.#loginOffline(_, abortController, systemDrive, registerOrLoginProgressor)));
            if (app.typeUtil.isFailure(response) === true) return response;

            //if dev tools is open and we are not in production, store the private key in session storage and warn the user
            if (debugMode === true)
            {
                this._app.bannerNotification.show('Private user key is being stored in session storage. This is only recommened for dev testing!');
                _.check(await this.#_sessionStorage.set<SessionData>(this.#_config.classes.UserManager.frozen.sessionStorageKey, {userID:response.id, sessionID:'', sessionExpires:0, hardenedKey:app.baseUtil.toHex(hardenedKey as Hex_512)}));
            }

            //the user info folder path is where we store user specific data
            const userInfoFolderPath = systemDrive.userInfoFolderPath;          
            const modelFilePath = userInfoFolderPath.getSubFile('model.json');

            _.check(await this.systemDrive.createFileIfNotExists(modelFilePath, {immutable:false, hidden:false, type:FileType.Other, mimeType:'application/json'}, {}, abortController));
            
            const storage = new DriveStorage(this._app, this._app.uidUtil.derive(this.uid, this.#_config.classes.UserManager.frozen.driveStorageLabel_hex_128 as hex_128, true), systemDrive, modelFilePath);

            if (action === 'register')
            {
                thisProgressor.setProgress(true, {status:RegisterLoginStatus.Other, details:'adding user entry'});

                const usersData = _.value(await preFileStorage.getFileData(usersFilePath, abortController));
                const stream = _.value(await usersData.get());
                const uint8Array = _.value(await this._app.streamUtil.toUint8Array(stream));
                const users = _.value(app.jsonUtil.parse<{default:{salt:hex_1024, rounds:number, iterations:number, memory:number, online:false}}>(app.textUtil.fromUint8Array(uint8Array)));

                if (users.default !== undefined) return new Failure({code:FailureCode.USER_UNRECOVERABLE, details:'user already exists'}); //we don't support multiple users just yet

                users.default = {salt:app.baseUtil.toHex<hex_1024>(salt), rounds:hardenOptions.rounds!, iterations:hardenOptions.iterations!, memory:hardenOptions.memory!, online:false};
                
                //write the user entry to the users file
                _.check(await preFileStorage.setFileData(usersFilePath, new Data(app, async () => this._app.streamUtil.fromUint8Array(app.textUtil.toUint8Array(app.jsonUtil.stringify(users)))), abortController));
            }

            //let model know we are logged in
            _.check(await this.#_model.onLogin(storage, false, response));

            thisProgressor.setProgress(1, {status:RegisterLoginStatus.Succeeded, details:''});

            return true;
        }
        catch (error)
        {
            await this.#unmountSystemDrive();

            return this._app.warn(error, 'failed to register/login', [], {names:[UserManager, this.#registerLoginHandler]});
        }
    }

    async #registerOffline(_:AbortableHelper<A>, abortController:AbortController<A>, systemDrive:ISystemDrive<A>, totp:totp, totpSecret:totpsecret, progressor:IProgressor<A, {status:RegisterLoginStatus, details:string}>):Promise<UserJSON.RegisterResponseJSON | IFailure | IAborted | IError>
    {
        try
        { 
            //the user info folder path is where we store user specific data
            const userInfoFolderPath = systemDrive.userInfoFolderPath;

            //get the registration and online json file paths
            const registrationFilePath = userInfoFolderPath.getSubFile('registration.json');

            progressor.setProgress(true, {status:RegisterLoginStatus.Other, details:'checking if account already exists'});
            
            //check if the registration file exists
            const exists = _.value(await systemDrive.existsFile(registrationFilePath));
            if (exists === true) return new Failure({code:FailureCode.USER_UNRECOVERABLE, details:'user already exists'});

            progressor.setProgress(true, {status:RegisterLoginStatus.Other, details:'verifying totp'});

            //check that the totp secret matches the totp code (we don't actually use the totpsecret for offline login, but we will use it when/if they convert to an online account)
            const success = _.value(await this._app.totpUtil.verify(totp, totpSecret, Math.floor(Date.now() / 1000)));
            if (success !== true) return new Failure({code:FailureCode.USER_UNRECOVERABLE, details:'invalid totp'});

            progressor.setProgress(true, {status:RegisterLoginStatus.Other, details:'creating account data'});

            //create the registration file
            const registrationData:RegistrationData = {plainTextMode:this._app.environment.frozen.isPlainTextMode, id:'', totpSecret, online:false};
            _.value(await systemDrive.createFile(registrationFilePath, {immutable:false, hidden:false, type:FileType.Other, mimeType:'application/json'}, registrationData, abortController));
            
            progressor.setProgress(1, {status:RegisterLoginStatus.Other, details:'created offline account'});

            return {loginToken:'', id:'', attempts:0, admin:false};
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to register offline', arguments, {names:[UserManager, this.#registerOffline]});
        }
    }

    async #loginOffline(_:AbortableHelper<A>, abortController:AbortController<A>, systemDrive:ISystemDrive<A>, progressor:IProgressor<A, {status:RegisterLoginStatus, details:string}>):Promise<UserJSON.RegisterResponseJSON | UserJSON.LoginResponseJSON | IFailure | IAborted | IError>
    {
        try
        {
            //the user info folder path is where we store user specific data
            const userInfoFolderPath = systemDrive.userInfoFolderPath;

            //get the registration and online json file paths
            const registrationFilePath = userInfoFolderPath.getSubFile('registration.json');

            //check if offline registration data exists
            const exists = _.value(await systemDrive.hasFileData(registrationFilePath));
            if (exists !== true) return new Failure({code:FailureCode.USER_UNRECOVERABLE, details:'registration data could not be found'});

            //get offline registration data
            const registrationData = _.value(await systemDrive.getFileData<RegistrationData>(registrationFilePath, abortController, DataFormat.JsonObject));
 
            //accounts created with plain text mode must always be accessed in plain text mode
            if (registrationData.plainTextMode !== this._app.environment.frozen.isPlainTextMode) return new Failure({code:FailureCode.USER_UNRECOVERABLE, details:'plain text mode mismatch'});
            
            progressor.setProgress(1, {status:RegisterLoginStatus.Other, details:'logged in offline'});

            return {loginToken:'', id:'', attempts:0, admin:false};
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to login offline', arguments, {names:[UserManager, this.#loginOffline]});
        }
    }

    /**
     * Logs the user out.
     *
     * @returns A Promise that resolves to a boolean indicating whether the user was successfully logged out.
     */
    public async logout():Promise<true | IError>
    {
        //if they are already logged out, throw an error
        if (this.#_model.loggedIn !== true) this._app.throw('User is already logged out', []);

        //undefine the keys
        this.#_hkdfKey = undefined!;
        this.#_hmacKey = undefined!;

        //unmount the system drive
        await this.#unmountSystemDrive();

        //let the model know we are logging out
        this.#_model.onLogout();

        return await this.#_sessionStorage.remove(this.#_config.classes.UserManager.frozen.sessionStorageKey);
    }

    async #deriveKeys(privateKey:Hex_512 | HKDFKey):Promise<void>
    {
        const hkdfKey = this.#_hkdfKey = privateKey instanceof Uint8Array ? await this._app.keyUtil.import(privateKey, KeyType.HKDF) : privateKey;
        
        this.#_hmacKey = await this._app.keyUtil.derive(hkdfKey, this.#_config.classes.UserManager.frozen.hmacLabel_hex_128 as hex_128, KeyType.HMAC, HashType.SHA_256);
    }

    async #derivePublicKeyHash():Promise<hex_256>
    {
        const app = this._app;

        return app.hmacUtil.derive(this.#_hmacKey, app.hmacUtil.derivePAE([app.baseUtil.fromHex(this.#_config.classes.UserManager.frozen.publicKeyLabel_hex_128 as hex_128)]), HMACOutputFormat.hex);
    }

    async #createFileStorage(hkdfKey:HKDFKey):Promise<IFileStorage<A> | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            const fileStorage = new FileStorage<A>(this._app, hkdfKey, async (app:A, _fileStorage:IFileStorage<A>, rootFolderPath:FolderPath):Promise<IFileStorageAdapter<A> | IAborted | IError> => 
            {
                //if the bridge is available, use the FSFileStorageAdapter, otherwise use the OPFSFileStorageAdapter
                if (this._app.bridgeManager.available === true) 
                {
                    const adapter = new BridgeFileStorageAdapter(app, rootFolderPath);
                    _.check(await adapter.init());

                    return adapter;
                }

                const adapter = new OPFSFileStorageAdapter(app, rootFolderPath);
                _.check(await adapter.init());

                return adapter;
            });

            const success = await fileStorage.init();
            if (success !== true) this._app.throw('Failed to create storage adapter', []);

            return fileStorage;
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to create file storage', arguments, {names:[UserManager, this.#createFileStorage]});
        }
    }

    async #mountSystemDrive():Promise<ISystemDrive<A> | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            //derive an hkdf key based on the user's hkdfkey specifically for the user's system drive
            const hkdfKey = _.value(await this._app.keyUtil.derive(this.#_hkdfKey, this.#_config.classes.UserManager.frozen.systemDriveLabel1_hex_128 as hex_128, KeyType.HKDF));

            //create the system drive, and pass in the storage adapter
            const systemDrive = new SystemDrive(this._app, this._app.uidUtil.derive(this.uid, this.#_config.classes.UserManager.frozen.systemDriveLabel2_hex_128 as hex_128, true), async (app:A, _drive:IDrive<A>) => this.#createFileStorage(hkdfKey), 
            (drive:IDrive<A>, path:FolderPath) => new DriveFolder<A>(drive, path), 
            (drive:IDrive<A>, path:FilePath) => new DriveFile<A>(drive, path));

            _.check(await systemDrive.init());

            //mount the drive
            const mounted = _.value(await this._app.fileSystemManager.mount(systemDrive));
            if (mounted !== true) this._app.throw('Failed to mount system drive', []);

            //set the system drive
            this.#_systemDrive = systemDrive;

            return systemDrive;
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to mount system drive', arguments, {names:[UserManager, this.#mountSystemDrive]});
        }
    }

    async #unmountSystemDrive():Promise<void | IAborted | IError>
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            if (this.#_systemDrive === undefined) return;
            const systemDrive = this.#_systemDrive;

            //unmount the drive
            const unmounted = _.value(await this._app.fileSystemManager.unmount(systemDrive));
            if (unmounted !== true) this._app.throw('Failed to unmount system drive', []);

            //undefine the system drive
            this.#_systemDrive = undefined;
        }
        catch (error)
        {
            return this._app.warn(error, 'failed to unmount system drive', arguments, {names:[UserManager, this.#mountSystemDrive]});
        }
    }

    /**
     * Resumes the user's session. If they were logged in offline, this will resume their offline session. If they were logged in online, it will try to resume their online session, and revert to offline mode otherwise.
     * @returns A Promise that resolves to a boolean indicating whether the session was successfully resumed.
     */
    public async resumeSession():Promise<boolean | IAborted | IError> //if they were logged in offline, this will resume their offline session. if they wre logged in online, it will try to resume their online session, and revert to offline mode otherwise
    {
        try
        {
            const _ = this.abortableHelper.throwIfAborted();

            //get session data from session storage
            const data = _.value(await this.#_sessionStorage.get<SessionData>(this.#_config.classes.UserManager.frozen.sessionStorageKey, true));

            //if no session data is found, abort resume session
            if (data === undefined) return false;

            //derive the encryption keys
            _.value(await this.#deriveKeys(this._app.baseUtil.fromHex<Hex_512>(data.hardenedKey)));

            //create the system drive
            const systemDrive = _.value(await this.#mountSystemDrive());

            const userInfoFolderPath = systemDrive.userInfoFolderPath;
            const registrationFilePath = userInfoFolderPath.getSubFile('registration.json');

            //check if registration.json exists
            const exists = _.value(await systemDrive.existsFile(registrationFilePath));
            if (exists === false) 
            {
                _.check(await this.#unmountSystemDrive());
                
                return this.warn('session data not found'); //just warn here, as i don't know that this should be considered an error just yet
            }
            const modelFilePath = userInfoFolderPath.getSubFile('model.json');

            const registrationFileData = _.value(await systemDrive.getFileData<RegistrationData>(registrationFilePath, this, DataFormat.JsonObject));
            if (registrationFileData === undefined) this._app.throw('registration data not found', []);

            //set session data in session storage
            const sessionData:SessionData = 
            {
                userID:data.userID, 
                sessionID:'', 
                sessionExpires:0, 
                hardenedKey:data.hardenedKey, 
            };
            _.check(await this.#_sessionStorage.set<SessionData>(this.#_config.classes.UserManager.frozen.sessionStorageKey, sessionData));

            const storage = new DriveStorage<A>(this._app, this._app.uidUtil.derive(this.uid, this.#_config.classes.UserManager.frozen.driveStorageLabel_hex_128 as hex_128, true), systemDrive, modelFilePath);
            
            //call onLogin method in UserModel to update user login status
            this.#_model.onLogin(storage, false, {id:data.userID, attempts:0, admin:false});

            this.log('session resumed');

            return true;
        }
        catch (error)
        {
            await this.#unmountSystemDrive();

            return this._app.warn(error, 'failed to resume session', [], {names:[UserManager, this.resumeSession]});
        }
    }

    public async goOnline():Promise<boolean>
    {
        //todo, register if need be
        return true;
    }

    public get systemDrive():ISystemDrive<A> { return this.#_systemDrive!; }

    /**
     * Gets the user model.
     * @returns The user model.
     */
    public get model():UserModel<A> { return this.#_model; }
}