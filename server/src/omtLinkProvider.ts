import * as path from 'path';
import { DocumentLink, Position, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { readFileSync } from 'fs';
import { glob } from 'glob';
import { WorkspaceLookup } from './workspaceLookup';

const MATCHER = /( +["']?)(.*\.omt)/;
const importMatch = /^import:/g;
const otherDeclareMatch = /^(\w+):/g;

// Provides DocumentLinks for the imports of an OMT file.
export default class OMTLinkProvider {

    constructor(private workspaceLookup: WorkspaceLookup) { }

    provideDocumentLinks(document: TextDocument): Promise<DocumentLink[]> {
        console.log('server omtLinkProvider.provideDocumentLinks');

        // regular path links, with or without shorthands
        const shorthands = this.contextPaths(document);
        const DocumentLinks: DocumentLink[] = findOMTUrl(document, (uri) => replaceStart(uri, shorthands));

        // declared imports
        /** TODO for declared imports
         * find declared import links by pattern
         * find module they are declared in and make that a link
         * when no apropriate module can be found give a tooltip
         * find the activities that are listed under the declared import in subsequent files and link there
         */

        return Promise.resolve(DocumentLinks ? DocumentLinks : []);
    }

    private contextPaths(document: TextDocument) {
        const pathPaths = glob.sync('**/tsconfig**.json')
            // we need to filter for same parent because another config may have some of the same paths
            .filter(uri => document.uri.startsWith(uri.substr(0, uri.lastIndexOf('/'))))
            .map(uri => {
                const file = readFileSync(uri, 'utf8');
                try {
                    const json = JSON.parse(file);
                    if (json.compilerOptions && json.compilerOptions.paths) {
                        // now make a path from the config folder to the keys value and map that
                        const paths: [string, string][] = [];
                        for (let key in json.compilerOptions.paths) {
                            const relPath = json.compilerOptions.paths[key].toString();
                            const newPath = path.resolve(path.dirname(uri), relPath);
                            paths.push([key.substr(0, key.lastIndexOf('/*')), newPath]);
                        }
                        return paths;
                    }
                } catch (e) { console.error(); }
                // all other paths return undefined
            }).filter(paths => paths != undefined) as {} as [string, string][];
        // make it typed
        const sourceType: [string, string][] = [];
        const mapSource = sourceType.concat.apply([], pathPaths);
        return new Map<string, string>(mapSource);
    }
}

/**
 * returns all the text of a line in the provided document
 * @param document A text document with at least [line] amount of lines
 * @param line the line to be returned
 */
function getLine(document: TextDocument, line: number): string {
    return document.getText(Range.create(Position.create(line, 0), Position.create(line, Number.MAX_VALUE)));
}

/**
 * Makes an absolute path based on a link relative to a document
 * @param document The document the link is relative to
 * @param link a relative path from the document
 */
function toAbsolutePath(document: TextDocument, link: string): string {
    return path.resolve(dirpath(document.uri), link)
}

/**
 * Convert the uri to a path to a directory and make sure it does not start with file:
 * @param uri path to be made into a dirpath
 */
function dirpath(uri: string): string {
    uri = path.dirname(uri);
    return uri.startsWith('file:') ? uri.substr(7) : uri;
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
            uri = path.resolve(value.substr(0, value.lastIndexOf('/*')), '.' + uri);
        }
    });
    return uri;
}

/**
 * Find links to other imported OMT files
 * @param document the OMT file we are scanning
 * @param resolveShorthand function to resolve shorthand annotations at the start of import paths
 */
function findOMTUrl(document: TextDocument, resolveShorthand: (uri: string) => string): DocumentLink[] {
    console.log('server omtLinkProvider.findOMTUrl');
    let documentLinks: DocumentLink[] = [];
    // so match after import: until we need any other (\w+): without any preceding spaces
    let isScanning = false;
    for (let l = 0; l <= document.lineCount - 1; l++) {
        const line = getLine(document, l);
        if (importMatch.exec(line)) {
            isScanning = true; // start scannning lines for import paths after we enter an import block
        } else if (isScanning) {
            if (otherDeclareMatch.exec(line)) {
                break; // we can stop matching after the import block
            } else {
                const match = MATCHER.exec(line);
                if (match) {
                    // match[0] is the full match inluding the whitespace of match[1]
                    // match[1] is the whitespace and optional quotes. both of which we don't want to include in the linked text
                    // match[2] is the link text, including the @shorthands
                    let link = match[2].trim();
                    const start = Position.create(l, match[1].length);
                    const end = Position.create(l, start.character + match[2].length);

                    link = resolveShorthand(link);

                    let url: string;
                    if (path.isAbsolute(link)) {
                        url = path.resolve(document.uri, link);
                    } else {
                        url = toAbsolutePath(document, link);
                    }

                    documentLinks.push(DocumentLink.create(Range.create(start, end), url));
                }
            }
        }
    }
    return documentLinks;
}
