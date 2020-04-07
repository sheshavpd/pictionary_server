const auth = require('express').Router();
const googleSignIn = require('./googleSignIn');

auth.post('/google', googleSignIn);

module.exports = auth;
