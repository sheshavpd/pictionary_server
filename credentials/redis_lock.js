const Redlock = require('redlock');
const client = require('./redis_client');

const redlock = new Redlock(
    // you should have one client for each independent redis node
    // or cluster
    [client],
    {
        // the expected clock drift; for more details
        // see http://redis.io/topics/distlock
        driftFactor: 0.01, // time in ms

        // the max number of times Redlock will attempt
        // to lock a resource before erroring
        retryCount: 10,

        // the time in ms between attempts
        retryDelay: 200, // time in ms

        // the max time in ms randomly added to retries
        // to improve performance under high contention
        // see https://www.awsarchitectureblog.com/2015/03/backoff.html
        retryJitter: 200 // time in ms
    }
);

redlock.on('clientError', function (err) {
    console.error('A redis error has occurred:', err);
});

const tryLock = async function (lockName, lockTimeout = 1000) {
    let lock;
    try {
        lock = await redlock.lock(lockName, lockTimeout)
    } catch (e) {
        console.log(e);
    }
    return lock;
};

const unlock = async function (lock) {
    if (!lock)
        return;
    try {
        await lock.unlock();
    } catch (e) {
        console.log(e);
    }
};

const lockJobUnlock = async function(jobFunc) {
    const locksArr = [];
    try {
        await jobFunc(locksArr);
    }catch(e){console.log(e);}
    finally {
        for(const lock of locksArr) {
            await unlock(lock);
        }
    }
};
module.exports = {tryLock, unlock,lockJobUnlock, redlock};
