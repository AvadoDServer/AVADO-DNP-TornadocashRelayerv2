const restify = require("restify");
const corsMiddleware = require("restify-cors-middleware");
const configfile = '/packagedata/env.json';
const fs = require("fs");
const supervisord = require('supervisord');
const supervisordclient = supervisord.connect('http://localhost:9001');

const JSONdb = require('simple-json-db');
const db = new JSONdb(configfile);

console.log("Monitor starting...");


// defaults
const defaults =
{
    "RELAYER_FEE": 0.1,
    "PRIVATE_KEY": "",
    "NET_ID": 1,
    "REDIS_URL": "redis://127.0.0.1:6379",
    "APP_PORT": 8000,
    "NONCE_WATCHER_INTERVAL": 30,
    "ALLOWABLE_PENDING_TX_TIMEOUT": 180,
    "MAX_GAS_PRICE": 100,
    "GAS_PRICE_BUMP_PERCENTAGE": 20
};

Object.keys(defaults).map((key) => {
    const val = defaults[key];
    if (!db.get(key)) {
        db.set(key, val);
    }
})

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


server.post("/setenv", (req, res, next) => {
    if (!req.body) {
        res.send(400);
    }
    Object.keys(req.body).map(async (key) => {
        const displayVal = (key.toString().includes("PRIVATE")) ? "(hidden)" : req.body[key]
        console.log(`${key}=>${displayVal}`);
        await db.set(key, req.body[key]);
        await stopService();
        await startService();
    })
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

server.listen(82, function () {
    console.log("%s listening at %s", server.name, server.url);
});
