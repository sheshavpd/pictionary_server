const game = require('./index');
const exitGame = require('./exitGame');
const {lockJobUnlock} = require('../../credentials/redis_lock');

const chosenWordMsg = async function (decoded, payload) {
    const wordIndex = payload.wordIndex;
    const stateID = payload.stateID;
    const gameUID = payload.gameUID;
    try {
        await game.chosenWord(wordIndex, stateID, gameUID, decoded.uid);
    } catch (e) {
        console.log(e);
    }
};

const guessedWordMsg = async function(decoded, payload) {
    const word = payload.word;
    const stateID = payload.stateID;
    const gameUID = payload.gameUID;
    try {
        await lockJobUnlock(async (lockArr) => {
            await game.guessWord(lockArr, stateID, gameUID, {sessionID: decoded.sessionID, uid: decoded.uid, word});
        });
    } catch (e) {
        console.log(e);
    }
};

const exitGameMsg = async function(decoded, payload) {
    try {
        await exitGame({gameRoomID: payload.gameRoomID, userID: decoded.uid});
    } catch (e) {
        console.log(e);
    }
};

module.exports = {
    chosenWordMsg,
    guessedWordMsg,
    exitGameMsg
};
