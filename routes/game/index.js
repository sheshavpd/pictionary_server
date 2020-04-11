const game = require('express').Router();
const createRoom = require('./createRoom');
const joinPrivateRoom = require('./joinPrivateRoom');
const joinPublicRoom = require('./joinPublicRoom');

game.post('/create', createRoom);
game.post('/join', joinPrivateRoom);
game.post('/join-pub', joinPublicRoom);

module.exports = game;
