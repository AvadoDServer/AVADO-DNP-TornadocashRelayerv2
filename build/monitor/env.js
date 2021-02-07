const fs = require("fs");
const fileName = "/packagedata/env.json";

if (fs.existsSync(fileName)) {
    console.log(`Load environment from ${fileName}`);
    const env = require(fileName);
    Object.keys(env).map((key) => {
        process.env[key] = env[key];
    })
} else {
    console.log(`no config file at ${fileName}.. exiting`);
    process.exit();
}

