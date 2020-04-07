const randToken = require("rand-token");

const appConstants = {
    TOKEN_SECRET: 'ABDDEFGHHJKL#!@#$!@#!@#$GHGHGFFFH88**99((88&&))PPLLKKkkLL77&&88*',
    BCKND_VERSION_CODE: 1
};

const HTTPStatusCodes = {
    BAD_REQUEST: 400,
    OK : 200,
    UNAUTHORIZED: 401,
    INTERNAL_SV_ERROR: 500
};

module.exports = {
    ...appConstants,
    HTTPStatusCodes
};
