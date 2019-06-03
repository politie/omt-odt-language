
import * as path from 'path';
import { DocumentLink, DocumentLinkProvider, TextDocument } from 'vscode';
import { Position, Range, Uri } from 'vscode';

const MATCHER = /(\s)(.*)(\.omt)/;

// Geeft een set zogenaamde DocumentLinks terug die VSCode in de editor toont.
export default class OMTLinkProvider implements DocumentLinkProvider {
    public provideDocumentLinks(document: TextDocument): Promise<DocumentLink[]> {
        const DocumentLinks: DocumentLink[] = findOMTUrl(document);
        return Promise.resolve(DocumentLinks ? DocumentLinks : []);
    }
}

// Loop door de regels van een OMT bestand en zoek links naar andere OMT bestanden
// TODO: Loop alleen door de import regels heen.
function findOMTUrl(document: TextDocument): DocumentLink | undefined {
    let documentLinks: DocumentLink[] = [];
    for (let l = 0; l <= document.lineCount - 1; l++) {
        const line = document.lineAt(l);
        const match = MATCHER.exec(line.text);

        if (match) {
            const link = match[0].replace(/\'/, '').trim();
            const start = new Position(line.lineNumber, match[0].length - match[0].trim().length);
            const end = start.translate(0, match[0].length - 1);

            // Maak een lege Uri aan om later een relative path in te stoppen.
            let url = new Uri('file');

            url = url.with({
                scheme: 'file',
                path: path.resolve(path.dirname(document.fileName), link)
            });

            documentLinks.push(new DocumentLink(new Range(start, end), url));
        }

        if (l === document.lineCount) {
            break;
        }
    }

    return documentLinks;
}