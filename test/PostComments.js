const path = require('path');

const jsonParser = require('body-parser').json()

const BaseStubber = require('../BaseStubber');

function PostComments(app, opts) {
  BaseStubber.call(this, app, opts);
  app.post(
    '/:path',
    jsonParser,
    this.matchStub.bind(this),
    this.saveAndReturnStub.bind(this)
  );
}

Object.assign(PostComments.prototype, BaseStubber.prototype, {
  responsesDir: path.resolve(__dirname, 'comments'),
  requestsFile: path.resolve(__dirname, 'comments', 'postRequests.json'),
});

module.exports = PostComments;