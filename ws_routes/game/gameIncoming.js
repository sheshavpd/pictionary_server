const game = require('./index');
const exitGame = require('./exitGame');
const {lockJobUnlock} = require('../../credentials/redis_lock');
const {GameRoom} = require('../../models/GameRoom');
const {Game, GAME_EVENTS} = require('../../models/Game');

const strokeMsg = async function (decoded, payload) {
    const strokePoints = payload.strokePoints;
    const gameUID = payload.gameUID;
    try {
        let game = await Game.findOne({_id: gameUID});
        if (!game || game.artistID !== decoded.uid) return;
        let gameRoom = await GameRoom.findOne({_id: game.roomUID});
        if (!gameRoom) return;
        const wsWrapper = require('../WSWrapper');
        gameRoom.players.forEach(player => {
            if (player.uid !== decoded.uid)
                wsWrapper.sendMSG(player.sessionID,
                    {
                        type: GAME_EVENTS.STROKE,
                        strokePoints
                    }); //send word to currentArtist only.
        });
    } catch (e) {
        console.log(e);
    }
};

const clearBoardMsg = async function (decoded, payload) {
    const gameUID = payload.gameUID;
    try {
        let game = await Game.findOne({_id: gameUID});
        if (!game || game.artistID !== decoded.uid) return;
        let gameRoom = await GameRoom.findOne({_id: game.roomUID});
        if (!gameRoom) return;
        const wsWrapper = require('../WSWrapper');
        gameRoom.players.forEach(player => {
            if (player.uid !== decoded.uid)
                wsWrapper.sendMSG(player.sessionID,
                    {
                        type: GAME_EVENTS.CLEAR_BOARD
                    }); //send word to currentArtist only.
        });
    } catch (e) {
        console.log(e);
    }
};


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

const guessedWordMsg = async function (decoded, payload) {
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

const exitGameMsg = async function (decoded, payload) {
    try {
        await exitGame({gameRoomID: payload.gameRoomID, userID: decoded.uid});
    } catch (e) {
        console.log(e);
    }
};

module.exports = {
    strokeMsg,
    chosenWordMsg,
    guessedWordMsg,
    exitGameMsg,
    clearBoardMsg
};
