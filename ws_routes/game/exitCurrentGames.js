const exitGame = require('./exitGame');
const User = require('../../models/User');
const exitCurrentGameRooms = async function({userData, userID}) {
    if(!userData) {
        userData = await User.findOne({uid: userID});
    }
    if(userData && userData.currentGames) {
        for (const currentGameID of userData.currentGames) {
            await exitGame({gameRoomID: currentGameID, user:userData});
        }
    }
};

module.exports = exitCurrentGameRooms;
