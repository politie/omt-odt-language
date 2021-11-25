import { dirname, isAbsolute, resolve } from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';

const omtUriMatch = /( +["']?)(.*\.omt)/;
const declaredImportMatch = /( +)(?:module:)(.*):/;

export function getUriMatch(line: string, document: TextDocument, shorthands: Map<string, string>) {
    const uriMatch = omtUriMatch.exec(line);
    if (uriMatch) {
        // match[0] is the full match inluding the whitespace of match[1]
        // match[1] is the whitespace and optional quotes. both of which we don't want to include in the linked text
        // match[2] is the link text, including the @shorthands
        const link = replaceStart(uriMatch[2].trim(), shorthands);
        const url = isAbsolute(link) ? resolve(document.uri, link) : toAbsolutePath(document, link);
        return { uriMatch, url };
    }
}

export function getDiMatch(line: string) {
    const diMatch = declaredImportMatch.exec(line);
    if (diMatch) {
        // match[0] is the full line match including the trailing colon
        // match[1] is the whitespace prepending the import
        // match[2] is the module name
        const declaredImportModule = '' + diMatch[2];
        return { diMatch, declaredImportModule }
    }
}

/**
 * Replace the start of the uri with the mapped value if it starts with a shorthand, otherwise returns the same path.
 * @param uri the path that may start with a shorthand
 * @param shorthands a mapping of shorthands to the paths they represent
 */
function replaceStart(uri: string, shorthands: Map<string, string>): string {
    shorthands.forEach((value, key) => {
        if (uri.startsWith(key)) {
            uri = uri.substr(key.length);
            uri = resolve(value.substr(0, osNeutralLastSlashIndex(value)), '.' + uri);
        }
    });
    return uri;
}

/**
 * Makes an absolute path based on a link relative to a document
 * @param document The document the link is relative to
 * @param link a relative path from the document
 */
function toAbsolutePath(document: TextDocument, link: string): string {
    return resolve(dirpath(document.uri), link)
}

/**
 * Convert the uri to a path to a directory and make sure it does not start with `file://`
 * @param uri path to be made into a dirpath
 */
function dirpath(uri: string): string {
    uri = dirname(uri);
    return uri.startsWith('file:') ? uri.substr(7) : uri;
}

/**
 * Find the last index of the slash*.
 * @param path path we want to find the last slash of
 */
function osNeutralLastSlashIndex(path: string): number {
    const unixIndex = path.lastIndexOf('/*');
    return unixIndex >= 0 ? unixIndex : path.lastIndexOf('\\*');
}