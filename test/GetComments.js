const path = require('path');

const BaseStubber = require('../BaseStubber');

module.exports = BaseStubber.extend({
  responsesDir: path.resolve(__dirname, 'comments'),
  matchersFile: path.resolve(__dirname, 'comments', 'requests.json'),
});