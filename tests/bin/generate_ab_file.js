const {Base64Encode} = require("base64-stream");
const mime = require('mime');
const path = require('path');
const fs = require('fs');


class GenerateABFile {
    static generate(file, dest){
        const file_name = path.basename(file) + '.txt';
        const readable = fs.createReadStream(file);
        let writeable;

        if(dest)
            writeable = fs.createWriteStream(dest);
        else
            writeable = fs.createWriteStream(path.join(GenerateABFile.ab_path(), '/', file_name));

        writeable.write(GenerateABFile.ab_header_file(file), () => {
            readable
                .pipe(new Base64Encode)
                .pipe(writeable);
        });

        readable.once('end', () => {
            writeable.write('\r\n--1234567890--')
        })
    }

    /**
     * ab files folder
     *
     * @return {string}
     */
    static ab_path() {
        return path.join(__dirname, '../ab_files');
    }

    static ab_header_file(file){
        return `--1234567890\r\nContent-Disposition: form-data; name="file"; filename="${path.basename(file)}"\r\nContent-Type: ${mime.getType(file)}\r\nContent-Transfer-Encoding: base64\r\n\r\n`
    }
}

if (process.argv.includes('-f')) {
    const filePos = process.argv.indexOf('-f') + 1;
    const file = process.argv[filePos];
    let dest;

    if (process.argv.includes('-d')){
        const destPos = process.argv.indexOf('-f') + 1;
        dest = process.argv[destPos];
    }

    GenerateABFile.generate(file, dest);

    } else {
        module.exports = GenerateABFile;
}
