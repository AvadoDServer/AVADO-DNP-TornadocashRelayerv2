const restify = require("restify");
const corsMiddleware = require("restify-cors-middleware");
const configfile = '/packagedata/env.json';
const fs = require("fs");
const supervisord = require('supervisord');
const supervisordclient = supervisord.connect('http://localhost:9001');

const JSONdb = require('simple-json-db');
const { isArray } = require("util");
const db = new JSONdb(configfile);

console.log("Monitor starting...");

const relayerENVFile = '/usr/src/tornado-relayer/.env';


// defaults
const defaults =
{
    "NET_ID": 1,
    "HTTP_RPC_URL": "",
    "WS_RPC_URL": "",
    "ORACLE_RPC_URL": "",
    "REDIS_URL": "redis://127.0.0.1:6379",
    "APP_PORT": 8000,
    "PRIVATE_KEY": "",
    "REGULAR_TORNADO_WITHDRAW_FEE": 0.045,
    "MINING_SERVICE_FEE": 0.045,
    "MINING_SERVICE_FEE": 0.045,
    "TORN_ETH_PRICE": 7000000000000000,
    "REWARD_ACCOUNT": "",
    "CONFIRMATIONS": 0,
    "MAX_GAS_PRICE": 1000,
    "AGGREGATOR": "0x8cb1436F64a3c33aD17bb42F94e255c4c0E871b2",
};

// set default values
Object.keys(defaults).map((key) => {
    const val = defaults[key];
    if (!db.get(key)) {
        db.set(key, val);
    }
})

// overwrite 
db.set("CONFIRMATIONS", "0");

// dump config to ENV file
const writeConfigToENV = () => {
    const data = db.JSON();
    if (Array.isArray(data)) {
        return console.log(`config database is no array - uninitialized ?`);
    }
    const logger = fs.createWriteStream(`${relayerENVFile}`, {
        flags: 'w'
    })
    let lines = 0;
    Object.keys(data).map((k) => {
        logger.write(`${k}=${data[k]}\n`);
        lines++;
    })
    logger.end();
    console.log(`${lines} lines written to ${relayerENVFile}`)
}

writeConfigToENV();


const server = restify.createServer({
    name: "MONITOR",
    version: "1.0.0"
});

const cors = corsMiddleware({
    preflightMaxAge: 5, //Optional
    origins: [
        /^http:\/\/localhost(:[\d]+)?$/,
        "http://*.dappnode.eth:81",
    ]
});

server.pre(cors.preflight);
server.use(cors.actual);
server.use(restify.plugins.bodyParser());

server.get("/getenv", (req, res, next) => {
    res.send(200, db.JSON());
});


server.post("/setenv", async (req, res, next) => {
    if (!req.body) {
        res.send(400);
    }
    Object.keys(req.body).map(async (key) => {
        const displayVal = (key.toString().includes("PRIVATE")) ? "(hidden)" : req.body[key]
        console.log(`${key}=>${displayVal}`);
        await db.set(key, req.body[key]);       
    })
    writeConfigToENV();
    await stopService();
    await startService();
    res.send(200, db.JSON());
});


// ************************************************************************
// supervisord
// ************************************************************************

// get status of a supervisor process
server.get("/supervisord/status/:name", (req, res, next) => {
    if (req.params.name) {
        supervisordclient.getProcessInfo(req.params.name, function (err, result) {
            if (err) {
                res.send(500, err);
                return next();
            }
            res.send(200, result);
            return next();
        });
    } else {
        supervisordclient.getAllProcessInfo(function (err, result) {
            if (err) {
                res.send(500, err);
                return next();
            }
            res.send(200, result);
            return next();
        });
    }
})

server.get("/supervisord/readstdoutlogs/:name/:offset/:length", (req, res, next) => {
    if (req.params.name && req.params.offset && req.params.length) {

        supervisordclient.readProcessStdoutLog(req.params.name, req.params.offset, req.params.length, function (err, result) {
            if (err) {
                res.send(500, err);
                return next();
            }
            res.send(200, result);
            return next();
        });
    } else {
        res.send(400, "missing parameters", req.params);
        return next();
    }
});

server.get("/supervisord/start/:name", (req, res, next) => {
    if (req.params.name) {
        console.log(`attempting to start service ${req.params.name}`);
        supervisordclient.startProcess(req.params.name, function (err, result) {
            if (err) {
                console.log(`error starting service ${req.params.name}`, err);
                res.send(500, err);
                return next();
            }
            console.log(`successfully started service ${req.params.name}`);
            res.send(200, result);
            return next();
        });
    } else {
        res.send(400, "no name specified");
        return next();
    }
})

server.get("/supervisord/stop/:name", (req, res, next) => {
    if (req.params.name) {
        console.log(`attempting to stop service ${req.params.name}`);
        supervisordclient.stopProcess(req.params.name, function (err, result) {
            if (err) {
                console.log(`error stopping service ${req.params.name}`, err);
                res.send(500, err);
                return next();
            }
            console.log(`successfully stopped service ${req.params.name}`);

            res.send(200, result);
            return next();
        });
    } else {
        res.send(400, "no name specified");
        return next();
    }
})

server.get('/*', restify.plugins.serveStaticFiles(`${__dirname}/wizard`, {
    maxAge: 1, // this is in millisecs
    etag: false,
}));

const startService = () => {
    const serviceName = "relayer";
    return supervisordclient.startProcess(serviceName, function (err, result) {
        if (err) {
            console.log(`error starting service ${serviceName}`, err);
        }
        console.log(`successfully started service ${serviceName}`);
    });
}

const stopService = () => {
    const serviceName = "relayer";
    return supervisordclient.stopProcess(serviceName, function (err, result) {
        if (err) {
            console.log(`error stopping service ${serviceName}`, err);
        }
        console.log(`successfully stopped service ${serviceName}`);
    });
}


const censor = (config) => {
    // remove sensitive info
    return Object.keys(config).map((key) => {
        let r = {};
        let val = (key === "PRIVATE_KEY" && config.key !== "") ? "***[censored]***" : config[key];
        r[key] = val;
        return (r);
    })
}

// on startup - check if config file exists & start service if so
if (fs.existsSync(configfile)) {
    const missingKeys = Object.keys(defaults).reduce((accum, key) => {
        if (!db.get(key) || db.get(key) === "") {
            let r = {};
            r[key] = db.get(key);
            accum.push(r);
        }
        return accum;
    }, []);

    // patch to increase max gas price
    db.set("MAX_GAS_PRICE", 1000);

    if (missingKeys.length > 0) {
        console.log(`Some keys are missing`);
        console.log(`missing:`);
        console.log(missingKeys);
        console.log(`current config:`);
        console.log(censor(db.JSON()));
    } else {
        console.log(`A config file exists - attemtping to start service`);
        console.log(censor(db.JSON()));
        startService();
    }
}

server.listen(80, function () {
    console.log("%s listening at %s", server.name, server.url);
});
