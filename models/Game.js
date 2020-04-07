const mongoose = require('./../mongoConfig');
const Schema = mongoose.Schema;

const GAME_STATE = {
    ACTIVE: "ACTIVE",
    CHOOSING: "CHOOSING",
    DRAWING: "DRAWING",
    ENDED: "ENDED"
};

const GAME_EVENTS = {
    CHOOSING_STARTED: "CHOOSING_STARTED",
    DRAWING_STARTED: "DRAWING_STARTED",
    GAME_ENDED: "GAME_ENDED",
    GUESS_SUCCESS: "GUESS_SUCCESS",
    HINT: "HINT",
    GUESS_SIMILAR: "GUESS_SIMILAR",
    GUESS_FAIL: "GUESS_FAIL",
    DRAWING_COMPLETE: "DRAWING_COMPLETE",
    GUESS_SUBMIT: "GUESS_SUBMIT",
    WORD_CHOSEN: "WORD_CHOSEN",
    USER_LEFT: "USER_LEFT",
    USER_JOINED: "USER_JOINED",
};
const gameSchema = new Schema({
    roomUID: {type: String, required: true},
    artistID: {type: String},
    round: {type: Number, required: true},
    state: {type: String, required: true},
    stateExpiry: {type: Number},
    stateID: {type: String},
    stateData: {type: String},
    cWord: {type: String}, //current word
    time: {type: Date}
});
gameSchema.index({gameID: 1});
gameSchema.index({state: 1});
gameSchema.pre('save', function (next) {
    if (!this.time) {
        this.time = new Date();
    }
    next();
});

const Game = mongoose.model('Game', gameSchema);

module.exports = {
    Game,
    GAME_STATE,
    GAME_EVENTS
};
