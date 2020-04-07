const mongoose    =   require("mongoose");
mongoose.Promise = require('bluebird');
const options = { promiseLibrary: require('bluebird'),  useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true };

mongoose.connect('mongodb://localhost/pictionaryDB', options);

module.exports = mongoose;
