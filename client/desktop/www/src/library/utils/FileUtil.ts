/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import { SealedDecorator } from '../../../../../../shared/src/library/decorators/SealedDecorator.ts';
import type { IBaseApp } from '../IBaseApp.ts';

/*
export const enum MimeType 
{
    Text_PLAIN = 'text/plain',
    Text_CSV = 'text/csv',
    Text_HTML = 'text/html',
    Application_XML = 'application/xml',
    Application_JSON = 'application/json',
    Text_MARKDOWN = 'text/markdown',
    Text_CSS = 'text/css',
    Application_JAVASCRIPT = 'application/javascript',
    Application_TYPESCRIPT = 'application/typescript',
    Text_RTF = 'text/rtf',
    Text_YAML = 'text/yaml',
    Text_X_SHELLSCRIPT = 'text/x-shellscript',
    Text_X_PHP = 'text/x-php',
    Text_ASP = 'text/asp',
    Text_JSP = 'text/jsp',
    Text_X_PERL = 'text/x-perl',
    Text_X_PYTHON = 'text/x-python',
    Text_X_JAVA_SOURCE = 'text/x-java-source',
    Text_X_CSRC = 'text/x-csrc',
    Text_X_CHDR = 'text/x-chdr',
    Text_X_CPLUSPLUS_SRC = 'text/x-c++src',
    Text_X_CPLUSPLUS_HDR = 'text/x-c++hdr',
    Text_X_CSHARP = 'text/x-csharp',
    Text_X_SCALA = 'text/x-scala',
    Text_X_COFFEESCRIPT = 'text/x-coffeescript',
    Text_X_LESS = 'text/x-less',
    Text_X_SASS = 'text/x-sass',
    Text_X_SCSS = 'text/x-scss',
    Text_X_STYL = 'text/x-styl',
    Text_X_GO = 'text/x-go',
    Text_X_RUSTSRC = 'text/x-rustsrc',
    Text_X_SWIFT = 'text/x-swift',
    Text_X_VB = 'text/x-vb',
    Text_VBSCRIPT = 'text/vbscript',
    Text_X_LUA = 'text/x-lua',
    Text_X_SQL = 'text/x-sql',
    Text_X_RSRC = 'text/x-rsrc',
    Text_X_KOTLIN = 'text/x-kotlin',
    Text_X_CLOJURE = 'text/x-clojure',
    Text_X_GROOVY = 'text/x-groovy',
    Application_XHTML_XML = 'application/xhtml+xml',
    Image_PNG = 'image/png',
    Image_JPEG = 'image/jpeg',
    Image_GIF = 'image/gif',
    Image_BMP = 'image/bmp',
    Image_TIFF = 'image/tiff',
    Image_X_ICON = 'image/x-icon',
    Image_SVG_XML = 'image/svg+xml',
    Image_WEBP = 'image/webp',
    Image_HEIF = 'image/heif',
    Image_HEIC = 'image/heic',
    Application_X_INDESIGN = 'application/x-indesign',
    Application_ILLUSTRATOR = 'application/illustrator',
    Application_POSTSCRIPT = 'application/postscript',
    Image_VND_ADOBE_PHOTOSHOP = 'image/vnd.adobe.photoshop',
    Image_X_RAW = 'image/x-raw',
    Audio_MPEG = 'audio/mpeg',
    Audio_WAV = 'audio/wav',
    Audio_OGG = 'audio/ogg',
    Audio_FLAC = 'audio/flac',
    Audio_MP4 = 'audio/mp4',
    Audio_AAC = 'audio/aac',
    Audio_AC3 = 'audio/ac3',
    Audio_OPUS = 'audio/opus',
    Audio_X_MS_WMA = 'audio/x-ms-wma',
    Audio_X_AIFF = 'audio/x-aiff',
    Audio_BASIC = 'audio/basic',
    Audio_ALAC = 'audio/alac',
    Audio_MIDI = 'audio/midi',
    Audio_WEBM = 'audio/webm',
    Audio_VND_RN_REALAUDIO = 'audio/vnd.rn-realaudio',
    Audio_AMR = 'audio/amr',
    Audio_APE = 'audio/ape',
    Audio_X_CAF = 'audio/x-caf',
    Audio_X_GSM = 'audio/x-gsm',
    Video_MP4 = 'video/mp4',
    Video_WEBM = 'video/webm',
    Video_X_MATROSKA = 'video/x-matroska',
    Video_X_MSVIDEO = 'video/x-msvideo',
    Video_QUICKTIME = 'video/quicktime',
    Video_X_FLV = 'video/x-flv',
    Video_X_MS_WMV = 'video/x-ms-wmv',
    Video_OGG = 'video/ogg',
    Video_MPEG = 'video/mpeg',
    Application_X_MOBIPOCKET_EBOOK = 'application/x-mobipocket-ebook',
    Application_X_MS_READER = 'application/x-ms-reader',
    Application_X_FICTIONBOOK_XML = 'application/x-fictionbook+xml',
    Application_VND_SCRIBUS = 'application/vnd.scribus',
    Application_EPUB_ZIP = 'application/epub+zip',
    Image_AVIF = 'image/avif',
    Image_APNG = 'image/apng',
    Audio_XM = 'audio/xm',
    Video_X_MS_WMX = 'video/x-ms-wmx',
    Video_X_MS_WVX = 'video/x-ms-wvx',
    Application_X_LZH = 'application/x-lzh',
    Application_X_ISO9660_IMAGE = 'application/x-iso9660-image',
    Application_VND_MS_CAB_COMPRESSED = 'application/vnd.ms-cab-compressed',
    Application_X_ARJ = 'application/x-arj',
    Application_X_COMPRESS = 'application/x-compress',
    Application_X_COMPRESSED = 'application/x-compressed',
    Application_X_LZMA = 'application/x-lzma',
    Application_X_XZ = 'application/x-xz',
    Application_JAVA_ARCHIVE = 'application/java-archive',
    Application_X_APPLE_DISKIMAGE = 'application/x-apple-diskimage',
    Application_WIM = 'application/wim',
    Application_VND_DEBIAN_BINARY_PACKAGE = 'application/vnd.debian.binary-package',
    Application_X_RPM = 'application/x-rpm',
    Application_VND_COMICBOOK_RAR = 'application/vnd.comicbook-rar',
    Application_VND_COMICBOOK_ZIP = 'application/vnd.comicbook+zip',
    Application_VND_ANDROID_PACKAGE_ARCHIVE = 'application/vnd.android.package-archive',
    Application_X_SHOCKWAVE_FLASH = 'application/x-shockwave-flash',
  }
  */

