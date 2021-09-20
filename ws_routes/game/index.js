const User = require('../../models/User');
const {GameRoom} = require('../../models/GameRoom');
const {tryLock, unlock} = require('../../credentials/redis_lock');
const {Game, GAME_STATE, GAME_EVENTS} = require('../../models/Game');
const Word = require('../../models/Word');
const uuidv4 = require('uuid').v4;
const stringSimilarity = require('string-similarity');


const getNextArtist = function (gameRoom, game) {
    let nextArtistIndex;
    for (let i = 0; i < gameRoom.players.length; i++) {
        if (gameRoom.players[i].uid === game.artistID) {
            nextArtistIndex = i + 1;
            break;
        }
    }
    return gameRoom.players[nextArtistIndex];
};

const getGameState = async function (game, gameRoom) {
    const gameState = {};
    if (game) {
        gameState.gameUID = game._id;
        gameState.state = game.state;
        gameState.stateID = game.stateID;
        gameState.round = game.round;
        gameState.timeout = game.stateExpiry - Date.now();
        gameState.artistID = game.artistID;
    }
    if (gameRoom) {
        gameState.players = [];
        for (const player of gameRoom.players) {
            const playerUser = await User.findOne({uid: player.uid});
            if (!playerUser)
                continue;
            gameState.players.push({
                uid: player.uid,
                score: player.score,
                nick: playerUser.name,
                avatar: playerUser.avatar,
                totalScore: playerUser.points
            });
        }
    }
    return gameState;
};

const NEW_GAME_TIMEOUT = 10000;
const endGame = async function (game, gameRoom) {
    if (!game || !gameRoom)
        return;
    /*game.state = GAME_STATE.ENDED;
    game.stateID = '';*/
    await game.remove();
    gameRoom.cGame = '';
    await gameRoom.save();
    const wsWrapper = require('../../ws_routes/WSWrapper');
    const scores = {};
    for(const player of gameRoom.players) {
        scores[player.uid] = player.score;
    }
    //Send timeout of new game if more than one player exists.
    const message = {type: GAME_EVENTS.GAME_ENDED, scores, ...((gameRoom.players.length > 1) && {timeout: NEW_GAME_TIMEOUT})};
    gameRoom.players.forEach(player => {
        wsWrapper.sendMSG(player.sessionID, message);
    });
    if(gameRoom.players.length > 1)
        setTimeout(()=>startGame(gameRoom._id), NEW_GAME_TIMEOUT); //start new game after 30 seconds.
};

const onUserLeftGame = async function (uid, gameID) {
    const game = await Game.findOne({_id: gameID});
    if (!game) return;
    if (uid === game.artistID) {
        if (game.state === GAME_STATE.CHOOSING)
            await startChoosing(gameID);
        else if (game.state === GAME_STATE.DRAWING)
            await onDrawingCompleted(gameID, null, true);
    }
};

const onDrawingCompleted = async function (gameUID, stateID, skipStateCheck) {
    const game = await Game.findOne({_id: gameUID});
    if (!game) return;
    //If this function depends on stateID which means, it might be called by timeout, then action must be taken only if state id matches.
    if (stateID && (game.stateID !== stateID || skipStateCheck)) //State check can be skipped when artist leaves game.
        return;
    const gameRoom = await GameRoom.findOne({_id: game.roomUID});
    if (!gameRoom) return;
    const stateData = JSON.parse(game.stateData);
    const guessers = stateData.guessers || {};
    const drawScores = {};
    //Deduct scores of those who didn't guess right.
    gameRoom.players.forEach((player) => {
        if (player.uid !== game.artistID && !guessers[player.uid] && Date.now() - player.joinTime > 10000) { //If join time is greater than 10 seconds
            player.score -= 3;
            drawScores[player.uid] = -3;
        } else if (player.uid === game.artistID) {
            drawScores[player.uid] = stateData.artistScore;
            player.score += stateData.artistScore;
        } else drawScores[player.uid] = guessers[player.uid] ? guessers[player.uid].score : 0;
    });
    await gameRoom.save();
    const wsWrapper = require('../../ws_routes/WSWrapper');
    const message = {
        type: GAME_EVENTS.DRAWING_COMPLETE,
        drawScores,
        word: game.cWord
    };
    gameRoom.players.forEach(player => {
        wsWrapper.sendMSG(player.sessionID, message);
    });
    await startChoosing(game._id);
};

