// grab the things we need
const mongoose = require('./../mongoConfig');
const Schema = mongoose.Schema;

// create a schema
const wordSchema = new Schema({
    word: { type: String, required:true, unique:true},
});

wordSchema.index({word:1});
wordSchema.statics.random = async function(numberOfWords) {
    return (await this.aggregate([{$sample: {size: numberOfWords}}, { $project: {word:1, _id:0}}])).map(o=>o.word);
};

wordSchema.pre('save', function(next){
    this.word = this.word.toUpperCase();
    next();
});


// the schema is useless so far
// we need to create a model using it
const Word = mongoose.model('Word', wordSchema);

// make this available to our users in our Node applications
module.exports = Word;
