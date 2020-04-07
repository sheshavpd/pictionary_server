const shortid = require('shortid');
/*shortid.characters('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-');*/
shortid.worker(1);
shortid.seed(171);

module.exports = shortid;
