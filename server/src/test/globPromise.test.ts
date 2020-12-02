import { SinonStub, stub } from "sinon";
import * as globPackage from 'glob';
import { expect } from 'chai';
import { globPromise } from "../globPromise";


describe('globPromise', () => {
    let globStub: SinonStub;

    beforeEach(() => {
        globStub = stub(globPackage, 'glob');
    });

    afterEach(() => {
        globStub.restore();
    });

    it('should call glob with pattern', (done) => {
        globPromise('pattern').then(() => {
            expect(globStub).to.have.been.calledOnceWith('pattern');
            done();
        });
        // act - call the callback
        globStub.callArgWith(1, null, []);
    });

    it('should reject when glob callsback with an error', (done) => {
        const reason = 'reason for failure';
        globPromise('pattern').then(
            () => expect.fail('should reject'),
            reason => {
                expect(reason).to.eq(reason);
                done();
            });
        // act - call the callback
        globStub.callArgWith(1, reason, []);
    });

    it('should resolve with any matches the glob returns', (done) => {
        const matchResult = ['matching text', 'more matches'];
        globPromise('pattern').then(matches => {
            expect(matches).to.deep.eq(matchResult);
            done();
        });
        // act - call the callback
        globStub.callArgWith(1, null, matchResult);
    });
})