const mimeTypeMap: { [key: string]: string } = 
{
    //text types
    'txt': 'text/plain',
    'csv': 'text/csv',
    'html': 'text/html',
    'htm': 'text/html',
    'xml': 'application/xml',
    'json': 'application/json',
    'md': 'text/markdown',
    'css': 'text/css',
    'js': 'application/javascript',
    'ts': 'application/typescript',
    'rtf': 'text/rtf',
    'log': 'text/plain',
    'yml': 'text/yaml',
    'yaml': 'text/yaml',
    'ini': 'text/plain',
    'conf': 'text/plain',
    'bat': 'text/plain',
    'cmd': 'text/plain',
    'sh': 'text/x-shellscript',
    'php': 'text/x-php',
    'asp': 'text/asp',
    'aspx': 'text/asp',
    'jsp': 'text/jsp',
    'pl': 'text/x-perl',
    'py': 'text/x-python',
    'java': 'text/x-java-source',
    'c': 'text/x-csrc',
    'h': 'text/x-chdr',
    'cpp': 'text/x-c++src',
    'hh': 'text/x-c++hdr',
    'cs': 'text/x-csharp',
    'scala': 'text/x-scala',
    'coffee': 'text/x-coffeescript',
    'less': 'text/x-less',
    'sass': 'text/x-sass',
    'scss': 'text/x-scss',
    'styl': 'text/x-styl',
    'go': 'text/x-go',
    'rs': 'text/x-rustsrc',
    'swift': 'text/x-swift',
    'vb': 'text/x-vb',
    'vbs': 'text/vbscript',
    'lua': 'text/x-lua',
    'sql': 'text/x-sql',
    'r': 'text/x-rsrc',
    'kt': 'text/x-kotlin',
    'ktm': 'text/x-kotlin',
    'kts': 'text/x-kotlin',
    'clj': 'text/x-clojure',
    'cljc': 'text/x-clojure',
    'cljs': 'text/x-clojure',
    'groovy': 'text/x-groovy',
    'xhtml': 'application/xhtml+xml',
    'xht': 'application/xhtml+xml',
    
    //image types
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'ico': 'image/x-icon',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'jfif': 'image/jpeg',
    'heif': 'image/heif',
    'heic': 'image/heic',
    'indd': 'application/x-indesign',
    'ai': 'application/illustrator',
    'eps': 'application/postscript',
    'psd': 'image/vnd.adobe.photoshop',
    'raw': 'image/x-raw',
    
    //audio types
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'ac3': 'audio/ac3',
    'opus': 'audio/opus',
    'wma': 'audio/x-ms-wma',
    'aiff': 'audio/x-aiff',
    'au': 'audio/basic',
    'alac': 'audio/alac',
    'midi': 'audio/midi',
    'weba': 'audio/webm',
    'ra': 'audio/vnd.rn-realaudio',
    'amr': 'audio/amr',
    'ape': 'audio/ape',
    'caf': 'audio/x-caf',
    'gsm': 'audio/x-gsm',

    //video types
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mkv': 'video/x-matroska',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'flv': 'video/x-flv',
    'wmv': 'video/x-ms-wmv',
    'ogv': 'video/ogg',
    'mpeg': 'video/mpeg',
    'mpg': 'video/mpeg',
    'm4v': 'video/x-m4v',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
    'f4v': 'video/x-f4v',
    'vob': 'video/x-ms-vob',
    'asf': 'video/x-ms-asf',
    'rm': 'application/vnd.rn-realmedia',
    'rmvb': 'application/vnd.rn-realmedia-vbr',
    'mts': 'video/mp2t',
    'm2ts': 'video/mp2t',
    'dat': 'video/mpeg',
    'qt': 'video/quicktime',
    'divx': 'video/divx',
    'xvid': 'video/x-xvid',
    'mxf': 'application/mxf',
    'lrv': 'video/mp4',
    'hevc': 'video/hevc',
    'h264': 'video/h264',
    'h265': 'video/h265',

    //document types
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'odt': 'application/vnd.oasis.opendocument.text',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    'odp': 'application/vnd.oasis.opendocument.presentation',
    'djvu': 'image/vnd.djvu',
    'ps': 'application/postscript',
    'latex': 'application/x-latex',
    'tex': 'application/x-tex',

    //archive types
    'zip': 'application/zip',
    'rar': 'application/vnd.rar',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    '7z': 'application/x-7z-compressed',
    'bz': 'application/x-bzip',
    'bz2': 'application/x-bzip2',
    'lzh': 'application/x-lzh',
    'iso': 'application/x-iso9660-image',
    'cab': 'application/vnd.ms-cab-compressed',
    'arj': 'application/x-arj',
    'z': 'application/x-compress',
    'tgz': 'application/x-compressed',
    'lzma': 'application/x-lzma',
    'xz': 'application/x-xz',
    'jar': 'application/java-archive',
    'war': 'application/java-archive',
    'ear': 'application/java-archive',
    'dmg': 'application/x-apple-diskimage',
    'wim': 'application/wim',
    'deb': 'application/vnd.debian.binary-package',
    'rpm': 'application/x-rpm',
    'cbr': 'application/vnd.comicbook-rar',
    'cbz': 'application/vnd.comicbook+zip',
    'apk': 'application/vnd.android.package-archive',

    //other
    'swf': 'application/x-shockwave-flash',
};

