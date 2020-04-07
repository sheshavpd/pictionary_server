const { promisify } = require("util");
const getAsync = client => promisify(client.get.bind(client));
const setAsync = client => promisify(client.set.bind(client));
const hmsetAsync = client => promisify(client.hmset.bind(client));
const hmgetAsync = client => promisify(client.hmget.bind(client));
const hdelAsync = client => promisify(client.hdel.bind(client));

module.exports = {
    getAsync,
    setAsync,
    hmsetAsync,
    hmgetAsync,
    hdelAsync
};
