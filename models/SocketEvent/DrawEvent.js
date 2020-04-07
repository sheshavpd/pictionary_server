const SocketEvent = require('./index');
const DRAW_EVENT_TYPES = {
    STROKE_EVENT: 1,
    ERASE_EVENT: 2,
};
const DrawEvent = SocketEvent.discriminator('DrawEvent',
    new mongoose.Schema({
        artID: {type: String, required: true},
        x: {type: Number, required: true},
        y: {type: Number, required: true},
        strokeWidth: {type: Number, required: true}
    }));

const StrokeEvent = DrawEvent.discriminator(DRAW_EVENT_TYPES.STROKE_EVENT,
    new mongoose.Schema({
        color: {type: Number, default: 0x0000}
    }));

const EraseEvent = DrawEvent.discriminator(DRAW_EVENT_TYPES.ERASE_EVENT);

module.exports = {
    DRAW_EVENT_TYPES,
    StrokeEvent,
    EraseEvent
};
