const {GameRoom} = require('../../models/GameRoom');
const {Game, GAME_STATE, GAME_EVENTS} = require('../../models/Game');
const User = require('../../models/User');
const exitCurrentGames = require('../../ws_routes/game/exitCurrentGames');
const {startGame, getGameState} = require('../../ws_routes/game');
const Helpers = require("../../utils/Helpers");
const {HTTPStatusCodes, MAX_PLAYERS_PER_ROOM} = require('../../AppConstants');
const redisClient = require('../../credentials/redis_client');
const {hmgetAsync} = require('../../credentials/redis_async');

const joinToRoom = async function (req, res, userData) {
    let currentSessionID;
    try {
        currentSessionID = (await hmgetAsync(redisClient)('sessions', req.decoded.uid))[0];
    } catch (e) {
        console.log(e);
        res.status(HTTPStatusCodes.INTERNAL_SV_ERROR).json({error: true, message: "Error finding user session."});
        return;
    }
    if (!currentSessionID) {
        res.status(HTTPStatusCodes.BAD_REQUEST).json({error: true, message: "Please connect to server, and retry."});
        return;
    }
    const gameRoom = await GameRoom.findOne({roomID: req.body.roomID});
    if (!gameRoom) {
        res.status(HTTPStatusCodes.BAD_REQUEST).json({error: true, message: "No game exists with that id."});
        return;
    }
    if (gameRoom.players.length >= MAX_PLAYERS_PER_ROOM) {
        res.status(HTTPStatusCodes.FORBIDDEN).json({error: true, message: `Game room full (${MAX_PLAYERS_PER_ROOM} players max).`});
        return;
    }
    gameRoom.players.unshift({sessionID: currentSessionID, uid: req.decoded.uid});
    try {
        await gameRoom.save();
        userData.currentGames.push(gameRoom._id);
        await userData.save();
    } catch (e) {
        console.log(e);
        res.status(HTTPStatusCodes.INTERNAL_SV_ERROR).json({error: true, message: "DBError while creating new room"});
        return;
    }
    let game;
    if (gameRoom.players.length > 1) {
        if (gameRoom.cGame) {
            game = await Game.findOne({_id: gameRoom.cGame});
            if (!game || game.state === GAME_STATE.ENDED)
                scheduleNewGameAfterResponseIsSent(gameRoom._id);
        } else scheduleNewGameAfterResponseIsSent(gameRoom._id);
    }
    notifyUserJoin(gameRoom, req.decoded.uid);
    const gameState = await getGameState(game, gameRoom);
    return {gameRoomID: gameRoom._id, audio: gameRoom.audio, ...gameState};
};

// TODO: Proper sequential scheduling of new game.
// Currently 50ms delay is added to start game after the response is sent, as choosing_started was being sent before game joined response.
const scheduleNewGameAfterResponseIsSent = function(gameRoomID) {
    setTimeout(()=>{
        startGame(gameRoomID);
    }, 50);
};

const notifyUserJoin = async function (gameRoom, uid) {
    const user = await User.findOne({uid});
    if (!user) return;
    const joinMSG = {
        type: GAME_EVENTS.USER_JOINED,
        uid,
        name: user.name,
        totalScore: user.points,
        avatar: user.avatar,
        gameRoomID: gameRoom._id
    };
    const wsWrapper = require('../../ws_routes/WSWrapper');
    gameRoom.players.forEach(player => {
        if (player.uid !== uid)
            wsWrapper.sendMSG(player.sessionID, joinMSG);
    });
};

const joinPrivateRoom = async function (req, res) {
    if (!Helpers.validateParamWithLength([req.body.roomID])) {
        res.status(HTTPStatusCodes.BAD_REQUEST).json({error: true, message: "Invalid parameters."});
        return;
    }
    let userData;
    try {
        userData = await User.findOne({uid: req.decoded.uid});
        //check if user is in any other room, and disconnect him from there.
        await exitCurrentGames({userData});
    } catch (e) {
        console.log(e);
        res.status(HTTPStatusCodes.INTERNAL_SV_ERROR).json({
            error: true,
            message: "Error while checking currently active games."
        });
        return;
    }
    const gameDetails = await joinToRoom(req, res, userData);
    if (!gameDetails) return;
    res.status(HTTPStatusCodes.OK).json({error: false, gameDetails});
};

module.exports = joinPrivateRoom;
