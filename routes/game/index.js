const game = require('express').Router();
const createRoom = require('./createRoom');
const joinPrivateRoom = require('./joinPrivateRoom');

game.get('/create', createRoom);
game.post('/join', joinPrivateRoom);

module.exports = game;
