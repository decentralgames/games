async function tryCatch(promise, reason, message) {
    try {
        await promise;
        throw null;
    } catch (error) {

        assert(
            error,
            'Expected a VM exception but did not get one'
        );

        assert.equal(
            `revert ${error.reason}`,
            message.toString()
        );
    }
}

module.exports = {
    catchRevert: async function(promise, message) {
        await tryCatch(promise, "revert", message);
    },
    catchOutOfGas: async function(promise) {
        await tryCatch(promise, "out of gas");
    },
    catchInvalidJump: async function(promise) {
        await tryCatch(promise, "invalid JUMP");
    },
    catchInvalidOpcode: async function(promise) {
        await tryCatch(promise, "invalid opcode");
    },
    catchStackOverflow: async function(promise) {
        await tryCatch(promise, "stack overflow");
    },
    catchStackUnderflow: async function(promise) {
        await tryCatch(promise, "stack underflow");
    },
    catchStaticStateChange: async function(promise) {
        await tryCatch(promise, "static state change");
    },
    catchSquareLimit: async function(promise) {
        await tryCatch(promise, "exceeding maximum bet square limit -- Reason given: exceeding maximum bet square limit.");
    }
};
