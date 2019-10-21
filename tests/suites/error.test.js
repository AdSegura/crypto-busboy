const {it} = require("mocha");
const {expect} = require("chai");
const Helper = require('../lib/helper');

module.exports = function suite(CryptoBusBoy) {
    it('Should get an error when instance class with options.dest not writable', done => {
        const dest = Helper.makeUnWritableFolder();
        try {
            new CryptoBusBoy({dest})
        }catch (e) {
            //if we leave dest folder without perms fs.rmdir at helper after clean will throw
            //Error: EACCES: permission denied, scandir
            Helper.makeUnWritableFolderWriteable(dest);
            done()
        }
    })
};
