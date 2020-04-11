const uuidv4 = require('uuid').v4;
const {TOKEN_SECRET} = require('../../AppConstants');
const jwt = require('jsonwebtoken');
const verifyWSAuth = function (info, cb) {
    let params = info.req.url.split("/");
    let stringToken = params[params.length - 1];
    if (stringToken) {
        let token = decodeURI(stringToken);
        if (token.length < 1000)
            jwt.verify(token, TOKEN_SECRET, function (err, decoded) {
                if (err) {
                    cb(false, 401, "Error verifying user session");
                    //console.log("Token verification failed");
                    //cb(true);
                } else {
                    decoded.sessionID = uuidv4();
                    info.req.decoded = decoded;
                    cb(true);
                }
            });
        else cb(false, 401, "Unauthorized");
    } else cb(false, 401, "Unauthorized");
};

module.exports = verifyWSAuth;
