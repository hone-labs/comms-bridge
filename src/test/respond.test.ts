import { CommsBridge } from "../index";

describe("receiving", () => {

    it("can handle incoming message", async () => {

        let messageReceived = false;
        const id = "my-instance-id";
        const messagePayload = {};
        const mockMessage: any = {            
            targetId: id,
            name: "an-event",
            payload: messagePayload,
        };

        const commsBridge = new CommsBridge(id);
        commsBridge.respond("an-event", async (payload: any)=> {
            expect(payload).toEqual(messagePayload);
            messageReceived = true;
        });

        let incomingMessageHandler: any = undefined;
        const mockIncoming: any = {
            connect: (handler: any) => {
                incomingMessageHandler = handler;
            },
        };
        commsBridge.addIncoming("my-transport-id", mockIncoming);

        //
        // "Send" the message.
        //
        expect(incomingMessageHandler).toBeDefined();

        await incomingMessageHandler(mockMessage);

        //
        // Check the message was received by the handler.
        //
        expect(messageReceived).toEqual(true);
    });

    it("doesn't throw when no handler for a message is registered", async () => {

        const id = "my-instance-id";
        const mockMessage: any = {            
            targetId: id,
            name: "an-event",
            payload: {},
        };

        const commsBridge = new CommsBridge(id);

        let incomingMessageHandler: any = undefined;
        const mockIncoming: any = {
            connect: (handler: any) => {
                incomingMessageHandler = handler;
            },
        };
        commsBridge.addIncoming("my-transport-id", mockIncoming);

        //
        // "Send" the message.
        //
        expect(incomingMessageHandler).toBeDefined();
        await incomingMessageHandler(mockMessage);
    });

    //
    // TODO: This should be the test that sends a reply.
    //       Also need a variant for a sync result.
    //
    // it("respond handler can return an async result", async () => {

    //     const id = "my-instance-id";
    //     const mockMessage: any = {   
    //         targetId: id,         
    //         name: "an-event",
    //         payload: {},
    //     };
    //     const expectedResult = [1, 2, 3];

    //     const commsBridge = new CommsBridge(id);
    //     commsBridge.respond("an-event", (payload: any) => {
    //         return Promise.resolve(expectedResult);
    //     });

    //     let incomingMessageHandler: any = undefined;
    //     const mockIncoming: any = {
    //         connect: (handler: any) => {
    //             incomingMessageHandler = handler;
    //         },
    //     };
    //     commsBridge.addIncoming("my-transport-id", mockIncoming);

    //     //
    //     // Handle the message and await the result.
    //     //
    //     const result = await incomingMessageHandler(mockMessage);

    //     //
    //     // Check the message was received by the handler.
    //     //
    //     expect(result).toEqual(expectedResult);
    // });    

    it("can deregister an incoming transport", async () => {

        let disconnectInvoked = false;
        const id = "my-instance-id";
        const transportId = "my-transport-id";
        const mockMessage: any = {            
            name: "an-event",
            payload: {},
        };

        const commsBridge = new CommsBridge(id);
        commsBridge.respond("an-event", (payload: any)=> {
            return Promise.resolve({});
        });

        let incomingMessageHandler: any = undefined;
        const mockIncoming: any = {
            connect: (handler: any) => {
                incomingMessageHandler = handler;
            },
            disconnect: () => {
                disconnectInvoked = true;
            },
        };
        commsBridge.addIncoming(transportId, mockIncoming);

        // Handler added, this executes ok.
        await incomingMessageHandler(mockMessage);

        commsBridge.removeIncoming(transportId);

        //
        // Check that disconnect was called.
        //
        expect(disconnectInvoked).toEqual(true);

    });

    it("ignores the response when the target id doesn't match the instance id", async () => {

        let messageReceived = false;
        const mockMessage: any = {     
            targetId: "some-other-instance-id", // Targeting some other instance.
            name: "an-event",
            payload: {},
        };

        const commsBridge = new CommsBridge("my-instance-id");
        commsBridge.respond("an-event", async msg => {
            // This won't be invoked in this test.
            messageReceived = true;
        });

        let incomingMessageHandler: any = undefined;
        const mockIncoming: any = {
            connect: (handler: any) => {
                incomingMessageHandler = handler;
            },
        };
        commsBridge.addIncoming("my-transport-id", mockIncoming);

        //
        // "Send" the message.
        //
        expect(incomingMessageHandler).toBeDefined();
        await incomingMessageHandler(mockMessage);

        //
        // Check the message wasn't received by the handler.
        //
        expect(messageReceived).toEqual(false);
    });    
});
