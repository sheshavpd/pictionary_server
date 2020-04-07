const mongoose = require('./../mongoConfig');
const shortid = require('./../credentials/shortid_instance');
const Schema = mongoose.Schema;

const ROOM_TYPE = {
    PUBLIC:1,
    PRIVATE:2
};
const playerSchema = new Schema({
    uid: {type: String, required: true},
    score: {type: Number, default: 0},
    sessionID: {type: String, required: true},
    joinTime: {type: Number, default: Date.now}
});

playerSchema.index({playerUID: 1});
playerSchema.index({sessionID: 1});

const gameRoomSchema = new Schema({
    hostUID: {type: String},
    type: {type: Number, required: true},
    roomID: {type: String, required: true},
    players: [playerSchema],
    cGame: {type: String}, //currentGame
    time: {type: Date}
});
gameRoomSchema.index({roomID:1});
gameRoomSchema.index({hostUID:1});
gameRoomSchema.index({cGame:1});
gameRoomSchema.pre('save', function(next){
    if ( !this.time ) {
        this.time = new Date();
    }
    next();
});

const GameRoom = mongoose.model('GameRoom', gameRoomSchema);

//Get an unique id that doesn't already exist in the database.
const getValidRoomUID = async function() {
    let newID, idExists = true;
    while(idExists) {
        newID = shortid.generate();
        idExists = await GameRoom.findOne({roomID: newID});
    }
    return newID;
};
module.exports = {
    GameRoom,
    ROOM_TYPE,
    getValidRoomUID
};
