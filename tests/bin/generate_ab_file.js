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
        return path.join(__dirname, '../ab_files');
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

            writeable.write(GenerateABFile.ab_header_file(file), () => {
                readable
                    .pipe(new Base64Encode)
                    .pipe(writeable)
                    .once('error', (e) => reject(e))
                    .once('finish', () => resolve(dest))
            });

            readable
                .once('error', e => reject(e))
                .once('end', () => writeable.write('\r\n--1234567890--'))
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

if (process.argv.includes('-f')) {
    const filePos = process.argv.indexOf('-f') + 1;
    const file = process.argv[filePos];
    let dest;

    if (process.argv.includes('-d')) {
        const destPos = process.argv.indexOf('-d') + 1;
        dest = process.argv[destPos];
    }

    GenerateABFile
        .generate(file, dest)
        .then(dest => console.log('\x1b[33m%s\x1b[0m',`(\u279C) ${path.basename(file)} file transformed to: \x1b[90m${dest}\x1b[0m`))

} else {
    module.exports = GenerateABFile;
}
