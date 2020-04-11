const redis = require('redis');
const { getRedisIP }  = require('../AppConstants');
const client = redis.createClient(6379, getRedisIP());

client.on('error', error=>{
    console.log("client",error);
});
module.exports = client;
