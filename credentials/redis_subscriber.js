const redis = require('redis');
const client = redis.createClient(6379, "192.168.18.21");

client.on('error', error=>{
    console.log("subscriber",error);
});
module.exports = client;
