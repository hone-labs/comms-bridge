import { CommsBridge } from "../index";

describe("comms bridge", () => {

    it("can instance comms bridge", ()  => {

        const commsBridge = new CommsBridge("1234");
        expect(commsBridge).toBeDefined();
    });

});
