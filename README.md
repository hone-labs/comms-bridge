# comms-bridge

The library implements a "communications bridge" between endpoints in a multi-node messaging network.

For instance, it can be used for messaging between the multiple processes required in a Chrome extension.

## Usage

Install the library:

```bash
npm install --save @optio-labs/comms-bridge
```

Import the library:

```javascript
import { CommsBridge } from "@optio-labs/comms-bridge";
```

Create an instance of the comms bridge:

```javascript
const commsBridge = new CommsBridge("<identifier-for-this-endpoint>");
```

Add handlers to respond to incoming messages:

```javascript
commsBridge.respond("<your-message-name>", payload => {

    //
    // Do something...
    //
    console.log("Message received!");
    console.log(payload);

    // Data that is returned from the handler 
    // is the reply payload received at other end of the message.
    return {
        // ... your data goes here ...
    };
});
```

Send a message to another endpoint:

```javascript
await commsBridge.send({
    targetId: "<identifier-for-other-endpoint>",
    name: "<your-message-name>",
    payload: {
        // ... your data goes here ...
    },
});
```

Send a message and await a reply:

```javascript
const replyPayload = await commsBridge.send(
    {
        targetId: "<identifier-for-other-endpoint>",
        name: "<your-message-name>",
        payload: {
            // ... your data goes here ...
        },
    },
    {
        awaitReply: true,
    }
);
console.log("Other endpoint replied with:");
console.log(replyPayload);
```

Add incoming and outgoing network transports:

```javascript
commsBridge.addIncoming("", new IncomingMessageTransport());
commsBridge.addOutgoing("", new OutgoingMessageTransport()); 
```

`IncomingMessageTransport` and `OutgoingMessageTransport` are classes that should be implemented by you.

`IncomingMessageTransport` feeds incoming messages from some messaging system or network protocol into the communications bridge.

`OutgoingMessageTransport` sends outgoing messages from the communications bridge into some messaging system or network protocol.

## Development setup

Clone the repo and install dependencies:

```bash
npm install
```

Build the library:

```bash
npm run build
```