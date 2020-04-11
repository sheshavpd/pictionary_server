const redis_client = require('../credentials/redis_client');
const redis_subscriber = require('../credentials/redis_subscriber');
const redis_publisher = require('../credentials/redis_publisher');
const redisClient = require('../credentials/redis_client');
const exitCurrentGameRooms = require('./game/exitCurrentGames');
const {hmsetAsync, hmgetAsync, hdelAsync} = require('../credentials/redis_async');
const {strokeMsg, chosenWordMsg, guessedWordMsg, exitGameMsg, clearBoardMsg} = require('./game/gameIncoming');
const {GAME_EVENTS} = require('../models/Game');
const WebRTCEventTypes = require('../pojo/WebRTCEventTypes');

const WS_CHANNEL = "ws_channel";

class WSWrapper {
    constructor() {
        this.socketSessions = [];
    }

    get(sessionID) {
        return this.socketSessions[sessionID];
    }

    async addSocket(ws, req) {
        const decoded = req.decoded;
        const {sessionID} = decoded;
        try {
            const existingSessionIDs = await hmgetAsync(redisClient)('sessions', decoded.uid);
            existingSessionIDs.forEach(existingSessionID => {
                if (existingSessionID !== null)
                    this.disconnect(existingSessionID);
            });
        } catch (e) {
            console.log(e);
            return;
        }
        this.socketSessions[sessionID] = {
            socket: ws,
            decoded
        };
        try {
            await hmsetAsync(redisClient)('sessions', {[sessionID]: decoded.uid, [decoded.uid]: sessionID});
        } catch (e) {
            console.log(e);
            return;
        }
        console.log(`${decoded.uid} with session id ${decoded.sessionID} connected on port ${process.env.port}`);

        ws.on('message', (msg) => {
            try {
                let m = JSON.parse(msg);
                if (m.payload) {
                    switch (m.type) {
                        case GAME_EVENTS.STROKE:
                            strokeMsg(decoded, m.payload);
                            break;
                        case GAME_EVENTS.CLEAR_BOARD:
                            clearBoardMsg(decoded, m.payload);
                            break;
                        case GAME_EVENTS.GUESS_SUBMIT:
                            guessedWordMsg(decoded, m.payload);
                            break;
                        case GAME_EVENTS.WORD_CHOSEN:
                            chosenWordMsg(decoded, m.payload);
                            break;
                        case GAME_EVENTS.USER_LEFT:
                            exitGameMsg(decoded, m.payload);
                            break;
                    }
                    console.log(msg);
                } else { //if message doesn't contain payload.
                    switch(m.type) {
                        case WebRTCEventTypes.OFFER:
                            this.sendMSGToUID(m.uid, {...m, uid: decoded.uid});
                            break;
                        case WebRTCEventTypes.ANSWER:
                            this.sendMSGToUID(m.uid, {...m, uid: decoded.uid});
                            break;
                        case WebRTCEventTypes.CANDIDATE:
                            this.sendMSGToUID(m.uid, {...m, uid: decoded.uid});
                            break;
                    }
                }
            } catch (e) {
            }
        });
        ws.on('close', async (e) => {
            //console.log('The connection was closed!');
            if (ws === this.socketSessions[sessionID].socket) {
                delete (this.socketSessions[sessionID]);
            }
            try {
                await hdelAsync(redisClient)('sessions', [sessionID]);
                await exitCurrentGameRooms({userID: decoded.uid});
            } catch (e) {
                console.log(e);
                return;
            }
            console.log(`${decoded.uid} with session id ${decoded.sessionID} disconnected`);
        });
    }

    sendMSG(toSessionID, payload) {
        //If destination socketSession exists in local node, send it here. Else, send to other nodes to checkup!
        if (this.socketSessions[toSessionID])
            this.socketSessions[toSessionID].socket.send(JSON.stringify(payload));
        else redis_publisher.publish(WS_CHANNEL, JSON.stringify({type: WS_MSG_TYPES.UNICAST, toSessionID, payload}));
    }

    async sendMSGToUID(uid, payload) {
        try {
            const existingSessionIDs = await hmgetAsync(redisClient)('sessions', uid);
            existingSessionIDs.forEach(existingSessionID => {
                if (existingSessionID !== null) {
                    //If destination socketSession exists in local node, send it here. Else, send to other nodes to checkup!
                    if (this.socketSessions[existingSessionID])
                        this.socketSessions[existingSessionID].socket.send(JSON.stringify(payload));
                    else redis_publisher.publish(WS_CHANNEL, JSON.stringify({type: WS_MSG_TYPES.UNICAST, existingSessionID, payload}));
                }
            });
        } catch (e) {
            console.log(e);
        }

    }

    broadcast(payload) {
        redis_publisher.publish(WS_CHANNEL, JSON.stringify({type: WS_MSG_TYPES.BROADCAST, payload}));
    }

    disconnect(sessionID) {
        if (this.socketSessions[sessionID])
            this.socketSessions[sessionID].socket.close();
        else redis_publisher.publish(WS_CHANNEL, JSON.stringify({type: WS_MSG_TYPES.DISCONNECT_USER, sessionID}));
    }
}

const wsWrapper = new WSWrapper();
const WS_MSG_TYPES = {
    UNICAST: 0,
    BROADCAST: 1,
    DISCONNECT_USER: 2
};

redis_client.on("message", function (channel, msg) {
    if (channel !== WS_CHANNEL) return;
    const message = JSON.parse(msg);
    switch (message.type) {
        case WS_MSG_TYPES.UNICAST: {
            const session = wsWrapper.get(msg.to);
            if (session) session.socket.send(JSON.stringify(message.payload));
            break;
        }
        case WS_MSG_TYPES.BROADCAST: {
            wsWrapper.socketSessions.forEach(session => {
                session.socket.send(JSON.stringify(message.payload));
            });
            break;
        }
        case WS_MSG_TYPES.DISCONNECT_USER: {
            if (wsWrapper.socketSessions[message.sessionID]) {
                wsWrapper.socketSessions[message.sessionID].socket.close();
            }
            break;
        }
    }
});
redis_subscriber.subscribe(WS_CHANNEL);

module.exports = wsWrapper;
