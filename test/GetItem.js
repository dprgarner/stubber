const sinon = require('sinon');
const expect = require('chai').expect;
const GetItem = require('../GetItem');

describe('GetItem', function () {
  beforeEach(function () {
    this.getItem = new GetItem({get: sinon.stub()}, {})
  });

  describe('getStubName', function () {
    it('appends each arg', function () {
      expect(this.getItem.getStubName({
        postId: '1',
      })).to.equal('comments_postId-1');
    });

    it('concatenates arrays', function () {
      expect(this.getItem.getStubName({
        postId: '1',
        fq: ['a', 'b'],
      })).to.equal('comments_postId-1_fq-a-b');
    });
  });
})
