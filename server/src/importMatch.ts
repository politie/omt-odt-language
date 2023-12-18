import { dirname, isAbsolute, resolve } from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function getUriMatch(uri: string, document: TextDocument, shorthands: Map<string, string>): string {
    const link = replaceStart(uri.trim(), shorthands);
    return isAbsolute(link) ? resolve(document.uri, link) : toAbsolutePath(document, link);
}

export function getDiMatch(uri: string): string | undefined {
    const declaredImportMatch = /(?:module:)(.*)/;
    const diMatch = declaredImportMatch.exec(uri);
    if (diMatch) {
        return diMatch[1];
    }
    return undefined;
}

/**
 * Replace the start of the uri with the mapped value if it starts with a shorthand, otherwise returns the same path.
 * @param uri the path that may start with a shorthand
 * @param shorthands a mapping of shorthands to the paths they represent
 */
function replaceStart(uri: string, shorthands: Map<string, string>): string {
    shorthands.forEach((value, key) => {
        if (uri.startsWith(key)) {
            uri = uri.substring(key.length);
            const lastSlashIndex = osNeutralLastSlashIndex(value);
            if (lastSlashIndex === -1) {
                uri = value;
            } else {
                uri = resolve(value.substring(0, osNeutralLastSlashIndex(value)), '.' + uri);
            }
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
export function dirpath(uri: string): string {
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
