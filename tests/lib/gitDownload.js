const Git = require("nodegit");

module.exports = class GitDownload {
    static getFilesForTest(opt) {
        return Git.Clone(opt.url, opt.dest)
    }
};
