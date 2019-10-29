const {Base64Encode} = require("base64-stream");
const path = require('path');
const fs = require('fs');
const ExpressServer = require('../server/express-server');
const gitDownload = require('./gitDownload');
const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);
const md5 = require('md5-file');
const uuid = require('uuid/v1');
const mime = require('mime');
const os = require('os');
const MakeBigFile = require('./makeBigFile');
const TMP_FILES_FOLDER = path.join(os.tmpdir(), '/', 'cryptobus-' + uuid());
let dirty_files;

module.exports = class Helper {

    static get GIT_URL() {
        return 'https://github.com/adsegura/files-cryptobusboy-test.git';
    }

    static get BIG_SIZE() {
        return '3gb';
    }

    static get FILES_TEST_TMP_PATH() {
        return TMP_FILES_FOLDER;
    }

    /**
     * checkTestRequirements
     *
     * @return {Promise<void>}
     */
    static async before() {
        await Helper.verifyFilesForTestAreDownloadedOrGitThem();
        return Promise.resolve();
    }

    /**
     * after test actions
     *
     */
    static after() {
        Helper.removeBigFile();
        Helper.cleanFolder();
    }

    /**
     * verify Files For Tests are in uploads folder,
     *  if not Download from Git Repo and move files to uploads folder
     *
     * @return {Promise<*|Promise<any>|Promise<void>>}
     */
    static async verifyFilesForTestAreDownloadedOrGitThem() {
        if (Helper.checkDownloadedFilesToTest())
            return Promise.resolve();

        const interval = setInterval(() => {
            console.log('\x1b[90m%s\x1b[0m', ' (\u279C) downloading...\n');
        }, 1500);

        //git clone files
        await Helper.git_download_files();
        clearInterval(interval);
        return Helper.moveDownloadedFilesToTestFolder();
    }

    /**
     * MakeBigFile if not exists
     *
     * @param size
     * @return {Promise<any>}
     */
    static seeIfIHaveToMakeBigFile(size) {
        return new Promise((resolve, reject) => {
            size = size || Helper.BIG_SIZE;

            if (!Helper.checkFileExist(Helper.files().bigFile)) {
                console.log('\x1b[36m%s\x1b[0m', ` (\u279C) Please Wait while generating ${size} file for test...\n`);
                Helper.factoryMakeBigFile(size)
                    .create((err) => {
                        if (err) return reject(err);
                        console.log('\n');
                        resolve()
                    })
            } else {
                resolve()
            }
        })
    }

    /**
     * factoryMakeBigFile
     *
     * @param size
     * @return {MakeBigFile}
     */
    static factoryMakeBigFile(size) {
        return new MakeBigFile({
            dest: Helper.files().bigFile,
            size,
            script_mode: true
        });
    }

    /**
     * Clone Git files repo
     *
     * @return {Promise}
     */
    static git_download_files() {
        console.log('\x1b[36m%s\x1b[0m', ' (\u279C) Please wait while we download necessary files...\n');
        return gitDownload.getFilesForTest({url: Helper.GIT_URL, dest: Helper.FILES_TEST_TMP_PATH})
    }

    /**
     * check Downloaded Files To Test exists at uploads folder
     * except bigFile
     * @return {boolean}
     */
    static checkDownloadedFilesToTest() {
        const files = Helper.files();

        return Object.keys(files).every(key => {
            if(key === 'bigFile') return true;
            return Helper.checkFileExist(files[key])
        })
    }

    /**
     * move downloaded git repo Files To uploads test folder
     *
     * @return {Promise<any>}
     */
    static moveDownloadedFilesToTestFolder() {
        return new Promise((resolve, reject) => {
            console.log('\x1b[36m%s\x1b[0m', ' (\u279C) Please wait while we copy necessary files...\n');
            Helper.readDir(Helper.FILES_TEST_TMP_PATH + '/files', (err, files) => {
                if (err) return reject(err);

                files.forEach(file => {
                    fs.copyFileSync(file, Helper.uploads_path() + '/' + path.basename(file))
                });
                resolve();
            });
        })
    }

    /**
     * Read directory
     *
     * return all files and folders at first level
     *
     * @param folder
     * @param cb
     */
    static readDir(folder, cb) {
        const files = [];
        fs.readdir(folder, (e, l) => {
            if (e) return cb(e);

            l.forEach((file) => {
                files.push(path.join(folder, file));
            });
            cb(null, files)
        })
    }

    /**
     * Make a folder with perms to not allow write in
     *
     * @return {string}
     */
    static makeUnWritableFolder() {
        const dest = Helper.getUploadServerFolder() + '/' + uuid();
        fs.mkdirSync(dest, '0000'); //make folder unwritable
        return dest;
    }

    /**
     * Make a folder with perms to not allow write in
     */
    static makeUnWritableFolderWriteable(folder) {
        try{
            fs.chmodSync(folder, '0755');
        } catch (e) {
            throw e;
        }
    }

    /**
     * Clean test files
     *
     */
    static cleanFolder() {
        const folder = Helper.getUploadServerFolder();
        function deleteFolder(folder){
            if(fs.lstatSync(folder).isFile()){
                if (path.basename(folder) !== '.gitignore')
                    fs.unlinkSync(folder)
            } else {
                fs.readdirSync(folder)
                    .forEach(file => {
                        if (fs.lstatSync(path.join(folder, file)).isDirectory()) {
                            return deleteFolder(path.join(folder, file));
                        } else {
                            fs.unlinkSync(path.join(folder, file))
                        }
                    });
                fs.rmdirSync(folder);
            }
        }
        fs.readdirSync(folder).forEach(f => deleteFolder(path.join(folder,f)))
    }

    /**
     * Remove Big file after tests
     */
    static removeBigFile() {
        try {
            fs.unlinkSync(Helper.files().bigFile)
        }catch (e) {}
    }


    /**
     * Url for tests
     * @return {{upload: string, getFile: string}}
     */
    static urls() {
        return {
            upload: '/busboy',
            getFile: '/file',
            upload_custom: '/busboy_opt'
        }
    }

    /**
     * return where express will hold uploads
     *
     * @return {string}
     */
    static getUploadServerFolder() {
        return path.resolve(__dirname + '/../files/');
    }

    /**
     * return a new chai agent
     *
     * @param busopt
     * @param mock boolean
     * @return {ChaiHttp.Agent}
     */
    static factoryAgent(busopt, mock) {
        const server = new ExpressServer(null, busopt, mock);
        return chai.request.agent(server);
    }

    /**
     * Calc md5
     *
     * @param file
     */
    static md5File(file) {
        if (!Helper.checkFileExist(file))
            throw new Error('Helper Md5 cannot access file');

        return md5.sync(file);
    }

    /**
     * Check if big file exists
     *
     * @param file
     * @return {boolean}
     */
    static checkFileExist(file) {
        try {
            return fs.existsSync(file)
        } catch (e) {
            return false;
        }
    }


    /**
     * folder where client (agent) will pickup files
     *  to upload
     *
     * @return {string}
     */
    static uploads_path() {
        return path.join(__dirname, '../uploads');
    }

    /**
     * ab files folder
     *
     * @return {string}
     */
    static ab_path() {
        return path.join(__dirname, '../ab_files');
    }

    static express(busopt, cb) {
        return new ExpressServer(null, busopt);
    }

    /**
     * full path files tests
     *
     * @return {{files}}
     */
    static getFilesToUpload() {
        const uploads_path = Helper.uploads_path();
        return {
            f1: path.join(uploads_path, "/f1.jpeg"),
            f2: path.join(uploads_path, "/f2.jpeg"),
            f3: path.join(uploads_path, "/f3.jpeg"),
            f4: path.join(uploads_path, "/f4.jpeg"),
            f5: path.join(uploads_path, "/f5.jpeg"),
            f1doc: path.join(uploads_path, "/original.doc"),
            f1excel: path.join(uploads_path, "/f1.xlsx"),
            f1access: path.join(uploads_path, "/f1.mdb"),
            f1ppt: path.join(uploads_path, "/f1.pptx"),
            f1zip: path.join(uploads_path, '/f1.zip'),
            f1docx: path.join(uploads_path, "/f1.docx"),
            f2docxZip: path.join(uploads_path, "/f2.docx"),
            bigFile: path.join(uploads_path, '/big.file'),
            ftxt: path.join(uploads_path, '/ftxt.txt'),
        };
    }

    /**
     * proxy to get Files to upload
     * @return {{files}}
     */
    static files() {
        if(dirty_files) return dirty_files;
        dirty_files = Helper.getFilesToUpload();
        return dirty_files;
    }

    /**
     * get filename from files to upload
     *
     * @param file
     * @return {string}
     */
    static getFileName(file){
       return path.basename(Helper.files()[file])
    }

    /**
     * factory crypto-busboy options for test allowed extensions
     *
     * @param allowed
     * @param mode
     * @return {{dest: *, limits: {allowed: *}}}
     */
    static factoryUpOptions_allowed(allowed, mode) {
        const opt =  {
            dest: Helper.getUploadServerFolder(),
            limits: {
                allowed
            }
        };

        if (mode === 'crypto')
            opt.key = 'super-password';

        return opt;
    }

    static generate_ab_file(file){
        const file_name = path.basename(file).split('.')[0] + '.txt';
        const writeable = fs.createWriteStream(path.join(Helper.ab_path(), '/', file_name));
        const readable = fs.createReadStream(file);
        writeable.write(Helper.ab_header_file(file), () => {
            readable
                .pipe(new Base64Encode)
                .pipe(writeable);
        });

        readable.once('end', () => {
            writeable.write('\r\n--1234567890--')
        })
    }

    static ab_header_file(file){
        return `--1234567890\r\nContent-Disposition: form-data; name="file"; filename="${path.basename(file)}"\r\nContent-Type: ${mime.getType(file)}\r\nContent-Transfer-Encoding: base64\r\n\r\n`
    }
};
