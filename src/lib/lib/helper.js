module.exports = class Helper {
    /**
     * Is a writeStream?
     *
     * @param folder
     * @return {boolean}
     */
    static is_writeStream(folder){
        if(typeof folder === 'object')
            if(typeof folder.createWriteStream === 'function')
                return true;

        return false;
    }
};
