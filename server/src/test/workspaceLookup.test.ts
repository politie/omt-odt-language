import { expect, use } from "chai";
import { resolve } from "path";
import { SinonStub, stub } from "sinon";
import { FileChangeType, RemoteWorkspace, WorkspaceFoldersChangeEvent } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { WorkspaceLookup } from "../workspaceLookup";
import * as omtFileParser from '../omtFileParser';
import * as globPromise from '../globPromise';
import { CheckFileResult } from "../types";
import * as sinonChai from 'sinon-chai';
use(sinonChai);

describe('WorkspaceLookup', () => {
    let workspaceLookup: WorkspaceLookup;
    let stubbedWorkspace: RemoteWorkspace;
    const defaultFolder = '/folder/one'

    let globStub: SinonStub;
    const defaultGlobResult = `${defaultFolder}/fileresult.omt`;
    let parseOmtFileStub: SinonStub;
    const originalParseResult: CheckFileResult = {
        path: defaultGlobResult,
        module: { name: 'moduleTestName' },
    };
    let getWorkspaceFoldersStub: SinonStub;

    beforeEach(() => {
        stubbedWorkspace = <RemoteWorkspace><unknown>{
            getWorkspaceFolders: () => { /** dummy */ },
            onDidChangeWorkspaceFolders: () => { /** dummy */ },
            applyEdit: () => { /** dummy */ },
            connection: {
                onDidChangeWatchedFiles: () => { /** dummy */ }
            }
        };

        getWorkspaceFoldersStub = stub(stubbedWorkspace, 'getWorkspaceFolders')
            .returns(Promise.resolve([
                { uri: 'file:///folder/one', name: 'one' },
                { uri: 'file:///folder/two', name: 'two' }]));

        workspaceLookup = new WorkspaceLookup(stubbedWorkspace);

        parseOmtFileStub = stub(omtFileParser, 'parseOmtFile')
            .returns(Promise.resolve(originalParseResult));
        globStub = stub(globPromise, 'globPromise')
            .returns(Promise.resolve([
                defaultGlobResult
            ]));
    });

    afterEach(() => {
        parseOmtFileStub.restore();
        globStub.restore();
        getWorkspaceFoldersStub.restore();
    });

    describe('init', () => {
        it('adds all workspace folders', () => {
            workspaceLookup.init().then(() => {
                const folders = workspaceLookup.watchedFolders.map(f => f.uri);
                expect(folders).to.contain('file:///folder/one');
                expect(folders).to.contain('file:///folder/two');
                expect(folders.length).to.eq(2);
            });
        });

        it('starts listening to workspace folder changes', (done) => {
            const functionStub = stub(stubbedWorkspace, 'onDidChangeWorkspaceFolders');
            workspaceLookup.init().then(() => {
                expect(functionStub).to.be.calledOnce;
                done();
            });
        });

        it('starts listening to changed files', (done) => {
            const changedWatchedFilesStub = stub(stubbedWorkspace.connection, 'onDidChangeWatchedFiles');
            workspaceLookup.init().then(() => {
                expect(changedWatchedFilesStub).to.be.calledOnce;
                done();
            });
        });

        it('should reject when there is a duplicate in the workspace folders', (done) => {
            const folders = [
                { uri: 'file:///folder/one', name: 'one' },
                { uri: 'file:///folder/one', name: 'one' }];
            getWorkspaceFoldersStub.returns(Promise.resolve(folders));
            const errorStub = stub(console, 'error');
            workspaceLookup.init().then(() => {
                expect.fail();
            }, reason => {
                expect(reason).to.contain(folders[1].uri);
                expect(errorStub).to.been.calledOnce;
                expect(errorStub.firstCall.args[0]).to.contain(folders[1].uri);
                done();
            }).finally(() => {
                errorStub.restore();
            });
        });

        it('should resolve when there are no folders on init', (done) => {
            getWorkspaceFoldersStub.returns(Promise.resolve(undefined));
            workspaceLookup.init().then(() => {
                expect(workspaceLookup.watchedFolders.length).to.eq(0);
                done();
            });
        });
    });

    describe('workspace.onDidChangeWatchedFiles handler', () => {
        let changedWatchedFilesStub: SinonStub;

        beforeEach((done) => {
            changedWatchedFilesStub = stub(stubbedWorkspace.connection, 'onDidChangeWatchedFiles');
            // initialize and attach the stub listener
            workspaceLookup.init()
                .then(() => {
                    expect(changedWatchedFilesStub).to.be.calledOnce;
                    // validate the starting state
                    expect(workspaceLookup.watchedModules).to.lengthOf(1);
                    expect(workspaceLookup.watchedModules[0].name).to.eq(originalParseResult.module?.name);
                    expect(workspaceLookup.watchedModules[0].uri).to.eq(originalParseResult.path);
                    done();
                }, reason => { expect.fail(reason); })
                .catch((reason) => expect.fail(reason));
        });

        afterEach(() => {
            changedWatchedFilesStub.restore();
        });

        it('parses changed files from the filesystem', (done) => {
            const uri = 'file://' + resolve('./myOmtFile.omt');
            const parseOmtFileResult = Promise.resolve({
                ...originalParseResult,
                module: { name: 'module1' }
            });
            parseOmtFileStub.returns(parseOmtFileResult);
            parseOmtFileStub.resetHistory();
            // ACT - use the callback parameter
            changedWatchedFilesStub.callArgWith(0, {
                changes: [
                    { uri, type: FileChangeType.Changed }
                ]
            });

            delay(10).then(() => {
                // the handling of the parseOmtResult is done asynchronously for multiple files
                // because this then is added after the one in the code under test
                // we can use it as trigger for when we assert the results
                expect(parseOmtFileStub).to.be.calledWith(resolve('./myOmtFile.omt'));
                expect(workspaceLookup.watchedModules).to.lengthOf(1);
                expect(workspaceLookup.watchedModules[0].name).to.eq('module1');
                expect(workspaceLookup.watchedModules[0].uri).to.eq(originalParseResult.path);
                done();
            });
        });

        it('deletes watched files from the watcher when change type was Deleted', (done) => {
            const path = `${defaultFolder}/file1.omt`;
            const extraModule = Promise.resolve({
                path,
                module: { name: 'module1' }
            });

            parseOmtFileStub.returns(extraModule);
            // ACT - use the callback parameter
            changedWatchedFilesStub.callArgWith(0, {
                changes: [
                    { uri: `file://${path}`, type: FileChangeType.Changed }
                ]
            });

            extraModule.then(() => {
                // the handling of the parseOmtResult is done asynchronously for multiple files
                // because this then is added after the one in the code under test
                expect(workspaceLookup.watchedModules).lengthOf(2);
                changedWatchedFilesStub.callArgWith(0, {
                    changes: [
                        // this file is not added as a module but should not throw an error
                        { uri: `file://${defaultFolder}/unknown.omt`, type: FileChangeType.Deleted },
                        { uri: `file://${path}`, type: FileChangeType.Deleted },
                    ]
                });
                // we need to wait for the result
                // the call to the workspaceModules is done within a promise but is synchronous
                // and the callArgWith does not expose the returned promise
                delay(10).then(() => {
                    expect(workspaceLookup.watchedModules).to.lengthOf(1);
                    done();
                });
            });
        });

        it('creates watched files when change type was Created and it contained a module', (done) => {
            const uri = 'file://' + resolve('./myOmtFile.omt');

            const parseOmtFileResult = Promise.resolve({
                ...originalParseResult,
                module: { name: 'createdModule' }
            });
            parseOmtFileStub.returns(parseOmtFileResult);
            // ACT - use the callback parameter
            changedWatchedFilesStub.callArgWith(0, {
                changes: [
                    { uri, type: FileChangeType.Created }
                ]
            });

            parseOmtFileResult.then(() => {
                // the handling of the parseOmtResult is done asynchronously for multiple files
                // because this then is added after the one in the code under test
                // we can use it as trigger for when we assert the results
                expect(parseOmtFileStub).to.be.calledWith(resolve('./myOmtFile.omt'));
                expect(workspaceLookup.watchedModules).to.lengthOf(1);
                expect(workspaceLookup.watchedModules[0].name).to.eq('createdModule');
                expect(workspaceLookup.watchedModules[0].uri).to.eq(originalParseResult.path);
                done();
            });
        });
    });

    describe('workspace.onDidChangeWorkspaceFolders handler', () => {
        let workspaceFolderChangeStub: SinonStub;

        beforeEach((done) => {
            workspaceFolderChangeStub = stub(stubbedWorkspace, 'onDidChangeWorkspaceFolders');
            workspaceLookup.init().then(() => done());
        });

        afterEach(() => {
            workspaceFolderChangeStub.restore();
        });

        it('should use addFolder for each added WorkspaceFolder', (done) => {
            const addFolderPromise = Promise.resolve();
            const addFolderStub = stub(workspaceLookup, 'addFolder')
                .returns(addFolderPromise);
            const added = [
                { uri: '/root/folderOne', name: 'folderOne' },
                { uri: '/root/folderTwo', name: 'folderTwo' }];
            workspaceFolderChangeStub.callArgWith(0, {
                added,
                removed: [],
            } as WorkspaceFoldersChangeEvent);
            addFolderPromise.then(() => {
                expect(addFolderStub).to.be.calledTwice;
                expect(addFolderStub.firstCall.args[0]).to.deep.eq(added[0]);
                expect(addFolderStub.secondCall.args[0]).to.deep.eq(added[1]);
                done();
            });
        });

        it('should use removeFolder for each removed WorkspaceFolder', () => {
            const removeFolderStub = stub(workspaceLookup, 'removeFolder')
            const removed = [
                { uri: '/root/folderOne', name: 'folderOne' },
                { uri: '/root/folderTwo', name: 'folderTwo' }];
            workspaceFolderChangeStub.callArgWith(0, {
                added: [],
                removed,
            } as WorkspaceFoldersChangeEvent);
            expect(removeFolderStub).to.be.calledTwice;
            expect(removeFolderStub.firstCall.args[0]).to.deep.eq(removed[0]);
            expect(removeFolderStub.secondCall.args[0]).to.deep.eq(removed[1]);
        });
    });

    describe('fileChanged', () => {
        it('parses the new text from the change', () => {
            const newModule = 'newModuleName';
            expect(workspaceLookup.watchedModules.length).to.eq(0);

            workspaceLookup.fileChanged({
                document: <TextDocument><unknown>{
                    uri: `file://${defaultGlobResult}`,
                    getText: () => `moduleName: ${newModule}`,
                }
            });

            expect(workspaceLookup.watchedModules.length).to.eq(1);
            expect(workspaceLookup.watchedModules[0].name).to.eq(newModule)
        });

        it('parses the new text and removes it when it is no longer a module', () => {
            workspaceLookup.fileChanged({
                document: <TextDocument><unknown>{
                    uri: `file://${defaultGlobResult}`,
                    getText: () => `moduleName: newModuleName`,
                }
            });

            expect(workspaceLookup.watchedModules.length).to.eq(1);

            workspaceLookup.fileChanged({
                document: <TextDocument><unknown>{
                    uri: `file://${defaultGlobResult}`,
                    getText: () => `oduleName: newModuleName`,
                }
            });

            expect(workspaceLookup.watchedModules.length).to.eq(0);
        });
    });

    describe('addFolder handler', () => {
        beforeEach((done) => {
            workspaceLookup.init().then(() => {
                done();
            })
        });

        it('rejects when a folder is added for a second time', (done) => {
            const uri = `file://${defaultFolder}`;
            workspaceLookup.addFolder({
                uri,
                name: 'one'
            }).then(
                () => expect.fail(),
                (reason) => {
                    expect(reason).to.contain(uri);
                    done();
                });
        });

        it('scans the added folder', (done) => {
            globStub.resetHistory();
            parseOmtFileStub.reset();
            parseOmtFileStub.returns(Promise.resolve({
                path: `${defaultFolder}/newFile.omt`,
                module: { name: 'moduleNameTest3' }
            }));
            expect(workspaceLookup.watchedModules.length).eq(1);

            const newFolder = '/newFolder'
            workspaceLookup.addFolder({
                uri: `file://${newFolder}`,
                name: 'one'
            }).then(() => {
                expect(globStub).to.be.calledWith(`${newFolder}/**/*.omt`);
                expect(workspaceLookup.watchedModules.length).eq(2);
                expect(workspaceLookup.watchedModules[1].name).eq('moduleNameTest3');
                done();
            });
        });
    });

    describe('removeFolder handler', () => {
        beforeEach((done) => {
            // setup the workspace to have at least one workspace with one module
            workspaceLookup.init().then(() => {
                expect(workspaceLookup.watchedFolders.length).to.eq(2, 'watchedFolders');
                expect(workspaceLookup.watchedModules.length).to.eq(1, 'watchedModules');
                done()
            });
        });

        it('throws an error when the folder is not in the lookup', () => {
            expect(() => {
                workspaceLookup.removeFolder({
                    uri: 'other uri',
                    name: 'folderName'
                });
            }).to.throw();
        });

        it('expect modules in the workspace to be removed', () => {
            expect(workspaceLookup.watchedModules.length).to.eq(1);
            workspaceLookup.removeFolder({
                uri: `file://${defaultFolder}`,
                name: 'folderName'
            });
            expect(workspaceLookup.watchedModules.length).to.eq(0);
        });
    });

    describe('scanAll', () => {
        beforeEach((done) => {
            workspaceLookup.init().then(() => {
                expect(globStub).to.be.calledTwice;
                done();
            });
        });

        it('scans all watched folders', (done) => {
            globStub.resetHistory();
            workspaceLookup.scanAll()
                .then(() => {
                    expect(globStub).to.be.calledTwice;
                    done();
                }).catch(reason => {
                    expect.fail(reason);
                });
        });
    });

    describe('getModulePath', () => {
        beforeEach((done) => {
            workspaceLookup.init().then(() => { done() });
        });

        it('returns the returnvalue of the workspaceModules', () => {
            const path = workspaceLookup.getModulePath(originalParseResult.module?.name!);
            expect(path).to.eq(defaultGlobResult);
        });
    });
});

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
