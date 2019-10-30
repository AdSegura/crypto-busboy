const is_script = !module.parent;
const {Base64Encode} = require("base64-stream");
const mime = require('mime');
const path = require('path');
const fs = require('fs');

/**
 * Generate ab file format to test uploads
 */
class GenerateABFile {

    /**
     * default ab_files folder dest
     *
     * @return {string}
     */
    static ab_path() {
        return path.join(__dirname, './ab_files');
    }

    /**
     * Transform file into ab file format
     *
     * @param file
     * @param dest
     * @return {Promise<unknown>}
     */
    static generate(file, dest) {
        return new Promise((resolve, reject) => {
            const file_name = path.basename(file) + '.txt';
            dest = dest || path.join(GenerateABFile.ab_path(), '/', file_name);
            const readable = fs.createReadStream(file);
            const writeable = fs.createWriteStream(dest);
            const base64Encoder = new Base64Encode;

            writeable.write(GenerateABFile.ab_header_file(file), () => {
                readable
                    .pipe(base64Encoder)
                    .pipe(writeable)
                    .once('error', (e) => reject(e))
                    .once('finish', () => resolve(dest))
            });

            base64Encoder
                .once('end', () => writeable.write('\r\n--1234567890--'));

            readable
                .once('error', e => reject(e))
        })
    }

    /**
     * add header
     *
     * @param file
     * @return {string}
     */
    static ab_header_file(file) {
        return `--1234567890\r\nContent-Disposition: form-data; name="file"; filename="${path.basename(file)}"\r\nContent-Type: ${mime.getType(file)}\r\nContent-Transfer-Encoding: base64\r\n\r\n`
    }
}

if(is_script){
    let dest, file;

    if (process.argv.includes('-f'))
        file = process.argv[ process.argv.indexOf('-f') + 1];

    if (process.argv.includes('-d'))
        dest = process.argv[process.argv.indexOf('-d') + 1];

    GenerateABFile
        .generate(file, dest)
        .then(dest =>
            console.log('\x1b[33m%s\x1b[0m',`(\u279C) ${path.basename(file)} file transformed to: \x1b[90m${dest}\x1b[0m`)
        );

} else {
    module.exports = GenerateABFile;
}
