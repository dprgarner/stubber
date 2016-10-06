const fs = require('fs');
const path = require('path');

const expect = require('chai').expect;
const express = require('express');
const Promise = require('bluebird');
const request = require('request-promise');
const rmdirSync = require('rimraf').sync;

const PostComments = require('./PostComments');

const readFile = Promise.promisify(fs.readFile);
const writeFile = Promise.promisify(fs.writeFile);

const dir = path.resolve(__dirname, 'comments');
const APP_PORT = 3005;
const LIVE_PORT = 3006;
const appUri = 'http://localhost:' + APP_PORT;
const liveUri = 'http://localhost:' + LIVE_PORT;

var postRequests = [{
  res: {
    filename: 'comments_hello-world.json',
  },
  req: {
    path: '/comments',
    query: {},
    body: {hello: 'world'},
  },
}];

var responseJson = [{
  postId: 1,
  id: 1,
  name: 'id labore ex et quam laborum',
  email: 'Eliseo@gardner.biz',
  body: 'Bello!',
}];

function listen(app, port) {
  return new Promise(function (resolve, reject) {
    var server = app.listen(port, function (err) {
      if (err) return reject(err);
      return resolve(server);
    });
  });
}

// Sets up a dummy live server that accepts gets and posts.
function setUpLiveServer() {
  var app = express();
  app.post('/comments', function (req, res) {
    res.json(responseJson);
  });
  return listen(app, LIVE_PORT);
}

function tearDownApp() {
  if (fs.existsSync(dir)) rmdirSync(dir);

  var closeApp = Promise.promisify(
    this.appServer.close.bind(this.appServer)
  );
  var closeLive = Promise.promisify(
    this.liveServer.close.bind(this.liveServer)
  );
  return Promise.all([closeApp(), closeLive()]);
}

function setUpApp(opts) {
  var app = express();
  this.postComments = new PostComments(app, opts);
  this.postComments.log = function () {};

  return listen(app, APP_PORT)
  .then(function (server) {
    this.appServer = server;
    return setUpLiveServer()
  }.bind(this))
  .then(function(server) {
    this.liveServer = server;
  }.bind(this));
}

describe('PostComments in existing-matchers mode', function () {
  beforeEach(function () {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    fs.writeFileSync(
      path.resolve(dir, 'comments_hello-world.json'), JSON.stringify(responseJson)
    );
    fs.writeFileSync(
      path.resolve(dir, 'postRequests.json'), JSON.stringify(postRequests)
    );
    return setUpApp.call(this, {});
  });

  afterEach(function () {
    return tearDownApp.call(this);
  });

  it('returns previously-saved stubs', function () {
    return request({
      uri: appUri + '/comments',
      json: true,
      method: 'POST',
      body: {hello: 'world'},
    })
    .then(function (actualJson) {
      expect(responseJson).to.deep.equal(actualJson);
    });
  });

  it('errors when matcher does not exist', function () {
    return request({
      uri: appUri + '/comments',
      json: true,
      method: 'POST',
      body: {hello: 'not the world'},
    })
    .then(function () {
      throw new Error('Expected an error response');
    })
    .catch(function (err) {
      if (!err.statusCode) throw err;
      expect(err.statusCode).to.equal(500);
    });
  });

  it('errors when matcher exists but stub file does not exist', function () {
    this.postComments.matchers.push({
      res: {
        filename: 'missing-file.json',
      },
      req: {
        path: '/comments',
        query: {},
        body: {hello: 'guys'},
      },
    });
    return request({
      uri: appUri + '/comments',
      json: true,
      method: 'POST',
      body: {hello: 'guys'},
    })
    .then(function () {
      throw new Error('Expected an error response');
    })
    .catch(function (err) {
      if (!err.statusCode) throw err;
      expect(err.statusCode).to.equal(500);
    });
  });
});

describe('PostComments in create-matchers mode', function () {
  describe('without existing matchers', function () {
    beforeEach(function () {
      return setUpApp.call(this, {liveSite: liveUri});
    });

    afterEach(function () {
      return tearDownApp.call(this);
    });

    it('saves and returns unrecognised responses', function () {
      return request({
        uri: appUri + '/comments',
        json: true,
        method: 'POST',
        body: {hello: 'world'},
      })
      .then(function (responseJson) {
        return readFile(path.resolve(dir, 'comments_hello-world.json'))
        .then(function(fileString) {
          var fileBody = JSON.parse(fileString);
          expect(fileBody).to.deep.equal(responseJson);
        });
      });
    });
  });

  describe('with existing matchers', function () {
    beforeEach(function () {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      this.alternateResponse = {different: 'response'};
      fs.writeFileSync(
        path.resolve(dir, 'comments_hello-world.json'),
        JSON.stringify(this.alternateResponse)
      );
      fs.writeFileSync(
        path.resolve(dir, 'postRequests.json'),
        JSON.stringify(postRequests)
      );
      return setUpApp.call(this, {liveSite: liveUri});
    });

    afterEach(function () {
      return tearDownApp.call(this);
    });

    it('returns previously-saved stubs', function () {
      return request({
        uri: appUri + '/comments',
        json: true,
        method: 'POST',
        body: {hello: 'world'},
      })
      .then(function (actualJson) {
        expect(actualJson).to.deep.equal(this.alternateResponse);
      }.bind(this));
    });
  });
});