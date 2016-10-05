const path = require('path');

const BaseStubber = require('../BaseStubber');

const GetComments = BaseStubber.extend({
  responsesDir: path.resolve(__dirname, 'comments'),
  requestsFile: path.resolve(__dirname, 'comments', 'requests.json'),

  initialize: function (app) {
    app.get('/:path', this.matchStub, this.saveAndReturnStub);
  }
});

module.exports = GetComments;