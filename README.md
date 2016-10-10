# Stubber
Stubber is an HTTP server designed for mocking out dependencies on live sites during test running. It's meant primarily for lightweight HTTP requests and JSON responses.

```
> $ node index.js --help

  Usage: index [options]

  Options:

    -h, --help        output usage information
    -V, --version     output the version number
    -p, --port <n>    Port number. Defaults to a random int between 58000-59999
    -s, --site <uri>  Generate stubs against a live site
    -v, --verbose
```

To start in standard mode, run `node index.js` or `npm start`. When a request is made against Stubber, it will check to see if the request matches one of its pre-saved requests. If it finds a match, it will dispense a saved matching response stub. If not, it will return a 500 error response to the client.

To start in stub-generation mode, run `node index.js -- --site <uri>`. Again, if a request is made against Stubber, it will check its own saved requests files for a match. If it finds a match, it will return the saved matching response. If it does not find a match, it will continue to the live site, return the response to the client, and save the request and response stubs.

Stubber classes are defined by extending `BaseStubber`. An example `CommentsStubber` is included in the test suite. This test class has been trialled against [https://jsonplaceholder.typicode.com](https://jsonplaceholder.typicode.com).