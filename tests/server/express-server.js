const express = require("express");
const bodyParser   = require("body-parser");
const path = require("path");
const http = require('http');
const uuid = require('uuid/v1');
const Router = require('./router');
const Helper = require('../lib/helper');
const debug = require('debug')('cryptoBus:express');

const CryptoBusBoy = require('../../src/');

class ExpressServer {

    constructor(options, busOpt, mock) {
        this.options = Object.assign({}, options);
        this.busOpt = Object.assign({}, busOpt);
        this.app = express();
        this.server_id = ExpressServer.setServerId(this.options.server_id);
        if(mock)
            this.cryptoBusBoy = new CryptoBusBoy(this.busOpt, require('../mock/upload'));
        else
            this.cryptoBusBoy = new CryptoBusBoy(this.busOpt);

        this.router = new Router(this);
    }

    routes() {
       return this.router.routes()
    }

     middleware() {
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: false }));
        this.app.use(express.static(path.join(__dirname, 'public')));
         this.app.use(ExpressServer.logErrors);
         this.app.use(ExpressServer.clientErrorHandler);
         this.app.use(ExpressServer.errorHandler);
    }

    listen() {
         this.routes();
         this.middleware();


        this.server = http.createServer(this.app);
        this.server.listen.apply(this.server, arguments);

        const last = arguments[arguments.length-1];
        if(typeof last === 'function') return;

        return this.server;
    }

    address() {
        if(! this.server) return false;
        return this.server.address();
    }

    close(cb) {
        this.server.close(cb);
    }


    static logErrors(err, req, res, next) {
        debug('logErrors ERROR EXPRESS ', err.message);
        next(err)
    }

    static clientErrorHandler(err, req, res, next) {
        if (req.xhr) {
            res.status(500).send({error: 'Something failed!'})
        } else {
            next(err)
        }
    }

    static errorHandler(err, req, res, next) {
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            return res.status(500).send({error: err.message})
        }

        res.status(500).send({error: 'Something failed!'});
    }

    getServerId() {
        return this.server_id;
    }

    static setServerId(id) {
        if(! id) return uuid();
        return id;
    }
}

/** Script mode */
if (process.argv.includes('--port')) {
    script_mode = true;
    const portPos = process.argv.indexOf('--port') + 1;
    const port = process.argv[portPos];

    const server = new ExpressServer(null,{
        dest: Helper.getUploadServerFolder(),
        limits: {
            //fileSize: 50000 * 1024 * 1024,
            fileSize: 1024 * 1024,
            files: 2
        }

    });
    server.listen(port);

} else {
    /** module mode */
    module.exports = ExpressServer;
}
