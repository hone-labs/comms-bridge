//
// Implements a message routing system with pluggable incoming and outgoing transports.
//

//
// Defines the structure of a message.
//
export interface IMessage<PayloadT = any> {

    //
    // Set to target the message at a particular outgoing transport.
    //
    transportId?: string;

    //
    // The target of the message.
    //
    targetId: string;

    //
    // Message name.
    //
    name?: string;

    //
    // The payload of the message.
    //
    payload?: PayloadT;

}

//
// "Packages" a message in a structure so that internal details (like id and replyId) don't get unecessarily leaked to users of this library.
//
export interface IPackage<PayloadT = any> {
    //
    // The ID of the message, attached by the comms bridge.
    //
    id?: number;

    //
    // Only set when the message is a reply to another message that is requiring resolution.
    //
    replyId?: number;

    //
    // The sender of the message.
    //
    senderId?: string;

    //
    // The id of the instance that last forwarded the message.
    //
    forwarderId?: string;

    //
    // The wrapped message.
    //
    msg: IMessage<PayloadT>;
}

//
// Defines a handler for messages incoming from a transport.
//
export type onIncomingMessageFn = (pkg: IPackage) => void;

//
// Allows new types of network transports for incoming message to be plugged into 
// the communications bridge.
//
export interface IIncomingTransport {

    //
    // Connect to the transport and start listening to messages.
    //
    connect(onIncomingMessage: onIncomingMessageFn): void;

    //
    // Disconnect from the transport.
    //
    disconnect(): void;
}

//
// Allows new types of network transports for outgoing message to be plugged into 
// the communications bridge.
//
export interface IOutgoingTransport {

    //
    // Plugin function to send a message.
    //
    send<PayloadT = any>(pkg: IPackage<PayloadT>, options?: ISendOptions): void;
}

export type RespondHandlerFn<PayloadT = any, ResultT = any> = (msg: IMessage<PayloadT>) => void | ResultT | Promise<void | ResultT>;

//
// Options supplied when sending a message.
//
export interface ISendOptions {
    //
    // Set to true (default is false) to await the response to the message before resolving the promise.
    //
    awaitReply?: boolean;

    //
    // Time to wait before giving up on a response.
    //
    timeout?: number;
}

//
// Tracks a response that is pending a message.
//
interface IPendingResponse {

    //
    // The timeout that will expire and reject the promise associated with this response.
    //
    timeout: NodeJS.Timeout;

    //
    // Resolves the promise that is waiting for the response.
    //
    resolve: (value: any | PromiseLike<any>) => void;        
}

export interface ICommsBridge {

    //
    // Register a handler to incoming messages that are targeted at
    // this instance.
    //
    respond<PayloadT = any, ResultT = any>(messageName: string, handlerFn: RespondHandlerFn<PayloadT, ResultT>): void;

    //
    // Sends a message to a target instance that was previously registered.
    //
    send<PayloadT = any, ResultT = any>(msg: IMessage<PayloadT>, options?: ISendOptions): Promise<ResultT | undefined>;

    //
    // Adds an incoming message transport to the bridge.
    // Messages incoming on this transport will be handled, routed or ignored by this instance.
    //
    addIncoming(id: string, incomingTransport: IIncomingTransport): void;

    //
    // Remove an incoming transport.
    //
    removeIncoming(id: string): void;

    //
    // Adds an outgoing message transport to the bridge.
    // Messages sent from this instance can be targeted at outgoing channels.
    // Message received to this instance can be automatically routed to outgoing channels.
    //
    addOutgoing(id: string, outgoingTransparent: IOutgoingTransport): void;

    //
    // Removes an outgoing transport.
    //
    removeOutgoing(id: string): void;
}

export class CommsBridge implements ICommsBridge {

    // 
    // The ID of this "message hub".
    // Allows messages to target this instance.
    //
    private readonly id: string;

    //
    // Id of the next message.
    //
    private nextId = 1;

    //
    // Lookup table for handlers.
    //
    private responseHandlers = new Map<string, RespondHandlerFn>();

    //
    // Lookup table for incoming network transports.
    //
    private incoming = new Map<string, IIncomingTransport>();

