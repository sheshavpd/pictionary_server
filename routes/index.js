const routes = require('express').Router();
const game = require('./game');
const auth = require('./auth');
const {TOKEN_SECRET, HTTPStatusCodes}=require('../AppConstants');
const jwt    = require('jsonwebtoken');
const sanitize = require('mongo-sanitize');

routes.use((req, res, next)=>{
  // Websites you wish to allow to connect
  //var allowedOrigins = ['http://127.0.0.1:9080','http://localhost:9080', 'http://192.168.0.31:9080', 'http://192.168.0.31:9080'];
  //var origin = req.headers.origin;
  /*if(allowedOrigins.indexOf(origin) > -1){
    res.setHeader('Access-Control-Allow-Origin', origin);
  }*/
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,token,email,docHash');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // Pass to next layer of middleware
  next();
});
routes.get('/', (req, res) => {
    res.status(200).send("Are you enjoying pictionary? :)")
});


routes.use('/auth', auth);

routes.use(function(req, res, next) {
    if(req.body){
        for (let property in req.body) {
            req.body[property] = sanitize(req.body[property]);
        }
    }
    // check header or url parameters or post parameters for token
    let token='';
    if(req.body.token)
    token = req.body.token;
    else token = req.headers.token;

    // decode token
    if (token) {
        jwt.verify(token, TOKEN_SECRET, function(err, decoded) {
            if (err) {
                return res.status(HTTPStatusCodes.UNAUTHORIZED).json({ error:true, unauthorized:true, message: 'Failed to authenticate user.' });
            } else {
                // if everything is good, save to request for use in other routes
                req.decoded = decoded;
                next();
            }
        });
    } else {
        // if there is no token, return an error.
        return res.status(HTTPStatusCodes.UNAUTHORIZED).json({
            error: true,
            unauthorized:true,
            message: 'No token provided.'
        });
    }
});
routes.use('/game', game);
routes.get('/', (req, res) => {
    res.status(200).json({message: "connected!"});
});

module.exports = routes;
