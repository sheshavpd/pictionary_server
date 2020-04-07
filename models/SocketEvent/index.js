const mongoose = require('./../../mongoConfig');
const Schema = mongoose.Schema;

const socketEventSchema = new Schema({
    type: {type: Number, required: true},
    dest: {type: String}, //destination.
    time: {type: Date}
});

socketEventSchema.pre('save', function(next){
    if ( !this.time ) {
        this.time = new Date();
    }
    next();
});

const SocketEvent = mongoose.model('Event', socketEventSchema);

module.exports = SocketEvent;
