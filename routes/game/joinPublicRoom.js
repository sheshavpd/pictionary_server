const {GameRoom, ROOM_TYPE, getValidRoomUID} = require('../../models/GameRoom');
const {Game, GAME_STATE, GAME_EVENTS} = require('../../models/Game');
const User = require('../../models/User');
const exitCurrentGames = require('../../ws_routes/game/exitCurrentGames');
const {startGame, getGameState} = require('../../ws_routes/game');
const {HTTPStatusCodes, MAX_PLAYERS_PER_ROOM} = require('../../AppConstants');
const redisClient = require('../../credentials/redis_client');
const {hmgetAsync} = require('../../credentials/redis_async');
const { tryLock, unlock } = require('../../credentials/redis_lock');

const newPublicRoom = async function(req, res) {
    let gameRoom;
    try {
        gameRoom = new GameRoom({
            hostUID: req.decoded.uid,
            type: ROOM_TYPE.PUBLIC,
            players: [],
            roomID: await getValidRoomUID(),
            audio: false
        });
        await gameRoom.save();
    }catch(e){
        console.log(e);
        res.status(HTTPStatusCodes.INTERNAL_SV_ERROR).json({error: true, message: "DBError while creating new room"});
        return;
    }
    return gameRoom;
};

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
    const availableRooms = await GameRoom.aggregate(
        [
            {$match: {type: ROOM_TYPE.PUBLIC, $expr: {$lt: [{$size: "$players"}, MAX_PLAYERS_PER_ROOM]}, "players.0": {$exists: true}}},
            {
                $project: {
                    _id: 1,
                    players: 1,
                    cGame: 1,
                    audio: 1,
                    length : {$size: "$players"}
                }
            },
            {$sort: {length: 1}},
            {$limit: 1}
        ]
    );
    let gameRoom = availableRooms[0];
    if (!gameRoom) {
        gameRoom = await newPublicRoom(req, res);
        if(!gameRoom)
            return;
    }
    gameRoom.players.unshift({sessionID: currentSessionID, uid: req.decoded.uid});
    try {
        //Because gameRoom isn't a model object, and can't invoke .save() on it.
        await GameRoom.updateOne({_id: gameRoom._id }, { players: gameRoom.players });
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
                startGame(gameRoom._id);
        } else startGame(gameRoom._id);
    }
    notifyUserJoin(gameRoom, req.decoded.uid);
    const gameState = await getGameState(game, gameRoom);
    return {gameRoomID: gameRoom._id, audio: gameRoom.audio, ...gameState};
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

const joinPublicRoom = async function (req, res) {
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

const lockedJoinPublicRoom = async function(req, res) {
    const pubRoomJoinLock = await tryLock("locks:public_room_join");
    if(!pubRoomJoinLock) {
        res.status(HTTPStatusCodes.INTERNAL_SV_ERROR).json({
            error: true,
            message: "Too many requests. Please try again."
        });
        return;
    }
    try {
        await joinPublicRoom(req, res);
    }catch(e){
        console.log(e);
    }
    await unlock(pubRoomJoinLock);
};

module.exports = lockedJoinPublicRoom;
