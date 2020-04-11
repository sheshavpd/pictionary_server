const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const session = require('express-session');
const routes = require("./routes");

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

app.listen(8001, () => console.log('listening on *:'+8001));

