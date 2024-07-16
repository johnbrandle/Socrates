/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

export enum FailureCode
{
    PROXY_FETCH_FAILED = 'proxyFetchFailed',
    PROXY_INVALID_OR_MISSING_PROXY_KEY = 'proxyInvalidOrMissingProxyKey',
    
    GLOBAL_UNKNOWN = 'globalUnknown',
    GLOBAL_CONNECTION_ERROR = 'globalCommunicationError',
    GLOBAL_JSON_PARSE = 'jsonparseerror',
    GLOBAL_JSON_STRINGIFY = 'jsonstringifyerror',
    GLOBAL_MULTIPART_PARSE = 'multipartparseerror',
    GLOBAL_HASH_CREATION = 'hashcreation',
    GLOBAL_UNSUPPORTED_COMMAND = 'unsupportedcommand',
    GLOBAL_INVALID_INPUT_DATA = 'invalidinputdata',
    GLOBAL_INVALID_REQUEST = 'invalidrequest',
    GLOBAL_UNAUTHORIZED_ACCESS = 'globalUnauthorizedAccess',
    GLOBAL_INVALID_ID = 'invalidid',
    GLOBAL_NOT_AN_INTEGER = 'notaninteger',
    GLOBAL_INTEGER_OUT_OF_RANGE = 'integeroutofrange',
    GLOBAL_NOT_A_CURRENCY = 'notacurrency',
    GLOBAL_CURRENCY_OUT_OF_RANGE = 'currencyoutofrange',
    GLOBAL_NOT_A_FLOAT = 'notafloat',
    GLOBAL_FLOAT_OUT_OF_RANGE = 'floatoutofrange',
    GLOBAL_NOT_AN_ARRAY = 'notAnArray',
    GLOBAL_ARRAY_OUT_OF_RANGE = 'arrayOutOfRange',
    GLOBAL_ARRAY_VALUE_TYPE_INVALID = 'arrayValueTypeInvalid',
    GLOBAL_ENUM_VALUE_INVALID = 'globalEnumValueInvalid',
    GLOBAL_NOT_A_STRING = 'notastring',
    GLOBAL_STRING_OUT_OF_RANGE = 'stringoutofrange',
    GLOBAL_STRING_BYTES_OUT_OF_RANGE = 'stringbytesoutofrange',
    GLOBAL_NOT_A_HASH = 'globalNotAHash',
    GLOBAL_NOT_HEX = 'globalNotHex',
    GLOBAL_NOT_BASE24 = 'globalNotBase27',
    GLOBAL_NOT_BASE64 = 'globalNotBase64',
    GLOBAL_STORE_PUT_FAIL = 'globalStorePutFail',
    GLOBAL_STORE_GET_FAIL = 'globalStoreGetFail',

    USER_NOT_FOUND = 'usernotfound',
    USER_EXISTS = 'userexists',
    USER_UNRECOVERABLE = 'userUnrecoverable',
    USER_DISABLED = 'userDisabled',
    USER_CRENDENTIALS_INVALID = 'userCredentialsInvalid',
    USER_SESSION_INVALID = 'userSessionInvalid',
    USER_EPOCH_MISMATCH = 'userEpochMismatch',

    SESSION_LOGIN_TOKEN_INVALID = 'sessionLoginTokenInvalid',

    WALLET_EXISTS = 'walletExists',
    WALLET_UNRECOVERABLE = 'walletUnrecoverable',

    SYNC_DB_UNCRECOVERABLE = 'syncDBUnrecoverable',

    STORE_PRIMARY_UNRECOVERABLE = 'primaryStoreUnrecoverable',
    STORE_SECONDARY_UNRECOVERABLE = 'secondaryStoreUnrecoverable',

    MAIN_UNRECOVERABLE = 'mainUnrecoverable'
}