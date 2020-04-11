const APP_MODES = {
  DEBUG: "DEBUG",
  PRODUCTION: "PRODUCTION"
};
const CURRENT_APP_MODE = APP_MODES.DEBUG;
const appConstants = {
    TOKEN_SECRET: 'ABDDEFGHMJKL#!@#$!@#!@#$GHGHGFFFH88**99((88&&))PPLLKKkkLL77&&88*',
    BCKND_VERSION_CODE: 1,
    MAX_PLAYERS_PER_ROOM: 3,
    REDIS_CLIENT_IP_DEBUG: "192.168.18.21",
    REDIS_CLIENT_IP_PROD: "127.0.0.1",
};

const helperFunctions = {
    getRedisIP: function(){
        if(CURRENT_APP_MODE === APP_MODES.DEBUG)
            return appConstants.REDIS_CLIENT_IP_DEBUG;
        return appConstants.REDIS_CLIENT_IP_PROD;
    }
};

const HTTPStatusCodes = {
    BAD_REQUEST: 400,
    OK : 200,
    UNAUTHORIZED: 401,
    INTERNAL_SV_ERROR: 500,
    FORBIDDEN: 403
};

module.exports = {
    ...appConstants,
    ...helperFunctions,
    HTTPStatusCodes
};
