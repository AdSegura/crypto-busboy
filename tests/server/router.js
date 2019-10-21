const Helper = require('../lib/helper');

module.exports = class Router {
    constructor(instance){
        this.instance = instance;
        this.app = instance.app;
    }

    routes(){
        this.app.get('/', (req, res, next) => this.root(req, res, next));
        this.app.get('/file/:file', (req, res, next) => this.downloadFile(req, res, next));
        this.app.post('/busboy', (req, res, next) => this.uploadFiles(req, res, next));
        this.app.post('/busboy_opt', (req, res, next) => this.uploadFilesCustomOpt(req, res, next));
    }

    root(req, res, next){
        res.json({id: this.instance.getServerId()})
    }

    uploadFiles(req, res, next){
        this.instance.cryptoBusBoy.upload(req)
            .then(r => {
                if(r.warnings.length > 0)
                    res.statusCode = 429;
                else if (r.files.length > 0 && r.errors.length > 0)
                    res.statusCode = 429;
                else if (r.errors.length > 0)
                    res.statusCode = 400;

                res.json(r)
            })
            .catch(e => next(e))
    }

    downloadFile(req, res, next) {
        const file = req.params.file;
        this.instance.cryptoBusBoy.download(req, res, next, file);
    }

    uploadFilesCustomOpt(req, res, next){
        const force_path = this.instance.busOpt.dest + '/foo/';
        const dest_opt = {dest: force_path};

        this.instance.cryptoBusBoy.upload(req, dest_opt)
            .then(r => res.json(r))
            .catch(e => {
                next(e)
            })
    }
};
