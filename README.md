# Stubber
Stubber is an HTTP server designed for mocking out dependencies on live sites during test running. It's meant primarily for lightweight HTTP requests and JSON responses.

```
> $ ./start --help

  Usage: start [options] <port>

  Options:

    -h, --help        output usage information
    -V, --version     output the version number
    -s, --site <uri>  Generate stubs against a live site
    -v, --verbose
```

To start in standard mode on (e.g.) port 12345, run `node start.js 12345` or `./start 12345`. When a request is made against Stubber, it will check to see if the request matches one of its pre-saved requests. If it finds a match, it will dispense a saved matching response stub. If not, it will return a 500 error response to the client.

To start in stub-generation mode, run `./start --site <uri> 12345`. Again, if a request is made against Stubber, it will check its own saved requests files for a match. If it finds a match, it will return the saved matching response. If it does not find a match, it will continue to the live site, return the response to the client, and save the request and response stubs.

Stubber classes are defined by extending `BaseStubber`. An example `CommentsStubber` is included in the test suite. This test class has been trialled against [https://jsonplaceholder.typicode.com](https://jsonplaceholder.typicode.com).
