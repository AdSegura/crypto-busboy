const {it} = require("mocha");
const {expect} = require("chai");
const Helper = require('../lib/helper');

module.exports = function suite() {
    it('Should get an error No Content-Type', async () => {
        const agent = Helper.factoryAgent({
            dest: Helper.getUploadServerFolder(),
            limits: {
                fileSize: 2000 * 1024 * 1024,
                files: 1
            }
        });

        const req = await agent.post(Helper.urls().upload);
        expect(req.status).eq(400);
        expect(req.text).include('Missing Content-Type');
    });

    it('Should get an error No multipart/form-data; header found', async () => {
        const agent = Helper.factoryAgent({
            dest: Helper.getUploadServerFolder(),
            limits: {
                fileSize: 2000 * 1024 * 1024,
                files: 1
            }
        });

        const req = await agent.post(Helper.urls().upload)
            .set('content-type', 'application/x-www-form-urlencoded')
            .send(Helper.files().f2);

        expect(req.status).eq(400);
        expect(req.text).include('no multipart/form-data; header found');
    });

   /* it('Should get an unexpected error', async () => {
        const mock_it = true;
        const agent = Helper.factoryAgent({
            dest: Helper.getUploadServerFolder(),
            limits: {
                fileSize: 5000 * 1024 * 1024,
                files: 1
            }
        }, mock_it);

        const req = await agent.post(Helper.urls().upload)
            .attach('my', Helper.files().f1);

        expect(req.status).eq(400);
        expect(req.text).include('Mock Error on busboy');
    })*/
};
