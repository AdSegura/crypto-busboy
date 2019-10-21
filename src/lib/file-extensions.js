const mime = require('mime');

module.exports = class FileExtensions {
    /**
     * get normalized extensions ['jpg'] -> ['jpeg']
     *
     * @param {*} extensions
     */
    static normalizeExtensions(extensions){
        if(!extensions) return [];

        if (!Array.isArray(extensions))
            return mime.getExtension(mime.getType(extensions));

        return extensions
            .map(ext => mime.getType(ext))
            .map(ext => mime.getExtension(ext))
    };
};
