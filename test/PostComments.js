const path = require('path');

const jsonParser = require('body-parser').json()

const BaseStubber = require('../BaseStubber');

const PostComments = BaseStubber.extend({
  responsesDir: path.resolve(__dirname, 'comments'),
  requestsFile: path.resolve(__dirname, 'comments', 'postRequests.json'),

  initialize: function (app) {
    app.post('/:path', jsonParser, this.matchStub, this.saveAndReturnStub);
  },
});

module.exports = PostComments;