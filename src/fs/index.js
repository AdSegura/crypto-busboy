const mkdirp = require('mkdirp');
const path = require('path');
const fsperms = '0755';

/**
 * Make folder
 *
 * @param folder
 * @param perms
 * @returns {Promise<any>}
 */
const makeFolder = function (folder, perms = fsperms) {
    return new Promise(function (resolve, reject) {
        mkdirp(path.resolve(folder), {mode: perms}, function (err) {
            if (err) {
               return reject(err);
            } else {
               return resolve(folder)
            }
        });
    });
};

module.exports = makeFolder;
