const {spawn} = require('child_process');
let file = 'tests/ab/ab_files/file.txt';

class AB {

    static test(requests, concurrent, file, port) {
        const ab = spawn('ab', [
            '-n',
            requests,
            '-c',
            concurrent,
            '-p',
            file,
            '-T',
            'multipart/form-data; boundary=1234567890',
            `http://localhost:${port}/busboy`
        ]);

        return AB.listeners(ab);
    }

    static listeners(ab) {
        return new Promise((resolve, reject) => {
            ab.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
            });

            ab.stderr.on('data', (data) => {
                //console.error(`stderr: ${data}`);
                return reject(data);
            });

            ab.on('close', (code) => {
                //console.log(`child process exited with code ${code}`);
                return resolve(code);
            });
        });
    }
}

if (process.argv.includes('-n')) {
    let concurrent = 10;
    const requests = process.argv[process.argv.indexOf('-n') + 1];
    if (process.argv.includes('-c'))
        concurrent = process.argv[process.argv.indexOf('-c') + 1];
    if (process.argv.includes('-f'))
        file = process.argv[process.argv.indexOf('-f') + 1];

    AB.test(requests, concurrent, file, 3000)
        .then(code => {
            console.log(code);
        })
        .catch(e => console.error(e.toString()));


} else {
    module.exports = AB;
}
