# gRPC Middleware

A library that allows easy implementation of gRPC middleware, for both pre-call, and post-call.

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

const serviceName = 'echo.EchoManager';

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
		server,
		[
			(call: GrpcCall) => AppLogger.logger.debug('Pre-call handler 1', call),
			(call: GrpcCall) => AppLogger.logger.debug('Pre-call handler 2', call)
		],
		[
			(error: grpc.ServiceError | null, call: GrpcCall) =>
				AppLogger.logger.debug('Post-call handler 1', call, error),
			(error: grpc.ServiceError | null, call: GrpcCall) =>
				AppLogger.logger.debug('Post-call handler 2', call, error)
		]
	);
	// Add gRPC services that you want the middleware to monitor
	grpcMiddleware.addService(EchoManagerService, { echo: this.doEcho });
	// Enable propagation of Jaeger tracing headers
	grpcMiddleware.enableTracing();

	// Bind and start the server
	server.bind('localhost:9090', grpc.ServerCredentials.createInsecure());
	server.start();

	return server;
}

start();
```