    //
    // Lookup table for outgoing network transports.
    //
    private outgoing = new Map<string, IOutgoingTransport>();

    //
    // Responses that are currently being awaited for resolution at this end point.
    //
    private readonly pendingResponses = new Map<number, IPendingResponse>();

    //
    // The default amount of time to wait before giving up on a response to a message.
    //
    private readonly defaultTimeout = 5000;

    constructor(id: string) {
        this.id = id;
    }

    //
    // Register a handler to incoming messages that are targeted at
    // this instance.
    //
    respond<PayloadT = any, ResultT = any>(messageName: string, handlerFn: RespondHandlerFn<PayloadT, ResultT>): void {
        this.responseHandlers.set(messageName, handlerFn);        
    }

    //
    // Sends a message to a target instance that was previously registered.
    //
    send<PayloadT = any, ResultT = any>(msg: IMessage<PayloadT>, options?: ISendOptions): Promise<ResultT | undefined> {

        if (msg.transportId) {
            console.log(`[${this.id}]: Sending message to ${msg.targetId} via outgoing transport ${msg.transportId}`);
        }
        else {
            console.log(`[${this.id}]: Sending message to ${msg.targetId}`);
        }

        if (this.outgoing.size === 0)  {
            return Promise.reject(new Error(`[${this.id}]: No output transport has been registered.`));
        }
        
        const wrappedMessage = {
            id: this.nextId++,              // Auto tag with next message id.
            senderId: this.id,              // Auto tag with sender id.
            msg: msg,
        };

        if (options?.awaitReply) {
            console.log(`[${this.id}]: Awaiting a reply for message ${wrappedMessage.id}.`);

            return new Promise<ResultT>((resolve, reject) => {
                // Set a timeout if a response is not received
                const timeout = setTimeout(() => {
                    const req = this.pendingResponses.get(wrappedMessage.id!);
                    if (req) {
                        this.pendingResponses.delete(wrappedMessage.id!);
    
                        reject(new Error(`[${this.id}]: Timeout expired waiting for response to message ${wrappedMessage.id}.`));
                    }
                }, options?.timeout || this.defaultTimeout);
    
                this.pendingResponses.set(wrappedMessage.id!, {
                    timeout,
                    resolve
                });

                this._send(wrappedMessage);
            });
        }
        else {
            this._send(wrappedMessage);
            return Promise.resolve(undefined);
        }
    }

    //
    // Internal send function to reduce duplicated code.
    //
    private _send(pkg: IPackage) {

        if (pkg.msg.transportId) {
            //
            // Send to via a particular outgoing transport.
            // This is important for replies where sending to one "party" is 
            // way more efficient than broadcasting to all "parties".
            //
            const outgoingTransport = this.outgoing.get(pkg.msg.transportId);
            if (!outgoingTransport) {
                throw new Error(`[${this.id}]: Outgoing transport "${pkg.msg.transportId}" referenced by msg ${pkg.id} not found, you may need to add it.`);
            }
            else {
                outgoingTransport.send(pkg);
            }
        }
        else {
            //
            // Broadcast across all outgoing transports.
            //
            for (const outgoingTransport of this.outgoing.values()) {
                outgoingTransport.send(pkg);
            }
        }
    }

