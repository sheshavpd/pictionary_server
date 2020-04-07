const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const session = require('express-session');
const routes = require("./routes");
/*const redis = require('redis');
const client = redis.createClient(6379, "192.168.242.128");

client.on("message", function (channel, message) {
    const now = Date.now();
    console.log(now-JSON.parse(message).hello);
});
client.subscribe("notification");

var publisher = redis.createClient(6379, "192.168.242.128");
publisher.publish("notification", JSON.stringify({hello:Date.now()}));*/
/*
const redlock = require('./credentials/redis_lock');
const lockName = "lock:001";
const mutex = async function() {
    console.log("Acquiring lock..");
    const lock = await redlock.lock(lockName, 2000);
    console.log("Lock Acquired");
};
*/

const wsWrapper = require('./ws_routes/WSWrapper');
const verifyWSAuth = require('./ws_routes/auth/verifyWSAuth');

const expressWs = require('express-ws')(app, null, {
    wsOptions: {
        verifyClient: verifyWSAuth
    }
});


// Authentication configuration
app.use(session({
    secret: 'pictionary$123123124@987!%#;',
    resave: false,
    saveUninitialized: false,
}));

//for handling application/json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({"extended": false}));

//Instance of websocket on this path
var aWss = expressWs.getWss('/socket');
app.ws('/socket/:token', wsWrapper.addSocket.bind(wsWrapper));

app.use('/', routes);
app.use(function (err, req, res, next) {
    if(err){
        console.log(err);
        res.send({error: true, message: "Internal error occured"});
        return;
    }
    next();
});


process.on('uncaughtException', function (err) {
    //app.close();
    console.log(err);
    aWss.clients.forEach(socket => {
        try {
            socket.terminate()
        } catch (e) {
        }
    });
});
process.on('exit', function (err) {
    //app.close();
    aWss.clients.forEach(socket => {
        try {
            socket.terminate()
        } catch (e) {
        }
    });

});

app.listen(process.env.port, () => console.log('listening on *:'+process.env.port));

