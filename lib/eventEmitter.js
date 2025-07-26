// Meningkatkan batas maksimum listener untuk mengatasi peringatan
// MaxListenersExceededWarning: Possible EventEmitter memory leak detected
const { EventEmitter } = require('events');
EventEmitter.defaultMaxListeners = 15;

module.exports = EventEmitter;