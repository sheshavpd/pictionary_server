const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const Helpers = require("../../utils/Helpers");
const {TOKEN_SECRET, BCKND_VERSION_CODE, HTTPStatusCodes} = require('../../AppConstants');
const firebaseAdmin = require('../../credentials/firebase_instance');

const validateParams = async function (req, res) {
    if (!Helpers.validateParamWithLength([req.body.token, req.body.device_info], 2000, true)) {
        res.status(HTTPStatusCodes.BAD_REQUEST).json({error:true, message: "Invalid parameters."});
        return false;
    }

    let decodedToken;
    try {
        decodedToken = await firebaseAdmin.auth().verifyIdToken(req.body.token);
        if(!decodedToken.email_verified)
            throw "Email not verified";
    }catch(e){
        res.status(HTTPStatusCodes.BAD_REQUEST).json({error:true, message: "Invalid sign-in token."});
        return false;
    }

    return decodedToken;
};

const signInUser = async function(decodedToken, req, res) {
    let user = await User.findOne({email: decodedToken.email});
    if(user) {
        user.avatar = decodedToken.picture; //Update the profile picture.
        user.last_login = Math.floor(Date.now() / 1000);
    } else {
        user = new User({
            name: decodedToken.name,
            uid: decodedToken.uid,
            email: decodedToken.email,
            avatar: decodedToken.picture,
        });
        if(req.body.device_info)
            user.device = req.body.device_info;
    }
    try {
        await user.save();
    }catch(e){
        console.log(e);
        res.status(HTTPStatusCodes.INTERNAL_SV_ERROR).json({error:true, message:"Database error while signing-in"});
        return false;
    }
    return user;
};

const googleSignIn = async function(req, res) {
    const decodedToken = await validateParams(req, res);
    if(!decodedToken) return;
    let user = await signInUser(decodedToken, req, res);
    if(!user) return;
    const {name, email, uid, avatar} = user;
    const accessToken = jwt.sign({uid, name, email, avatar, signed_on: new Date(), version: BCKND_VERSION_CODE}, TOKEN_SECRET);
    res.status(HTTPStatusCodes.OK).json({error:false, accessToken});
};
module.exports = googleSignIn;
