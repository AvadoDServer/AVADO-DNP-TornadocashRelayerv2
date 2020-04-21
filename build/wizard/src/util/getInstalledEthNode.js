const autobahn = require('autobahn');
const url = "ws://my.wamp.dnp.dappnode.eth:8080/ws";
const realm = "dappnode_admin";

let endpoint;

const getInstalledEthNode = async (allowedPackages) => {

    return new Promise((resolve, reject) => {

        if (endpoint) {
            return resolve(endpoint);
        }

        const connection = new autobahn.Connection({
            url,
            realm,
            max_retries: 5,
        });

        // connection opened
        connection.onopen = async session => {
            console.log("CONNECTED to \nurl: " + url + " \nrealm: " + realm);

            const packages = await session.call("listPackages.dappmanager.dnp.dappnode.eth")
                .then(res => {
                    const packages = JSON.parse(res).result.reduce((accum, curr) => {
                        accum[curr.packageName] = curr;
                        return accum;
                    }, {});
                    return packages;
                });

            const validPackages = (allowedPackages || "ethchain-geth.public.dappnode.eth,ethchain.dnp.dappnode.eth,avado-dnp-nethermind.public.dappnode.eth").split(",");
            console.log("valid packages=", validPackages);
            endpoint = Object.keys(packages).reduce((accum, packageKey) => {
                const p = packages[packageKey];
                if (validPackages.includes(p.name) && !accum) {
                    console.log("Found valid package", p.name);
                    accum = `http://my.${p.name}:8545`;
                }
                return accum;
            }, null)
            connection.close();
            // if everything else fails - return RYO endpoint
            return resolve(endpoint || "https://mainnet.eth.cloud.ava.do");
        };
        connection.onclose = function (reason, details) {        
            if (reason === "closed"){
                // normal close - no error
                return;
            }
            if (details && details.will_retry === false) {
                console.log("getinstalledEthNode cannot find ETH node",reason);
                return reject(reason);
            }
        };
        connection.open();
    });


}

export default getInstalledEthNode;
