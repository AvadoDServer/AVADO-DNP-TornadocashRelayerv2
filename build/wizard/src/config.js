const configs = {
  development: {
    name: 'dev',
    apiGateway: {
      URL: 'https://localhost:82', // TODO
    },
  },
  production: {
    name: 'prod',
    apiGateway: {
      URL: 'http://avado-tornadocashrelayerv2.avadopackage.com:80', // TODO
    },
  },
};
const config = process.env.REACT_APP_STAGE
  ? configs[process.env.REACT_APP_STAGE]
  : configs.development;

module.exports = config;
