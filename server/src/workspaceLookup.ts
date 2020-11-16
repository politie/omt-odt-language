import { WorkspaceFolder, RemoteWorkspace, FileChangeType, TextDocumentChangeEvent, DidChangeWatchedFilesParams } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseOmtFile, parseOmtText } from './omtFileParser';
import { globPromise } from './globPromise';
import { WorkspaceModules } from './workspaceModules';

/**
 * Tracks changes to the workspace and important files for core functionality of the language server
 */
export class WorkspaceLookup {
    private folders = new Map<string, WorkspaceFolder>();
    private workspaceModules = new WorkspaceModules();
    private readonly omtPattern = '**/*.omt';

    get watchedFolders() {
        return Array.from(this.folders.values());
    }

    get watchedModules() {
        return Array.from(this.workspaceModules.modules.values());
    }

    /**
     * Create a new workspaceLookup listening to workspace events.
     * call init to start listening to these events.
     * @param workspace workspace of the client
     */
    constructor(private workspace: RemoteWorkspace) {
        this.workspaceModules = new WorkspaceModules();
    }

    init(): Promise<void> {
        this.workspace.onDidChangeWorkspaceFolders(event => {
            this.collectionPromise(event.added, this.addFolder)
            // event.added.forEach(folder => this.addFolder(folder));
            event.removed.forEach(folder => this.removeFolder(folder));
        });
        this.workspace.connection.onDidChangeWatchedFiles((params) => this.watchedFilesChanged(params));
        return new Promise<void>((resolve, reject) => {

            this.workspace.getWorkspaceFolders()
                .then((folders) => {
                    if (folders) {
                        Promise.all(folders.map(folder => this.addFolder(folder)))
                            .then(() => {
                                resolve()
                            })
                            .catch(reason => {
                                reject(reason)
                            });
                    } else {
                        resolve();
                    }
                });
        })
    }

    private collectionPromise<T>(array: T[], func: (param: T) => Promise<void>): Promise<void> {
        const results: Promise<void>[] = [];
        array.forEach(item => {
            results.push(func(item));
        });
        return new Promise<void>((resolve, reject) => {
            Promise.all(results)
                .then(() => resolve())
                .catch(reason => reject(reason));
        });
    }

    private watchedFilesChanged(event: DidChangeWatchedFilesParams) {
        // console.log(`workspaceLookup.watchedFilesChanged ${event.changes.length}`);
        // when a file watched by the client is changed even when it isn't open in the editor (by version control for example)
        // this only happens with saved files and the changes should be read from the filesystem
        return new Promise<void>((resolve, reject) => {
            const parseResults: Promise<void>[] = [];

            event.changes.forEach(change => {
                if (change.uri.endsWith('.omt')) {
                    switch (change.type) {
                        case FileChangeType.Changed:
                        case FileChangeType.Created:
                            parseResults.push(parseOmtFile(change.uri.substr(7))
                                .then(
                                    (result) => this.workspaceModules.checkForChanges(result),
                                    (reason) => { reject(reason) })
                                .catch(reason => {
                                    console.error(`while parsingOmtFile ${change.uri} something went wrong: ${reason}`);
                                    reject(reason);
                                }));
                            break;
                        case FileChangeType.Deleted:
                            this.workspaceModules.removeFile(change.uri.substr(7));
                            break;
                        default:
                            console.warn(`unsupported FileChangeType '${change.type}'`);
                            break;
                    }
                }
            });

            Promise.all(parseResults).then(() => resolve());
        });
    }

    fileChanged(change: TextDocumentChangeEvent<TextDocument>) {
        // these changes will be called for each little edit in the document
        // the event will fire before the change has been saved to file.
        // Therefore we need the text from the change.document
        this.workspaceModules.checkForChanges({
            path: change.document.uri.substr(7),
            ...parseOmtText(change.document.getText())
        });
    }

    /**
     * Add a folder and its contents to the watchers
     * @param folder the folder that should be in the workspace
     */
    addFolder(folder: WorkspaceFolder) {
        if (this.folders.get(folder.uri)) {
            console.error('workspace folder was already added');
            throw new Error('workspace folder was already added');
        }
        else {
            this.folders.set(folder.uri, folder);
            return this.scanFolder(folder);
        }
    }

    /**
     * Remove a folder and all of its contents from the watchers
     * @param folder the folder that should no longer be in the workspace
     */
    removeFolder(folder: WorkspaceFolder) {
        if (!this.folders.delete(folder.uri)) {
            throw new Error('folder was not added and being watched');
        }
        // remove the modules of the removed folder
        // use the substring because we used that to add too (in scanFolder)
        this.workspaceModules.removeFolder(folder.uri.substr(7));
    }

    /**
     * Check all omt files in the workspace for watchable files
     */
    scanAll(): Promise<void> {
        const scanResults: Promise<void>[] = [];
        this.folders.forEach((folder) => { scanResults.push(this.scanFolder(folder)) });
        return Promise.all(scanResults)
            .then(); // reduce void[]  to a single void
    }

    /**
     * scan a directory and all its subdirectories for omt files
     * @param folder the folder which contents will be searched for omt files
     */
    private scanFolder(folder: WorkspaceFolder): Promise<void> {
        // we need to remove the first 7 character (file://) to make the pattern work
        return globPromise(`${folder.uri.substr(7)}/${this.omtPattern}`)
            .then(files => Promise.all( // scan all omtfiles async
                files.map(file => this.processOmtFile(file))))
            .then();// and reduce the void[] result to a single void
    }

    private processOmtFile(uri: string): Promise<void> {
        return parseOmtFile(uri).then((result) => {
            this.workspaceModules.checkForChanges(result);
        });
    }

    /**
     * Gets the path to the file containing an omt module with the specified name. returns undefined if the module could not be found.
     * @param name the name of the module
     */
    getModulePath(name: string): string | undefined {
        return this.workspaceModules.getModulePath(name);
    }
}
