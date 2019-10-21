//Prerequisite: cli-progress ^3.0.0
const fs = require('fs');
const _cliProgress = require('cli-progress');
let script_mode = false;

/**
 * Make a big file, or small...
 *
 * Cli:
 * > node makeBigFile.js --dest '/tmp/foo.txt' --size 1gb
 * > node makeBigFile.js --dest '/tmp/foo.txt' --size 1mb
 *
 * Module:
 * const MakeBigFile = require('./makeBigFile');

 * const makeBigFile = new MakeBigFile({dest, size});
 * makeBigfile.create(() => { console.log('finish'); })
 *
 */
class MakeBigFile {
    constructor(opt = {}) {
        if (!opt.dest) throw new Error('makeBigFile options dest not defined');
        if (!opt.size) throw new Error('makeBigFile options file size not defined');

        //parse --size 5mb
        opt.size = MakeBigFile.parseSizeOption(opt.size);

        this.options = Object.assign({}, opt);

        // to show _cliProgress or not
        this.options.script_mode = this.options.script_mode || script_mode;

        //cli bar progress
        if(this.options.script_mode)
            this.bar = MakeBigFile.createBar();

        //calculate initial buffer size
        this.calculateBufferSize();

        //writeStream
        this.writer = this.writeStream();

    }

    /**
     * Public Create new File
     *
     * @param cb? [optional]
     */
    create(cb){
        if(this.options.script_mode) {
            //console.log('Making file size:', this.options.size / (1024 * 1024) + 'MB');
            this.bar.start(this.options.size, 0);
        }

        this.startWriter();

        if(typeof cb === 'function') {
            this.writer.once('finish', cb);
            this.writer.once('error', (e) => {
                cb(e)
            });
        }

    }

    /**
     * Start to write a file
     *
     * @return {*}
     */
    startWriter(){
        if (this.options.size < 1) return this.pleaseEndFile();

        this.pleaseWrite(() => {
            this.calculateHowMuchLeft();

            if(this.options.script_mode)
                this.bar.increment(this.options.buffer_size);

            this.startWriter();
        })
    }

    /**
     * Write to stream
     *  with writeStream backpressure control
     *
     *  return cb when we can write again.
     *
     *  if this.write returns false, that means writeStream is telling us
     *
     *  'I cannot handle that rate of incoming data to write to,
     *      so you should wait until I emit a [drain] event, if you still sending data while I have said to you
     *      [please wait until drain event to give me more data to write],
     *      I will start to put this data out of the stream in your RAM and this is not a good thing :)'
     *
     *  https://nodejs.org/en/docs/guides/backpressuring-in-streams/
     *
     * @return {function}
     */
    pleaseWrite(cb) {
        if (!this.write()) { //Backpressure in writeStream
            this.writer.once('drain', cb)
        } else {
            process.nextTick(cb);
        }
    }

    /**
     * Close File and stop bar
     */
    pleaseEndFile() {
        if(this.options.script_mode)
            this.bar.stop();

        return this.writer.end()
    }

    /**
     * decrement options.size by buffer options.buffer_size written
     */
    calculateHowMuchLeft() {
        this.options.size -= this.options.buffer_size;
    }

    /**
     * Stream Write
     *
     * if true we can keep on,
     * if false we have to wait for drain event.
     *
     * @return {boolean}
     */
    write() {
        return this.writer.write(this.generateData())
    }

    /**
     * Create WriteStream
     * @return {WriteStream}
     */
    writeStream() {
        return fs.createWriteStream(this.options.dest);
    }

    /**
     * create a fixed size buffer full of random text
     *
     * @return {Buffer}
     */
    generateData() {
        if (this.options.size <= this.options.buffer_size)
            return Buffer.alloc(this.options.size, MakeBigFile.getRandomText());

        return Buffer.alloc(this.options.buffer_size, MakeBigFile.getRandomText());
    }

    /**
     * parse size options
     * 1mb 1gb
     * @param size
     * @return {number}
     */
    static parseSizeOption(size) {
        const sizes = {
            mb: 1048576,
            gb: 1073741824
        };
        const types = ['mb', 'gb'];

        let [file_size, type] = size.split(/(\d+)/).slice(1,);
        if (parseInt(file_size) <= 0) throw new Error('Not making 0 nothing');
        if (!types.includes(type)) throw new Error(`unknown ${type}, only allowed mb|gb`);

        return sizes[type] * parseInt(file_size)
    }

    /**
     * Calculate initial buffer size
     */
    calculateBufferSize() {
        this.options.buffer_size = this.options.buffer_size || 52428800; //50 megaBytes

        if (this.options.size <= this.options.buffer_size)
            this.options.buffer_size = this.options.size;
    }

    /**
     * Create bar
     *
     * @return {module.SingleBar|*}
     */
    static createBar() {
        return new _cliProgress.SingleBar({
            format: '\x1b[36m (\u279C) progress [{bar}] {percentage}% | ETA: {eta}s\x1b[0m'
        });
    }

    /**
     * Gen text
     * @return {string}
     */
    static getRandomText() {
        return `Lorem ipsum dolor sit amet, 
    consectetur adipisicing elit, sed do eiusmod tempor
    incididunt ut labore et dolore magna aliqua. Ut enim
    ad minim veniam, quis nostrud exercitation ullamco laboris
    nisi ut aliquip ex ea commodo consequat. Duis aute irure
    dolor in reprehenderit in voluptate velit esse cillum dolore
    eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat
    non proident, no
    ad minim veniam, quis nostrud exercitation ullamco laboris
    nisi ut aliquip ex ea commodo consequat.\n`
    }
}

/** Script mode */
if (process.argv.includes('--dest') || process.argv.includes('--size')) {
    script_mode = true;
    const destPos = process.argv.indexOf('--dest') + 1;
    const sizePos = process.argv.indexOf('--size') + 1;
    const dest = process.argv[destPos];
    const size = process.argv[sizePos];

    const f = new MakeBigFile({dest, size});
    f.create();

} else {
    /** module mode */
    module.exports = MakeBigFile;
}
