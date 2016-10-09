const fs = require('fs');
const path = require('path');

const expect = require('chai').expect;
const express = require('express');
const Promise = require('bluebird');
const request = require('request-promise');
const rmdirSync = require('rimraf').sync;

const BaseStubber = require('../BaseStubber');
const CommentsStubber = BaseStubber.extend({
  responsesDir: path.resolve(__dirname, 'comments'),
  matchersFile: path.resolve(__dirname, 'comments', 'requests.json'),
});

const readFile = Promise.promisify(fs.readFile);
const writeFile = Promise.promisify(fs.writeFile);

const dir = path.resolve(__dirname, 'comments');
const APP_PORT = 3005;
const LIVE_PORT = 3006;
const HOSTNAME = 'http://' + (process.env.HOSTNAME || 'localhost');
const appUri = HOSTNAME + ':' + APP_PORT;
const liveUri = HOSTNAME + ':' + LIVE_PORT;

var requests = [
  {
    req: {
      method: 'GET',
      path: '/comments',
      query: {postId: '1'},
    },
    res: {
      filename: 'comments_postId-1.json',
      statusCode: 200,
    },
  },
  {
    req: {
      method: 'GET',
      path: '/comments',
      query: {postId: '2'},
    },
    res: {
      filename: 'comments_postId-2.json',
      statusCode: 200,
    },
  },
  {
    req: {
      method: 'POST',
      path: '/comments',
      query: {},
      body: {hello: 'world'},
    },
    res: {
      filename: 'comments_hello-world.json',
      statusCode: 201,
    },
  }
];

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
  app.get('/comments', function (req, res) {
    res.json(responseJson);
  });
  app.post('/comments', function (req, res) {
    res.status(201).json(responseJson);
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
  this.commentsStubber = new CommentsStubber(app, opts);
  this.commentsStubber.log = function () {};

  return listen(app, APP_PORT)
  .then(function (server) {
    this.appServer = server;
    return setUpLiveServer();
  }.bind(this))
  .then(function(server) {
    this.liveServer = server;
    this.liveServer.setTimeout(500);
  }.bind(this));
}

describe('CommentsStubber in existing-matchers mode', function () {
  beforeEach(function () {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    fs.writeFileSync(
      path.resolve(dir, 'requests.json'), JSON.stringify(requests)
    );
    fs.writeFileSync(
      path.resolve(dir, 'comments_postId-1.json'), JSON.stringify(responseJson)
    );
    fs.writeFileSync(
      path.resolve(dir, 'comments_hello-world.json'), JSON.stringify(responseJson)
    );
    return setUpApp.call(this, {});
  });

  afterEach(function () {
    return tearDownApp.call(this);
  });

  describe('GET', function () {
    it('returns previously-saved stubs', function () {
      return request({
        uri: appUri + '/comments?postId=1',
        json: true,
      })
      .then(function (actualJson) {
        expect(responseJson).to.deep.equal(actualJson);
      });
    });

    it('errors when matcher does not exist', function () {
      return request({
        uri: appUri + '/comments?postId=3',
        json: true,
      })
      .then(function () {
        throw new Error('Expected an error response');
      })
      .catch(function (err) {
        if (!err.statusCode) throw err;
        expect(err.statusCode).to.equal(500);
      });
    });

    it('records all requests made', function () {
      return request({
        uri: appUri + '/comments?postId=1',
        json: true,
      })
      .then(function () {
        expect(this.commentsStubber.requestsMade).to.deep.equal({
          'comments_hello-world.json': false,
          'comments_postId-1.json': true,
          'comments_postId-2.json': false,
        });
      }.bind(this));
    });

    it('shortens long names', function () {
      var longName = [
        'aaaaaaaaaaaaaaaa1111111111111111',
        'aaaaaaaaaaaaaaaa1111111111111111',
        'aaaaaaaaaaaaaaaa1111111111111111',
        'aaaaaaaaaaaaaaaa1111111111111111',
        'b',
      ].join('');
      var name = this.commentsStubber.shortenAndMakeUnique(longName);
      expect(name).to.have.length(128).and.to.not.equal(longName);
    });

    it('makes names unique', function () {
      var name = this.commentsStubber.shortenAndMakeUnique('comments_postId-1');
      expect(name).to.not.equal('comments_postId-1');
    });
  });

  describe('POST', function () {
    it('returns previously-saved stubs and status codes', function () {
      return request({
        uri: appUri + '/comments',
        json: true,
        method: 'POST',
        body: {hello: 'world'},
        resolveWithFullResponse: true,
      })
      .then(function (res) {
        expect(res.body).to.deep.equal(responseJson);
        expect(res.statusCode).to.equal(201);
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
      this.commentsStubber.matchers.push({
        req: {
          path: '/comments',
          query: {},
          body: {hello: 'guys'},
        },
        res: {
          filename: 'missing-file.json',
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
});

describe('CommentsStubber in create-matchers mode', function () {
  describe('without existing matchers', function () {
    beforeEach(function () {
      return setUpApp.call(this, {liveSite: liveUri});
    });

    afterEach(function () {
      return tearDownApp.call(this);
    });

    describe('GET', function () {
      it('saves and returns unrecognised responses', function () {
        return request({
          uri: appUri + '/comments?postId=1',
          json: true,
        })
        .then(function (responseJson) {
          return readFile(path.resolve(dir, 'comments_postId-1.json'))
          .then(function(fileString) {
            var fileBody = JSON.parse(fileString);
            expect(fileBody).to.deep.equal(responseJson);
          });
        });
      });
    });

    describe('POST', function () {
      it('saves and returns unrecognised responses', function () {
        return request({
          uri: appUri + '/comments',
          json: true,
          method: 'POST',
          body: {hello: 'world'},
          resolveWithFullResponse: true,
        })
        .then(function (res) {
          return readFile(path.resolve(dir, 'comments_hello-world.json'))
          .then(function(fileString) {
            var fileBody = JSON.parse(fileString);
            expect(res.body).to.deep.equal(fileBody);
            expect(res.statusCode).to.equal(201);
          });
        });
      });

      it('creates new matchers', function () {
        var initialLength = this.commentsStubber.matchers.length;
        return request({
          uri: appUri + '/comments',
          json: true,
          method: 'POST',
          body: {hello: 'world'},
        })
        .then(function () {
          var matchers = this.commentsStubber.matchers;
          expect(matchers).to.have.length(initialLength + 1);
          expect(matchers[initialLength]).to.deep.equal({
            req: {
              method: 'POST',
              path: '/comments',
              query: {},
              body: {hello: 'world'},
            },
            res: {
              filename: 'comments_hello-world.json',
              statusCode: 201,
            },
          });
        }.bind(this));
      });
    });
  });

  describe('with existing matchers', function () {
    beforeEach(function () {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      this.alternateResponse = {different: 'response'};
      fs.writeFileSync(
        path.resolve(dir, 'comments_postId-1.json'),
        JSON.stringify(this.alternateResponse)
      );
      fs.writeFileSync(
        path.resolve(dir, 'comments_hello-world.json'),
        JSON.stringify(this.alternateResponse)
      );
      fs.writeFileSync(
        path.resolve(dir, 'requests.json'),
        JSON.stringify(requests)
      );
      return setUpApp.call(this, {liveSite: liveUri});
    });

    afterEach(function () {
      return tearDownApp.call(this);
    });

    describe('GET', function () {
      it('returns previously-saved stubs', function () {
        return request({
          uri: appUri + '/comments?postId=1',
          json: true,
        })
        .then(function (actualJson) {
          expect(actualJson).to.deep.equal(this.alternateResponse);
        }.bind(this));
      });

      it('errors if the new matcher does not match the request', function () {
        this.commentsStubber.createMatcher = function () {
          return {req: {bad: 'matcher'}, res: {filename: 'comments_postId-1.json'}};
        };
        return request({
          uri: appUri + '/comments?postId=3',
          json: true,
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

    describe('POST', function () {
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
});
