import { CommsBridge, IMessage } from "../index";

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
