# gRPC Middleware

[![Current Version](https://img.shields.io/npm/v/grpc-ts-middleware.svg)](https://www.npmjs.com/package/grpc-ts-middleware)

A library that assists with the implementation of gRPC pre-, and post-call middleware.

### Installation

```
npm install grpc-ts-middleware --save
```

### Dependencies

- [gRPC](https://www.npmjs.com/package/grpc): Node.js gRPC Library.

### Usage

```typescript
import * as grpc from 'grpc';
import GrpcMiddleware, { GrpcCall } from 'grpc-ts-middleware';

import { EchoReply, EchoRequest } from './proto/echo_pb';
import { EchoManagerService } from './proto/echo_grpc_pb';

function doEcho(call: grpc.ServerUnaryCall<EchoRequest>, callback: grpc.sendUnaryData<EchoReply>) {
	const reply = new EchoReply();
	reply.setMessage(call.request.getMessage());
	callback(null, reply);
}

function start(): grpc.Server {
	// Create the server
	const server: grpc.Server = new grpc.Server();

	// Create the middleware object
	const grpcMiddleware = new GrpcMiddleware(
		// An instance of the gRPC server
		server,
		// An array of functions to be invoked prior to the execution of the gRPC call
		[
			(call: GrpcCall) => console.log('Pre-call handler 1', call),
			(call: GrpcCall) => console.log('Pre-call handler 2', call)
		],
		// An array of functions to be invoked after the gRPC call has been executed, but before returning the result
		[
			(error: grpc.ServiceError | null, call: GrpcCall) =>
				console.log('Post-call handler 1', call, error),
			(error: grpc.ServiceError | null, call: GrpcCall) =>
				console.log('Post-call handler 2', call, error)
		]
	);
	// Add gRPC services that you want the middleware to monitor
	grpcMiddleware.addService(EchoManagerService, { echo: doEcho });
	// Enable propagation of Jaeger tracing headers
	grpcMiddleware.enableTracing();

	// Bind and start the server
	server.bind('localhost:9090', grpc.ServerCredentials.createInsecure());
	server.start();

	return server;
}

start();
```
