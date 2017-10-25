'use strict';

let cluster = require('cluster');
let control = require('strong-cluster-control');
let logger = require('../common/utils').log4js.getLogger(`[${process.pid}] - Cluster`);

let http = require('http');
let numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
    logger.info(`Number of processes will be run: ${numCPUs}`);
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker, code, signal) => {
        logger.fatal(`Worker ${worker.process.pid} exit with code: ${code}, signal: ${signal}.`);
        cluster.fork();
    });
} else {
    require('./server').start();
}
