const {GameRoom, ROOM_TYPE, getValidRoomUID} = require('../../models/GameRoom');
const User = require('../../models/User');
const exitCurrentGames = require('../../ws_routes/game/exitCurrentGames');
const {HTTPStatusCodes} = require('../../AppConstants');
const redisClient = require('../../credentials/redis_client');
const {hmgetAsync} = require('../../credentials/redis_async');

const newPrivateRoom = async function(req, res, userData) {
    let currentSessionID;
    try {
        currentSessionID = (await hmgetAsync(redisClient)('sessions', req.decoded.uid))[0];
    }catch(e){
        console.log(e);
        res.status(HTTPStatusCodes.INTERNAL_SV_ERROR).json({error: true, message: "Error finding user session."});
        return;
    }
    if(!currentSessionID) {
        res.status(HTTPStatusCodes.BAD_REQUEST).json({error: true, message: "Please connect to server, and retry."});
        return;
    }

    let gameRoom;
    try {
        gameRoom = new GameRoom({
            hostUID: req.decoded.uid,
            type: ROOM_TYPE.PRIVATE,
            players: [{sessionID: currentSessionID, uid: req.decoded.uid}],
            roomID: await getValidRoomUID(),
            audio: req.body.audio && req.body.audio === "true" //If audio is present (and not false), it's true. else, false.
        });
        await gameRoom.save();
        userData.currentGames.push(gameRoom._id);
        await userData.save();
    }catch(e){
        console.log(e);
        res.status(HTTPStatusCodes.INTERNAL_SV_ERROR).json({error: true, message: "DBError while creating new room"});
        return;
    }
    return { roomUID: gameRoom.roomID, gameRoomID: gameRoom._id};
};

const createPrivateRoom = async function (req, res) {
    let userData;
    try {
        userData = await User.findOne({uid: req.decoded.uid});
        //check if user is in any other room, and disconnect him from there.
        await exitCurrentGames({userData});
    } catch(e) {
        console.log(e);
        res.status(HTTPStatusCodes.INTERNAL_SV_ERROR).json({error: true, message: "Error while checking currently active games."});
        return;
    }

    const newRoomDetails = await newPrivateRoom(req, res, userData);
    if(!newRoomDetails) return;
    res.status(HTTPStatusCodes.OK).json({error: false, newRoomDetails});
};

module.exports = createPrivateRoom;
