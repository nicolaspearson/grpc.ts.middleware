import * as grpc from '@grpc/grpc-js';

export type PreCallHandler = (call: GrpcCall) => void;
export type PostCallHandler = (err: grpc.ServiceError | null, call: GrpcCall) => void;

export type PreMiddleware = PreCallHandler[];
export type PostMiddleware = PostCallHandler[];

export type GrpcCall =
	| grpc.ServerUnaryCall<any, any>
	| grpc.ServerReadableStream<any, any>
	| grpc.ServerWritableStream<any, any>
	| grpc.ServerDuplexStream<any, any>;

export type GrpcCallHandler = (call: GrpcCall, callback: GrpcCallback) => void;

export type GrpcCallback = (
	error: grpc.ServiceError | null,
	value: any,
	trailer?: grpc.Metadata,
	flags?: number
) => void | undefined;

export interface GrpcImplementationType {
	[name: string]:
		| GrpcCallHandler
		| grpc.handleUnaryCall<any, any>
		| grpc.handleClientStreamingCall<any, any>
		| grpc.handleServerStreamingCall<any, any>
		| grpc.handleBidiStreamingCall<any, any>
		| any;
}

// B3 tracing headers used by Jaeger
export enum tracingHeaders {
	'x-forwarded-for',
	'x-forwarded-proto',
	'x-request-id',
	'x-envoy-internal',
	'x-b3-traceid',
	'x-b3-spanid',
	'x-b3-sampled',
}

export default class GrpcMiddleware {
	/**
	 * Constructs the gRPC middleware object
	 * @param server An instance of the gRPC server
	 * @param preCallHandler An array of functions to be invoked prior to the execution of the gRPC call
	 * @param postCallHandler An array of functions to be invoked after the gRPC call has been executed, but before returning the result
	 */
	constructor(server: grpc.Server, preMiddleware?: PreMiddleware, postMiddleware?: PostMiddleware);

	/**
	 * Add a service to the server, with a corresponding implementation, and optional middleware
	 * @param service The service descriptor
	 * @param implementation Map of method names to method implementation for the provided service.
	 * @param middleware middleware to be applied
	 */
	addService(
		service: grpc.ServiceDefinition<GrpcImplementationType>,
		implementation: GrpcImplementationType
	): void;

	/**
	 * Enables propagation of B3 tracing headers used by Jaeger
	 */
	enableTracing(): void;
}