    //
    // Handles incoming messages from incoming transports.
    //
    private handleIncomingMessage(incomingTransportId: string, pkg: IPackage): void {
        // console.log(`[${this.id}]: Incoming message on comms bridge from ${incomingTransportId}:`);
        // console.log(msg);

        if (pkg.forwarderId === this.id) {
            //
            // We already forwarded this message, just ignore it.
            //
            return;
        }
        
        if (pkg.senderId === this.id) {
            //
            // We sent this message, just ignore it.
            //
            return;
        }
        
        if (pkg.msg.targetId !== this.id) {
            //
            // Forwards messages that are not intended for this instance.
            //

            console.log(`[${this.id}]: Forwarding message to ${pkg.msg.targetId}`);

            if (this.outgoing.size === 0)  {
                console.error(`[${this.id}]: No output transport has been registered.`);
            }
    
            //
            // Stamp it with our id, to avoid double handling.
            //
            pkg.forwarderId = this.id; 

            for (const outgoingTransport of this.outgoing.values()) {
                outgoingTransport.send(pkg);                    
            }    

            return;
        }

        if (pkg.replyId !== undefined) {
            // 
            // Processes a reply to a message.
            // 
            const pending = this.pendingResponses.get(pkg.replyId);
            if (pending) {
                console.log(`[${this.id}]: Found message ${pkg.replyId} awaiting reply, resolving it.`);

                clearTimeout(pending.timeout);

                this.pendingResponses.delete(pkg.replyId);

                //
                // Delivers the response payload to the caller of the "send" function.
                //
                pending.resolve(pkg.msg.payload); 
            }
            else {
                console.log(`[${this.id}]: No messsage be waited on for ${pkg.replyId}.`);
            }

            return;
        }

        if (!pkg.msg.name) {
            console.error(`[${this.id}]: Name is not set for this message, unable to handle it.`);
            return;
        }

        const responseHandler = this.responseHandlers.get(pkg.msg.name);
        if (responseHandler) { 
            // console.log(`[${this.id}]: Invoking handler for "${msg.name}"`);

            //
            // Delivers the payload to the handler function registered with "respond".
            //
            let result: any;
            try {
                result = responseHandler(pkg.msg.payload); 
            }
            catch (err: any) {
                console.error(`[${this.id}]: Failed running synchronous response handler "${pkg.msg.name}":`);
                console.error(err && err.stack || err);
            }

            if (result) {
                if (result.then) {
                    //
                    // Assume the result of the handler is a promise.
                    //
                    result
                        .catch((err: any) => {
                            console.error(`[${this.id}]: Failed running asynchronous response handler "${pkg.msg.name}":`);
                            console.error(err && err.stack || err);
                        })
                        .then((asyncResult: any) => {
                            if (asyncResult) {
                                //
                                // The handler returned an asynchronous result that can be returned as a reply.
                                //
                                // So make a reply to the message:
                                //
                                this._send({
                                    id: this.nextId++,
                                    senderId: this.id,
                                    replyId: pkg.id,
                                    msg: {
                                        transportId: incomingTransportId,
                                        targetId: pkg.senderId!,
                                        payload: asyncResult,
                                    },
                                });
                            }
                        })
                        .catch((err: any) => {
                            console.error(`[${this.id}]: Failed sending reply to message "${pkg.id}":`);
                            console.error(err && err.stack || err);
                        });
                }
                else {
                    //
                    // The handler returned an synchronous result that can be returned as a reply.
                    //
                    // So make a reply to the message:
                    //
                    this._send({
                        id: this.nextId++,
                        senderId: this.id,
                        replyId: pkg.id,
                        msg: {
                            transportId: incomingTransportId,
                            targetId: pkg.senderId!,
                            payload: result,
                        },
                    });
                }
            }
        }
        else {
            console.error(`[${this.id}]: No response handler defined for message: ${pkg.msg.name}`);
        }        
    }

    //
    // Adds an incoming message transport to the bridge.
    // Messages incoming on this transport will be handled, routed or ignored by this instance.
    //
    addIncoming(id: string, incomingTransport: IIncomingTransport): void {

        incomingTransport.connect(msg => this.handleIncomingMessage(id, msg));

        this.incoming.set(id, incomingTransport);

        console.log(`[${this.id}]: Registered incoming transport with id "${id}".`);
    }

    //
    // Remove an incoming transport.
    //
    removeIncoming(id: string): void {
        const transport = this.incoming.get(id);
        if (transport) {
            transport.disconnect();
        }

        this.incoming.delete(id);
    }

    //
    // Adds an outgoing message transport to the bridge.
    // Messages sent from this instance can be targeted at outgoing channels.
    // Message received to this instance can be automatically routed to outgoing channels.
    //
    addOutgoing(id: string, outgoingTransport: IOutgoingTransport): void {
        this.outgoing.set(id, outgoingTransport);        

        console.log(`[${this.id}]: Registered outgoing transport with id "${id}".`);
    }

    //
    // Removes an outgoing transport.
    //
    removeOutgoing(id: string): void {
        this.outgoing.delete(id);
    }
}