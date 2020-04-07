const cluster = require('cluster');
const http = require('http');

if (cluster.isMaster) {
    // Start workers and listen for messages containing notifyRequest
    //const numCPUs = require('os').cpus().length;
    for (let i = 0; i < 4; i++) {
        cluster.fork({port: 8001+i});
    }

} else {
    require('./server_instance');
}