const guessWord = async function (locksArr, stateID, gameUID, {sessionID, uid, word}) {
    locksArr.push(await tryLock(`locks:${gameUID}`));
    const game = await Game.findOne({_id: gameUID});
    if (!game || game.stateID !== stateID || game.state !== GAME_STATE.DRAWING || game.artistID === uid) {
        return;
    }
    const wsWrapper = require('../../ws_routes/WSWrapper');
    locksArr.push(await tryLock(`locks:${game.roomUID}`));
    const gameRoom = await GameRoom.findOne({_id: game.roomUID});
    const stateData = JSON.parse(game.stateData);
    const guessers = stateData.guessers || {};
    const rightGuess = game.cWord.toUpperCase() === word.toUpperCase();
    if(rightGuess && guessers[uid]) //If the user already guessed it, and resending it, reject it.
        return;
    const msg = {
        type: rightGuess ? GAME_EVENTS.GUESS_SUCCESS : GAME_EVENTS.GUESS_FAIL, uid, ...(!rightGuess && {
            word
        })
    };
    gameRoom.players.forEach(player => {
        wsWrapper.sendMSG(player.sessionID, msg);
    });
    //If the guess isn't right, and the user hasn't already guessed, only then send similarity clues.
    if (!rightGuess && !guessers[uid]) {
        const similarity = stringSimilarity.compareTwoStrings(game.cWord.toUpperCase(), word.toUpperCase()).toFixed(2) * 100;
        if (similarity >= 60)
            wsWrapper.sendMSG(sessionID, {type: GAME_EVENTS.GUESS_SIMILAR, similarity, word, uid});
        return;
    }
    if (guessers[uid]) return; //This user already guessed it right.
    const numGuessers = Object.keys(guessers).length;
    guessers[uid] = {rank: numGuessers + 1, score: 0};
    const thisPlayer = gameRoom.players.filter(player => player.uid === uid)[0];
    const artistPlayer = gameRoom.players.filter(player => player.uid === game.artistID)[0];
    if (!thisPlayer || !artistPlayer) return;
    if (numGuessers === 0) { //First guesser is rewarded 7 points
        thisPlayer.score += 7;
        guessers[uid].score = 7;
    }
    if (numGuessers === 1) { //Second guesser is rewarded 5 points
        thisPlayer.score += 5;
        guessers[uid].score = 5;
    }
    if (numGuessers < 2) { //artist rewarded twice
        artistPlayer.score += 7;
        stateData.artistScore += 7;
    }
    game.stateData = JSON.stringify(stateData);
    await gameRoom.save();
    await game.save();
    //If all the players have guessed, the number of keys in guessed object should be totalPlayers - 1. The rest 1 is the artist.
    const allPlayersGuessed = gameRoom.players.filter((player) => guessers[player.uid]).length === gameRoom.players.length - 1;
    if (allPlayersGuessed) {
        //Schedule when free, because this might prevent from releasing acquired locks.
        setTimeout(async ()=>await onDrawingCompleted(game._id), 0);
    }
};

const moveToDrawingState = async function (game, chosenWord) {
    game.cWord = chosenWord;
    game.state = GAME_STATE.DRAWING;
    game.stateID = uuidv4();
    game.stateData = JSON.stringify({guessers: {}, artistScore: 0});
    game.stateExpiry = Date.now() + DRAW_TIMEOUT;
    await game.save();
    await doneChoosing(game);
};

const autoChoose = async function (stateID, gameUID) {
    const game = await Game.findOne({_id: gameUID});
    if (!game || game.stateID !== stateID)
        return;
    const words = JSON.parse(game.stateData);
    const max = words.length - 1, min = 0;
    const wordIndex = Math.floor(Math.random() * (max - min + 1)) + min;
    await moveToDrawingState(game, words[wordIndex]);
};

const chosenWord = async function (wordIndex, stateID, gameUID, uid) {
    const game = await Game.findOne({_id: gameUID});
    if (!game || game.stateID !== stateID || game.state !== GAME_STATE.CHOOSING || game.artistID !== uid)
        return;
    const words = JSON.parse(game.stateData);
    if (!words[wordIndex])
        return;
    await moveToDrawingState(game, words[wordIndex]);
};

