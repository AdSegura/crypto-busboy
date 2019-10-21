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
        expect(req.status).eq(500);
        expect(req.text).include('Missing Content-Type');
    })
};
