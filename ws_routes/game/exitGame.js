const {GameRoom} = require('../../models/GameRoom');
const {Game, GAME_EVENTS} = require('../../models/Game');
const { endGame, onUserLeftGame } = require('./index');
const User = require('../../models/User');

//could pass (gameRoomID, userID) or (gameRoom, user)
const exitGame = async function({gameRoomID, userID, gameRoom, user}) {
    const gameRoomData =  gameRoomID?await GameRoom.findOne({_id:gameRoomID}):gameRoom;
    const userData = userID?await User.findOne({uid:userID}):user;
    //Set gameRoomID and userID, to reuse further.
    if(!userID) userID = userData.uid;
    if(!gameRoomID && gameRoomData) gameRoomID = gameRoomData._id;
    if(gameRoomData) {
        //Remove all sessions that match with this userID
        gameRoomData.players = gameRoomData.players.filter(player => player.uid !== userID);
        if(gameRoomData.players.length === 0)
            await gameRoomData.remove();
        else await gameRoomData.save();
        const disconnectedMSG = {type: GAME_EVENTS.USER_LEFT, uid: userID, gameRoomID: gameRoomData._id};
        if(gameRoomData.cGame && gameRoomData.players.length <= 1) {
            endGame(await Game.findOne({_id: gameRoomData.cGame}), gameRoomData);
        } else if(gameRoomData.cGame) {
            onUserLeftGame(gameRoomData.cGame); //Check if the user is an artist, and make some actions based on 'user-left'.
        }
        // Import wsWrapper here, because it might create circular dependency.
        // exitCurrentGames -> exitGame -> wsWrapper -> exitCurrentGames.
        const wsWrapper = require('../../ws_routes/WSWrapper');
        gameRoomData.players.forEach(player=>{
            wsWrapper.sendMSG(player.sessionID, disconnectedMSG);
        });
    }
    //Whether gameRoomData is not available or not, gameRoomID might be left in the currentGames array of userData. Clear it.
    if(userData && gameRoomID) {
        userData.currentGames = userData.currentGames.filter((gameID) => gameID !== gameRoomID);
        await userData.save();
    }
};

module.exports = exitGame;