const sendHint = async function (stateID, word, gameID) {
    const game = await Game.findOne({_id: gameID});
    if (!game || game.stateID !== stateID)
        return;

    const numHints = parseInt(word.length / 4);
    if (numHints < 0)
        return;
    const wordHint = word.replace(/[A-Za-z]/g, "_");
    const hintArray = Array.from(wordHint);
    for (let i = 0; i < numHints; i++) {
        const max = word.length - 1, min = 0;
        const letterIndex = Math.floor(Math.random() * (max - min + 1)) + min;
        hintArray[letterIndex] = word[letterIndex];
    }

    const hint = hintArray.join("");
    const gameRoom = await GameRoom.findOne({_id: game.roomUID});
    if (!gameRoom)
        return;
    const wsWrapper = require('../../ws_routes/WSWrapper');
    gameRoom.players.forEach(player => {
        wsWrapper.sendMSG(player.sessionID,
            {
                type: GAME_EVENTS.HINT,
                hint
            }); //send word to currentArtist only.
    });
};

const doneChoosing = async function (game) {
    const gameRoom = await GameRoom.findOne({_id: game.roomUID});
    if (!gameRoom) {
        console.log("Looks like gameRoom was deleted when game " + game._id + " was moving to drawing state");
        return;
    }
    const wsWrapper = require('../../ws_routes/WSWrapper');
    const artistID = game.artistID;
    const wordHint = game.cWord.replace(/[A-Za-z]/g, "_");
    const gameState = await getGameState(game);
    gameRoom.players.forEach(player => {
        wsWrapper.sendMSG(player.sessionID,
            {
                type: GAME_EVENTS.DRAWING_STARTED,
                ...gameState,
                hint: (artistID === player.uid) ? game.cWord : wordHint
            }); //send word to currentArtist only.
    });

    setTimeout(async () => {
        await sendHint(game.stateID, game.cWord, game._id);
    }, DRAW_TIMEOUT / 2);
    setTimeout(async () => {
        await onDrawingCompleted(game._id, game.stateID);
    }, DRAW_TIMEOUT);
};

const CHOOSE_TIMEOUT = 10000;//10000; //10 seconds
const DRAW_TIMEOUT = 60000;//60000; //60 seconds
const startChoosing = async function (gameID) {
    const game = await Game.findOne({_id: gameID, state: {$ne: GAME_STATE.ENDED}});
    const gameRoom = await GameRoom.findOne({_id: game.roomUID});
    game.state = GAME_STATE.CHOOSING;
    game.stateID = uuidv4();
    game.stateExpiry = Date.now() + CHOOSE_TIMEOUT;
    const words = await Word.random(3);
    const currentArtist = game.artistID ? getNextArtist(gameRoom, game) : gameRoom.players[0];
    if (currentArtist) {
        game.stateData = JSON.stringify(words);
        game.artistID = currentArtist.uid;
        const wsWrapper = require('../../ws_routes/WSWrapper');
        const choosingEventMsg = {
            type: GAME_EVENTS.CHOOSING_STARTED,
            ...(await getGameState(game, gameRoom))
        };
        gameRoom.players.forEach(player => {
            const isCurrentArtist = currentArtist === player;
            wsWrapper.sendMSG(player.sessionID, isCurrentArtist ? {...choosingEventMsg, words} : choosingEventMsg); //send words to currentArtist only.
        });
        await game.save();
        setTimeout(async () => {
            await autoChoose(game.stateID, game._id);
        }, CHOOSE_TIMEOUT);
    } else if (gameRoom.players.length > 1) {
        await startNewRound(gameRoom._id);
    } else {
        await endGame(game, gameRoom);
    }
};

const MAX_ROUNDS = 3;
const startNewRound = async function (roomUID) {
    const gameRoom = await GameRoom.findOne({_id: roomUID});
    let game = await Game.findOne({roomUID, state: {$ne: GAME_STATE.ENDED}});
    if (!game && gameRoom && gameRoom.players.length > 1) { //If game doesn't exist, and gameRoom exists, create new game.
        game = new Game({
            roomUID,
            state: GAME_STATE.CHOOSING,
            stateID: uuidv4(),
            round: 0,
            cWord: "Hello",
        });
        gameRoom.cGame = game._id;
        gameRoom.players.forEach(player => player.score = 0); //Reset each player's score.
        await gameRoom.save();
    }
    if(!game) //Game must have been created by here, if gameRoom was valid.
        return;
    game.artistID = ''; //Reset artistID, so that first artist will be picked in choosing new artist.
    game.round = game.round + 1;
    if (game.round > MAX_ROUNDS) {
        await endGame(game, gameRoom);
    } else {
        await game.save();
        await startChoosing(game._id);
    }
};

const startGame = async function (roomUID) {
    await startNewRound(roomUID);
};

module.exports = {
    startGame,
    guessWord,
    chosenWord,
    endGame,
    onUserLeftGame,
    getGameState
};
