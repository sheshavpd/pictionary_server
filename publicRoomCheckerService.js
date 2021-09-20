const {GameRoom, ROOM_TYPE} = require('./models/GameRoom');
const {Game} = require('./models/Game');
const redisClient = require('./credentials/redis_client');
const exitGame = require('./ws_routes/game/exitGame');
const {getAsync} = require('./credentials/redis_async');

const MAX_UPDATE_TIME_EXPIRY = 120; //If 120 seconds have passed since game has been last updated.
const checkRoomHavingGame = async function(gameRoom) {
    const currentTime = Math.round(Date.now() / 1000);
    const game = await Game.findOne({_id: gameRoom.cGame});
    if(!game) {
        await gameRoom.remove();
        console.log(`Removed GameRoom ${gameRoom._id} because no such game ${gameRoom.cGame} exists`);
        return;
    }
    if(!game.updateTime) {
        console.log(`Removed GameRoom ${gameRoom._id} because no updateTime exists on game ${game._id}`);
        await game.remove();
        await gameRoom.remove();
        return;
    }
    if(Math.abs(currentTime - game.updateTime) >= MAX_UPDATE_TIME_EXPIRY) {
        console.log(`Removed GameRoom ${gameRoom._id} because no updateTime has been expired on game ${game._id}`);
        await game.remove();
        await gameRoom.remove();
    }
};

const checkRoomHavingNoGame = async function(gameRoom) {
    for(const player of gameRoom.players) {
        let sessionPlayerUID;
        try {
            sessionPlayerUID = (await getAsync(redisClient)(player.sessionID));
        } catch (e) {
            console.log(e);
            return;
        }
        //If player isn't online
        if (!sessionPlayerUID) {
            console.log(`Removed Player with uid ${player.uid} because session has expired in redis, which means player is inactive.`);
            await exitGame({ gameRoom, userID: player.uid});
        }
    }
    if(gameRoom.players.length === 0) {
        console.log(`Removed GameRoom ${gameRoom._id} because no players in the room after checking for inactive players.`);
        await gameRoom.remove();
    }
};

const publicRoomCheckerService = async function () {
    const publicRooms = await GameRoom.find({type: ROOM_TYPE.PUBLIC});
    if(!publicRooms)
        return;
    for(const room of publicRooms) {
        if(room.players.length === 0) {
            console.log(`Removed GameRoom ${room._id} because no players are in the room.`);
            await room.remove();
            return;
        }
        if(room.cGame) {
            try {
                await checkRoomHavingGame(room);
            }catch(e){console.log(e);}
        } else {
            try {
                await checkRoomHavingNoGame(room);
            }catch(e){console.log(e);}

        }
    }
};

setInterval(async () => {
    try {
        await publicRoomCheckerService();
    } catch (e) {
        console.log(e);
    }
}, 3*60*1000); //Check every 3 minutes.

module.exports = publicRoomCheckerService;

