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

    /**
     * The folders being watched for changes.
     */
    get watchedFolders() {
        return Array.from(this.folders.values());
    }

    /**
     * All the OMT modules in the watched folders
     */
    get watchedModules() {
        return Array.from(this.workspaceModules.modules.values());
    }

    /**
     * Create a new workspaceLookup listening to workspace events.
     * call `init()` to start listening to these events.
     * @param workspace workspace of the client
     */
    constructor(private workspace: RemoteWorkspace) { }

    /**
     * Attach change handlers to workspace folders and open files.
     * Then do a first scan of all the folders and files for recognized OMT content
     */
    init(): Promise<void> {
        this.workspace.onDidChangeWorkspaceFolders(event => {
            // This event is fired when the user adds or removes a folder to/from their workspace
            event.added.map(this.addFolder);
            event.removed.forEach(folder => this.removeFolder(folder));
        });
        // `onDidChangeWatchedFiles` changes are not fired by editing a file
        // but when a file changes outside of the clients control (a git pull for example)
        this.workspace.connection.onDidChangeWatchedFiles((params) => this.watchedFilesChanged(params));

        return new Promise<void>((resolve, reject) => {

            this.workspace.getWorkspaceFolders()
                .then((folders) => {
                    if (folders) {
                        Promise.all(folders.map(folder => this.addFolder(folder)))
                            .then(() => resolve())
                            .catch(reason => reject(reason));
                    } else {
                        resolve();
                    }
                });
        })
    }

    private watchedFilesChanged(event: DidChangeWatchedFilesParams) {
        // when a file watched by the client is changed even when it isn't open in the editor (by version control for example)
        // this only happens with saved files and the changes should be read from the filesystem
        event.changes.forEach(change => {
            if (change.uri.endsWith('.omt')) {
                switch (change.type) {
                    case FileChangeType.Changed:
                    case FileChangeType.Created:
                        parseOmtFile(change.uri.substr(7))
                            .then(
                                (result) => this.workspaceModules.checkForChanges(result),
                                (reason) => console.error(`something went wrong while parsing ${change.uri}: ${reason}`))
                            .catch(reason => {
                                console.error(`something went wrong while parsing ${change.uri}: ${reason}`);
                            });
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
    }

    /**
     * update the changed document content to the lookup before it is saved.
     * This way we can use the created OMT functionality in other features of the server
     * @param change The document being changed with it's changes applied.
     */
    fileChanged(change: TextDocumentChangeEvent<TextDocument>) {
        // these changes will be called for each little edit in the document
        // the event will fire before the change has been saved to file.
        // Therefore we need the text from the change.document instead of a FileSystem call
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
            const message = `folder '${folder.uri}' was already added`;
            console.error(message);
            return Promise.reject(message);
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
