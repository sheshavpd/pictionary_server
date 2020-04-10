const game = require('express').Router();
const createRoom = require('./createRoom');
const joinPrivateRoom = require('./joinPrivateRoom');

game.post('/create', createRoom);
game.post('/join', joinPrivateRoom);

module.exports = game;
