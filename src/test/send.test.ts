import { CommsBridge, IMessage, IPackage, onIncomingMessageFn } from "../index";

describe("sending", () => {

    it("can send outgoing message on all transports", async () => {

        let messagesSent = 0;
        const instanceId = "this-is-me";
        const messageName = "some-kind-of-message";
        const messagePayload = {};

        const commsBridge = new CommsBridge(instanceId);

        commsBridge.addOutgoing("outgoing-id-1", {
            send: (pkg: IPackage) => {
                expect(pkg.msg.name).toEqual(messageName);
                expect(pkg.senderId).toEqual(instanceId);
                messagesSent += 1;
            },
        });
        commsBridge.addOutgoing("outgoing-id-2", {
            send: (pkg: IPackage) => {
                expect(pkg.msg.name).toEqual(messageName);
                expect(pkg.senderId).toEqual(instanceId);
                messagesSent += 1;
            },
        });

        await commsBridge.send({
            targetId: "some-one-else", 
            name: messageName, 
            payload: messagePayload
        });

        expect(messagesSent).toEqual(2);
    });

    it("can send outgoing message on a particular transport", async () => {

        let messagesSent = 0;
        const instanceId = "this-is-me";
        const messageName = "some-kind-of-message";
        const messagePayload = {};

        const commsBridge = new CommsBridge(instanceId);

        commsBridge.addOutgoing("outgoing-id-1", {
            send: (pkg: IPackage) => {
                expect(pkg.msg.name).toEqual(messageName);
                expect(pkg.senderId).toEqual(instanceId);
                messagesSent += 1;
            },
        });
        commsBridge.addOutgoing("outgoing-id-2", {
            send: (pkg: IPackage) => {
                expect(pkg.msg.name).toEqual(messageName);
                expect(pkg.senderId).toEqual(instanceId);
                messagesSent += 1;
            },
        });

        await commsBridge.send({
            transportId: "outgoing-id-1",
            targetId: "some-one-else", 
            name: messageName, 
            payload: messagePayload
        });

        expect(messagesSent).toEqual(1);
    });

    it("can recieve reply from message sent", async () => {

        const instanceId = "this-is-me";
        const replyPayload = {};

        const commsBridge = new CommsBridge(instanceId);

        let incomingMessageHandler: onIncomingMessageFn | undefined = undefined;
        const mockOutgoing: any = {
            send: (msg: IPackage) => {
                //
                // Simulate a reply coming back.
                //
                incomingMessageHandler!({
                    replyId: msg.id,
                    msg: {
                        targetId: instanceId,
                        payload: replyPayload,
                    },
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
            send: (msg: IPackage) => {
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
        const transportId = "my-transport-id";
        const targetId = "this-is-someone-else";
        const messageName = "some-kind-of-message";
        const messagePayload = {};
        const expectedResult = [1, 2, 3];

        const commsBridge = new CommsBridge(instanceId);

        const mockOutgoing: any = {
            send: (msg: IMessage) => {
                return Promise.resolve(expectedResult);
            },
        };
        commsBridge.addOutgoing(transportId, mockOutgoing);

        // Works fine.
        await commsBridge.send({ 
            targetId: targetId, 
            name: messageName, 
            payload: messagePayload
        });

        commsBridge.removeOutgoing(transportId);

        // Throws now.
        await expect(() => 
                commsBridge.send({ targetId: targetId, name: messageName, payload: messagePayload })
            )
            .rejects.toThrow();
    });

});
