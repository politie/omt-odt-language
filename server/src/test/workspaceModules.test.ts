import { expect } from "chai";
import { assert, stub } from "sinon";
import { CheckFileResult, OMTModule } from "../types";
import { WorkspaceModules } from "../workspaceModules";


describe('WorkspaceModule', () => {
    let workspaceModules: WorkspaceModules;
    let defaultCheckFileResult: CheckFileResult;
    beforeEach(() => {
        workspaceModules = new WorkspaceModules();
        defaultCheckFileResult = {
            path: 'folder/defaultPath.omt',
            module: {
                name: 'defaultModule',
            }
        };
    });

    describe('checkForChanges', () => {
        it('should ignore it if the result is not a module', () => {
            workspaceModules.checkForChanges({
                ...defaultCheckFileResult,
                module: undefined
            });
            expect(workspaceModules.modules.size).to.eq(0);
        });

        it('should create a module when the name is new', () => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
            expect(workspaceModules.modules.size).to.eq(1);
            const module = <OMTModule>workspaceModules.modules.values().next().value;
            expect(module.name).to.eq(defaultCheckFileResult.module?.name);
            expect(module.uri).to.eq(defaultCheckFileResult.path);
        });

        it('should replace an existing module with the same name but a different path', () => {
            workspaceModules.checkForChanges({
                ...defaultCheckFileResult,
                path: 'otherPath.omt'
            });
            expect(workspaceModules.modules.size).to.eq(1);
            const module = <OMTModule>workspaceModules.modules.values().next().value;
            expect(module.name).to.eq(defaultCheckFileResult.module?.name);
            expect(module.uri).to.eq('otherPath.omt');
        });

        it('should replace the module when there is one with the same name and uri', () => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
            const setStub = stub(workspaceModules.modules, 'set');
            workspaceModules.checkForChanges(defaultCheckFileResult);
            expect(workspaceModules.modules.size).to.eq(1);
            const module = <OMTModule>workspaceModules.modules.values().next().value;
            expect(module.name).to.eq(defaultCheckFileResult.module?.name);
            expect(module.uri).to.eq(defaultCheckFileResult.path);
            assert.calledOnceWithMatch(setStub, defaultCheckFileResult.module?.name!, {
                name: defaultCheckFileResult.module?.name!,
                uri: defaultCheckFileResult.path
            });
        });
    });

    describe('getModulePath', () => {
        it('should return undefined when there is no module with that name', () => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
            const result = workspaceModules.getModulePath('otherName');
            expect(result).to.undefined
        });

        it('should return the path of the module if it is in the workspace', () => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
            const result = workspaceModules.getModulePath(defaultCheckFileResult.module?.name!);
            expect(result).to.eq(defaultCheckFileResult.path);
        });
    });

    describe('removeFolder', () => {
        beforeEach(() => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
        });

        it('should remove any module in the folder', () => {
            workspaceModules.removeFolder('folder/');
            expect(workspaceModules.modules.size).to.eq(0);
        });

        it('should ignore any module in another folder', () => {
            workspaceModules.removeFolder('otherFolder/');
            expect(workspaceModules.modules.size).to.eq(1);
        });
    });

    describe('removeFile', () => {
        beforeEach(() => {
            workspaceModules.checkForChanges(defaultCheckFileResult);
        });

        it('removes added a module with matching uri', () => {
            expect(workspaceModules.modules.size).to.eq(1);
            workspaceModules.removeFile(defaultCheckFileResult.path);
            expect(workspaceModules.modules.size).to.eq(0);
        });

        it('ignores uri without module', () => {
            expect(workspaceModules.modules.size).to.eq(1);
            workspaceModules.removeFile('./some/other/path.omt');
            expect(workspaceModules.modules.size).to.eq(1);
        });
    });
});
