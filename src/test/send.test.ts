import { CommsBridge, IMessage, onIncomingMessageFn } from "../index";

describe("sending", () => {

    it("can send outgoing message", async () => {

        let messageSent = false;
        const instanceId = "this-is-me";
        const outgoingId = "this-is-someone-else";
        const messageName = "some-kind-of-message";
        const messagePayload = {};

        const commsBridge = new CommsBridge(instanceId);

        const mockOutgoing: any = {
            send: (msg: IMessage) => {
                expect(msg.name).toEqual(messageName);
                expect(msg.senderId).toEqual(instanceId);
                messageSent = true;
            },
        };
        commsBridge.addOutgoing(outgoingId, mockOutgoing);

        await commsBridge.send({
            senderId: "this-gets-overwritten",
            targetId: outgoingId, 
            name: messageName, 
            payload: messagePayload
        });

        expect(messageSent).toEqual(true);
    });

    it("can recieve reply from message sent", async () => {

        const instanceId = "this-is-me";
        const replyPayload = {};

        const commsBridge = new CommsBridge(instanceId);

        let incomingMessageHandler: onIncomingMessageFn | undefined = undefined;
        const mockOutgoing: any = {
            send: (msg: IMessage) => {
                //
                // Simulate a reply coming back.
                //
                incomingMessageHandler!({
                    targetId: instanceId,
                    replyId: msg.id,
                    payload: replyPayload,
                });
            },
        };
        commsBridge.addOutgoing("my-outgoing-id", mockOutgoing);

        const mockIncoming: any = {
            connect: (handler: onIncomingMessageFn) => {
                incomingMessageHandler = handler;
            },
        };
        commsBridge.addIncoming("my-incoming-id", mockIncoming);

        const replyResult = await commsBridge.send(
            {
                targetId: "this-is-someone-else", 
            },
            {
                awaitReply: true,
            }
        );

        expect(replyResult).toBe(replyPayload);
    });

    it("send message times out when reply is not received", async () => {

        const instanceId = "this-is-me";

        const commsBridge = new CommsBridge(instanceId);

        let incomingMessageHandler: onIncomingMessageFn | undefined = undefined;
        const mockOutgoing: any = {
            send: (msg: IMessage) => {
                // Don't reply to message... let the timeout be invoked.
            },
        };
        commsBridge.addOutgoing("my-outgoing-id", mockOutgoing);

        await expect(() => commsBridge.send(
                {
                    targetId: "this-is-someone-else", 
                },
                {
                    awaitReply: true,
                    timeout: 1,
                }
            ))
            .rejects
            .toThrow();
    });

    it("throws when outgoing transport is not registered", async () => {

        const instanceId = "this-is-me";
        const outgoingId = "this-is-someone-else";
        const messageName = "some-kind-of-message";
        const messagePayload = {};

        const commsBridge = new CommsBridge(instanceId);

        await expect(() => 
                commsBridge.send({ targetId: outgoingId, name: messageName, payload: messagePayload })
            )
            .rejects.toThrow();
    });

    it("can deregister an outgoing transport", async () => {

        const instanceId = "this-is-me";
        const outgoingId = "this-is-someone-else";
        const messageName = "some-kind-of-message";
        const messagePayload = {};
        const expectedResult = [1, 2, 3];

        const commsBridge = new CommsBridge(instanceId);

        const mockOutgoing: any = {
            send: (msg: IMessage) => {
                return Promise.resolve(expectedResult);
            },
        };
        commsBridge.addOutgoing(outgoingId, mockOutgoing);

        // Works fine.
        await commsBridge.send({ 
            targetId: outgoingId, 
            name: messageName, 
            payload: messagePayload
        });

        commsBridge.removeOutgoing(outgoingId);

        // Throws now.
        await expect(() => 
                commsBridge.send({ targetId: outgoingId, name: messageName, payload: messagePayload })
            )
            .rejects.toThrow();
    });

});
