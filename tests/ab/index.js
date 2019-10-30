const ab = require('./ab');
const generate_ab = require('./generate_ab_file');
const Server = require('../server');
const upload_options = {key: 'da-password'};
const server = new Server(null, upload_options);
server.listen();


ab.test(1,1, file, server.address().port);

setTimeout(() => {
    after();
},3000);


function after(){
    server.close(() => {
        console.log('server closed');
    })
}
