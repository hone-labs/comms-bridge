import { CommsBridge, IMessage, IPackage, onIncomingMessageFn } from "../index";

describe("receiving", () => {

    it("can handle incoming message", () => {

        let messageReceived = false;
        const id = "my-instance-id";
        const messagePayload = {};
        const mockMessage: any = {            
            msg: {
                targetId: id,
                name: "an-event",
                payload: messagePayload,
            },
        };

        const commsBridge = new CommsBridge(id);
        commsBridge.respond("an-event", async (payload: any)=> {
            expect(payload).toEqual(messagePayload);
            messageReceived = true;
        });

        let incomingMessageHandler: onIncomingMessageFn | undefined = undefined;
        const mockIncoming: any = {
            connect: (handler: onIncomingMessageFn) => {
                incomingMessageHandler = handler;
            },
        };
        commsBridge.addIncoming("my-transport-id", mockIncoming);

        //
        // "Send" the message.
        //
        expect(incomingMessageHandler).toBeDefined();

        incomingMessageHandler!(mockMessage);

        //
        // Check the message was received by the handler.
        //
        expect(messageReceived).toEqual(true);
    });

    it("doesn't throw when no handler for a message is registered", () => {

        const id = "my-instance-id";
        const mockMessage: any = {            
            msg: {
                targetId: id,
                name: "an-event",
                payload: {},
            },
        };

        const commsBridge = new CommsBridge(id);

        let incomingMessageHandler: onIncomingMessageFn | undefined = undefined;
        const mockIncoming: any = {
            connect: (handler: onIncomingMessageFn) => {
                incomingMessageHandler = handler;
            },
        };
        commsBridge.addIncoming("my-transport-id", mockIncoming);

        //
        // "Send" the message.
        //
        expect(incomingMessageHandler).toBeDefined();
        incomingMessageHandler!(mockMessage);
    });

    it("incoming message is automatically forwarded when not targeted at the current instance", () => {

        let messageForwarded = false;
        const id = "my-instance-id";
        const messagePayload = {};
        const mockMessage: any = {
            msg: {            
                targetId: "some-other-instance-id",
                name: "an-event",
                payload: messagePayload,
            },
        };

        const commsBridge = new CommsBridge(id);

        let incomingMessageHandler: onIncomingMessageFn | undefined = undefined;
        const mockIncoming: any = {
            connect: (handler: onIncomingMessageFn) => {
                incomingMessageHandler = handler;
            },
        };
        commsBridge.addIncoming("incoming-id", mockIncoming);

        commsBridge.addOutgoing("outgoing-id", {
            send: (msg: IPackage) => {
                expect(msg).toBe(mockMessage);
                messageForwarded = true;
            },
        });

        incomingMessageHandler!(mockMessage);

        //
        // Check the message was forwarded to the output transport.
        //
        expect(messageForwarded).toEqual(true);        
    });

    it("sync result from the response handler sends a reply message", done => {

        let replySent = false;
        const id = "my-instance-id";
        const messagePayload = {};
        const mockMessage: any = {            
            msg: {
                targetId: id,
                name: "an-event",
                payload: messagePayload,
            },
        };
        const responseResult = {};

        const commsBridge = new CommsBridge(id);
        commsBridge.respond("an-event", (payload: any)=> {
            expect(payload).toEqual(messagePayload);
            return responseResult;
        });

        let incomingMessageHandler: onIncomingMessageFn | undefined = undefined;
        const mockIncoming: any = {
            connect: (handler: onIncomingMessageFn) => {
                incomingMessageHandler = handler;
            },
        };
        commsBridge.addIncoming("transport-id", mockIncoming);

        commsBridge.addOutgoing("transport-id", {
            send: (pkg: IPackage) => {
                expect(pkg.msg.payload).toEqual(responseResult);
                done(); // Finishes the test.
            },
        });

        incomingMessageHandler!(mockMessage);

        // Note the test is finished by the call to the `done` function.
    });

    it("async result from the response handler sends a reply message", done => {

        let replySent = false;
        const id = "my-instance-id";
        const messagePayload = {};
        const mockMessage: any = {            
            msg: {
                targetId: id,
                name: "an-event",
                payload: messagePayload,
            },
        };
        const responseResult = {};

        const commsBridge = new CommsBridge(id);
        commsBridge.respond("an-event", async (payload: any)=> {
            expect(payload).toEqual(messagePayload);
            return Promise.resolve(responseResult);
        });

        let incomingMessageHandler: onIncomingMessageFn | undefined = undefined;
        const mockIncoming: any = {
            connect: (handler: onIncomingMessageFn) => {
                incomingMessageHandler = handler;
            },
        };
        commsBridge.addIncoming("transport-id", mockIncoming);

        commsBridge.addOutgoing("transport-id", {
            send: (pkg: IPackage) => {
                expect(pkg.msg.payload).toEqual(responseResult);
                done(); // Finishes the test.
            },
        });

        incomingMessageHandler!(mockMessage);

        // Note the test is finished by the call to the `done` function.
    });

    it("can deregister an incoming transport", () => {

        let disconnectInvoked = false;
        const id = "my-instance-id";
        const transportId = "my-transport-id";
        const mockMessage: any = {            
            msg: {
                name: "an-event",
                payload: {},
            },
        };

        const commsBridge = new CommsBridge(id);
        commsBridge.respond("an-event", (payload: any)=> {
            return Promise.resolve({});
        });

        let incomingMessageHandler: onIncomingMessageFn | undefined = undefined;
        const mockIncoming: any = {
            connect: (handler: onIncomingMessageFn) => {
                incomingMessageHandler = handler;
            },
            disconnect: () => {
                disconnectInvoked = true;
            },
        };
        commsBridge.addIncoming(transportId, mockIncoming);

        // Handler added, this executes ok.
        incomingMessageHandler!(mockMessage);

        commsBridge.removeIncoming(transportId);

        //
        // Check that disconnect was called.
        //
        expect(disconnectInvoked).toEqual(true);

    });

    it("ignores the response when the target id doesn't match the instance id", async () => {

        let messageReceived = false;
        const mockMessage: any = {     
            msg: {
                targetId: "some-other-instance-id", // Targeting some other instance.
                name: "an-event",
                payload: {},
            },
        };

        const commsBridge = new CommsBridge("my-instance-id");
        commsBridge.respond("an-event", async msg => {
            // This won't be invoked in this test.
            messageReceived = true;
        });

        let incomingMessageHandler: onIncomingMessageFn | undefined = undefined;
        const mockIncoming: any = {
            connect: (handler: onIncomingMessageFn) => {
                incomingMessageHandler = handler;
            },
        };
        commsBridge.addIncoming("my-transport-id", mockIncoming);

        //
        // "Send" the message.
        //
        expect(incomingMessageHandler).toBeDefined();
        incomingMessageHandler!(mockMessage);

        //
        // Check the message wasn't received by the handler.
        //
        expect(messageReceived).toEqual(false);
    });    
});
