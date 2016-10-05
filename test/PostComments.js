const path = require('path');

const BaseStubber = require('../BaseStubber');

const PostComments = BaseStubber.extend({
  responsesDir: path.resolve(__dirname, 'comments'),
  requestsFile: path.resolve(__dirname, 'comments', 'postRequests.json'),
});

module.exports = PostComments;