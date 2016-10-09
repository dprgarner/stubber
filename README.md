# Stubber
Stubber is an HTTP server designed for mocking out dependencies on live sites during test running. It's meant primarily for lightweight HTTP requests and JSON responses.

```
$ npm start -- --help

> stubber@0.0.1 start C:\Users\David\Documents\Code\stubber
> node index.js "--help"


  Usage: index [options]

  Options:

    -h, --help        output usage information
    -V, --version     output the version number
    -s, --site <uri>  Generate stubs against a live site
    -p, --port <n>    Port number. Defaults to a random int between 58000-59999
```

To start in standard mode, run `node index.js` or `npm start`. When a request is made against Stubber, it will check to see if the request matches one of its pre-saved requests. If it finds a match, it will dispense a saved matching response stub. If not, it will return a 500 error response to the client.

To start in stub-generation mode, run `node index.js -- --site <uri>`. Again, if a request is made against Stubber, it will check its own saved requests files for a match. If it finds a match, it will return the saved matching response. If it does not find a match, it will continue to the live site, return the response to the client, and save the request and response stubs.

Stubber classes are defined by extending `BaseStubber`, see e.g. `GetComments` and `PostComments` in the test suite. These test classes have been trialled against [https://jsonplaceholder.typicode.com](https://jsonplaceholder.typicode.com).

On a clean close, the Stubber will (hopefully) output the matched and unmatched saved requests made during the run.

--------
TODO:

- Signals aren't being matched
- test_signals
- test_search_box_market_size
- test_market_size_block

- Do this as responses data should not be on Github https://help.github.com/articles/remove-sensitive-data/
