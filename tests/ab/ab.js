const is_script = !module.parent;
const {spawn} = require('child_process');

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
            ab.stdout.on('data', data => {
                console.log(`stdout: ${data}`);
            });

            ab.stderr.on('data', data => {
                console.log(`stderr: ${data}`);
            });

            ab
                .on('error', e => reject(e))
                .on('close', code => resolve(code));
        });
    }
}

if(is_script){
    let concurrent = 10;
    let requests = 100;
    let file = 'tests/ab/ab_files/file.txt';
    if (process.argv.includes('-n'))
        requests = process.argv[process.argv.indexOf('-n') + 1];
    if (process.argv.includes('-c'))
        concurrent = process.argv[process.argv.indexOf('-c') + 1];
    if (process.argv.includes('-f'))
        file = process.argv[process.argv.indexOf('-f') + 1];

    AB.test(requests, concurrent, file, 3000)
        .then(code => {
            console.log('CODE', code);
        })
        .catch(e => {
            if(e.code === 'ENOENT')
                console.error('ERROR: NO AB found in your PATH, please install it before running this tests');
            else
                console.error(e.message);
        });

} else {
    module.exports = AB;
}
