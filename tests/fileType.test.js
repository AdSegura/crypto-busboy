const stream = require('stream');
const fs = require('fs');
const crypto = require('crypto');
const fileType = require('file-type');

const read = fs.createReadStream(__dirname + '/uploads/f1.zip');
const write = fs.createWriteStream('/tmp/kk.zip');


(async () => {
    const fileTypeStream = await fileType.stream(read);

    console.log(fileTypeStream);
    //console.log(fileTypeStream.fileType);
    //=> {ext: 'mov', mime: 'video/quicktime'}

    fileTypeStream.pipe(write);
})();
