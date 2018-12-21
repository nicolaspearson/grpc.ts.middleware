import * as grpc from 'grpc';

export type PreCallHandler = (call: GrpcCall) => void;
export type PostCallHandler = (err: grpc.ServiceError | null, call: GrpcCall) => void;

export type PreMiddleware = PreCallHandler[];
export type PostMiddleware = PostCallHandler[];

export type GrpcCall =
	| grpc.ServerUnaryCall<any>
	| grpc.ServerReadableStream<any>
	| grpc.ServerWriteableStream<any>
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
	'x-b3-sampled'
}

export default class GrpcMiddleware {
	private tracingEnabled?: boolean;

	/**
	 * Constructs the gRPC middleware object
	 * @param server An instance of the gRPC server
	 * @param preCallHandler An array of functions to be invoked prior to the execution of the gRPC call
	 * @param postCallHandler An array of functions to be invoked after the gRPC call has been executed, but before returning the result
	 */
	constructor(
		private server: grpc.Server,
		private preMiddleware?: PreMiddleware,
		private postMiddleware?: PostMiddleware
	) {
		// Empty
	}

	/**
	 * Add a service to the server, with a corresponding implementation, and optional middleware
	 * @param service The service descriptor
	 * @param implementation Map of method names to method implementation for the provided service.
	 * @param middleware middleware to be applied
	 */
	public addService(
		service: grpc.ServiceDefinition<GrpcImplementationType>,
		implementation: GrpcImplementationType
	): void {
		const proxyImplementation: GrpcImplementationType = {};
		for (const key in implementation) {
			proxyImplementation[key] = (call: GrpcCall, callback: GrpcCallback) => {
				this.proxyCall(call, callback, implementation[key]);
			};
		}
		this.server.addService(service, proxyImplementation);
	}

	/**
	 * Proxies the gRPC call, and executes all configured middleware
	 * @param call The gRPC call, e.g. ServerUnaryCall<RequestType>, ServerReadableStream<RequestType>, etc
	 * @param callback The gRPC callback function
	 * @param implementationCallHandler The service implementation's call handler function
	 * @param middlewareHandler middleware handler function to be executed
	 */
	private proxyCall(
		call: GrpcCall,
		callback: GrpcCallback,
		implementationCallHandler: GrpcCallHandler
	) {
		let postCallInvoked = false;
		try {
			// Execute pre-call middleware
			if (this.preMiddleware) {
				for (const middleware of this.preMiddleware) {
					middleware(call);
				}
			}
			// Execute call
			implementationCallHandler(
				call,
				(error: grpc.ServiceError | null, value: any, trailer?: grpc.Metadata, flags?: number) => {
					// Execute post-call middleware
					postCallInvoked = true;
					this.postCall(call, callback, error, value, trailer, flags);
				}
			);
		} catch (error) {
			// Execute post-call middleware, if not previously been invoked
			if (!postCallInvoked) {
				this.postCall(call, callback, error, null);
			}
		}
	}

	/**
	 * Executes post call functions, i.e. after the gRPC call has been
	 * executed this method is invoked to execute post call middleware
	 * @param call The gRPC call, e.g. ServerUnaryCall<RequestType>, ServerReadableStream<RequestType>, etc
	 * @param callback The gRPC callback function
	 * @param error gRPC call execution errors
	 * @param value gRPC call execution value
	 * @param trailer gRPC call execution trailer metadata
	 * @param flags gRPC call execution flags
	 */
	private postCall(
		call: GrpcCall,
		callback: GrpcCallback,
		error: grpc.ServiceError | null,
		value: any,
		trailer?: grpc.Metadata,
		flags?: number
	) {
		if (this.postMiddleware) {
			for (const middleware of this.postMiddleware) {
				middleware(error, call);
			}
		}
		if (this.tracingEnabled) {
			this.propagateTracingHeaders(call);
		}
		if (callback) {
			callback(error, value, trailer, flags);
		}
	}

	/**
	 * Enables propagation of B3 tracing headers used by Jaeger
	 */
	public enableTracing() {
		this.tracingEnabled = true;
	}

	/**
	 * Propagate B3 tracing headers used by Jaeger
	 * @param call The gRPC call, e.g. ServerUnaryCall<RequestType>, ServerReadableStream<RequestType>, etc
	 */
	private propagateTracingHeaders(call: GrpcCall) {
		try {
			if (call && call.metadata) {
				const metadata = call.metadata as grpc.Metadata;
				if (metadata) {
					const newMetadata = new grpc.Metadata();
					for (const key in metadata.getMap()) {
						const foundHeader = Object.keys(tracingHeaders).filter(
							(header: string) => header === key
						);
						if (foundHeader && foundHeader.length >= 1) {
							newMetadata.set(key, metadata.get(key)[0]);
						}
					}
					call.sendMetadata(newMetadata);
				}
			}
		} catch (error) {
			// Suppress
		}
	}
}