@SealedDecorator()
export class FileUtil<A extends IBaseApp<A>>
{
    private _app:A;

    public constructor(app:A)
    {
        this._app = app;
    }

    public getMimeType(extension:string):string | undefined
    {
        return mimeTypeMap[extension];
    }

    public extractNameAndExtension(nameWithExtension:string):[string, string]
    {
        nameWithExtension = nameWithExtension.trim();

        if (nameWithExtension.length === 0) this._app.throw('FileUtil: nameWithExtension cannot be empty', [], {correctable:true});

        const lastIndexOfDot = nameWithExtension.lastIndexOf('.');
        if (lastIndexOfDot === -1) return [nameWithExtension, ''];

        const name = nameWithExtension.substring(0, lastIndexOfDot);
        const extension = nameWithExtension.substring(lastIndexOfDot + 1).toLowerCase();

        return [name, extension];
    }

    public isVideo(mimeType:string):boolean
    {
        if (!mimeType) return false;

        //standard video MIME types start with 'video/'
        if (mimeType.startsWith('video/')) return true;

        //handle special cases or non-standard video MIME types
        const specialVideoTypes: Set<string> = new Set([
            'application/vnd.rn-realmedia',
            'application/vnd.rn-realmedia-vbr',
            'application/mxf',
        ]);

        return specialVideoTypes.has(mimeType);
    }

    public isImage(mimeType:string):boolean
    {
        if (!mimeType) return false;

        //standard image MIME types start with 'image/'
        if (mimeType.startsWith('image/')) return true;

        //handle special cases or non-standard image MIME types
        const specialImageTypes:Set<string> = new Set([
            'application/x-indesign',
            'application/illustrator',
            'application/postscript',
            'image/vnd.adobe.photoshop',
            'image/x-raw',
        ]);

        return specialImageTypes.has(mimeType);
    }
}