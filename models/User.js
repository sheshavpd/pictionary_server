// grab the things we need
const mongoose = require('./../mongoConfig');
const Schema = mongoose.Schema;

// create a schema
const userSchema = new Schema({
    uid: { type: String, required:true, unique:true},
    name: { type: String, required: true },
    nick: { type: String },
    email: { type:String, required:true, unique:true },
    avatar: { type:String, required:true },
    device: { type:String },
    points: { type:Number, default: 0 },
    last_login: { type:Number, default:0 },
    currentGames: [{
        type: String
    }], //Current games being played.
    created_at: { type:Number },
    updated_at: { type:Number }
});

userSchema.index({uid:1});
userSchema.index({email:1});

userSchema.pre('save', function(next){
    const now = Math.floor(Date.now() / 1000);
    this.updated_at = now;
    if ( !this.created_at ) {
        this.created_at = now;
    }
    next();
});



// the schema is useless so far
// we need to create a model using it
const User = mongoose.model('User', userSchema);

// make this available to our users in our Node applications
module.exports = User;
